import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { AtlasService } from 'src/atlas/atlas.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { DockerService } from 'src/docker/docker.service';

@Injectable()
@Processor('atlas-queue')
export class AtlasProcessor {
  constructor(
    private readonly docker: DockerService,
    private readonly atlas: AtlasService,
    private prisma: PrismaService,
  ) {}

  @Process('process-add-archetype')
  async handleAddArchetypeJob(job: Job, token?: string) {
    const { dbId, columnMapping, template, projectId } = job.data;
    const params = {
      name: 'progress',
    };

    const archetypeBody = {
      entity: {
        typeName: 'archetype',
        status: 'ACTIVE',
        attributes: {
          // TODO: use actual username here
          owner: 'user',
          qualifiedName: `${dbId}@${template.name}`,
          is_active: true,
          progress: 0,
        },
        relationshipAttributes: {
          instance: {
            guid: dbId,
            typeName: 'rdbms_instance',
          },
        },
      },
    };

    const result = await this.atlas.post('/entity', archetypeBody, token);
    const archetypeId = Object.values(result.guidAssignments)[0];
    await this.atlas.put('/entity/guid/' + archetypeId, '20', params, token);

    const entities = [];
    let initialGuid = -1;

    const object = template.nodes.filter((node: any) => node.type === 'object');
    const catList = template.nodes.filter(
      (node: any) => node.type === 'category',
    );
    const subcatList = template.nodes.filter(
      (node: any) => node.type === 'subcategory',
    );

    const objectBody = {
      guid: initialGuid.toString(),
      typeName: 'archetype_object',
      status: 'ACTIVE',
      attributes: {
        displayName: object[0].data.label,
        name: object[0].data.label,
        owner: 'user',
        qualifiedName: `${archetypeId}@${object[0].data.label.replace(' ', '_')}@${object[0].id}`,
        position: {
          x: object[0].position.x,
          y: object[0].position.y,
        },
        label: object[0].data.label,
        width: object[0].width,
        height: object[0].height,
        selected: false,
        dragging: false,
      },
      relationshipAttributes: {
        archetype: {
          guid: archetypeId,
          typeName: 'archetype',
        },
      },
    };

    entities.push(objectBody);

    await this.atlas.put('/entity/guid/' + archetypeId, '40', params, token);

    const catBodyList = catList.map((node: any) => {
      initialGuid -= 1;
      return {
        guid: initialGuid.toString(),
        typeName: 'archetype_category',
        status: 'ACTIVE',
        attributes: {
          displayName: node.data.label,
          name: node.data.label,
          owner: 'user',
          qualifiedName: `${archetypeId}@${node.data.label.replace(' ', '_')}@${node.id}`,
          position: {
            x: node.position.x,
            y: node.position.y,
          },
          label: node.data.label,
          width: node.width,
          height: node.height,
          selected: false,
          dragging: false,
        },
        relationshipAttributes: {
          archetype: {
            guid: archetypeId,
            typeName: 'archetype',
          },
          object: {
            guid: '-1',
            typeName: 'archetype_object',
          },
        },
      };
    });

    entities.push(...catBodyList);

    const catIdList: { [key: string]: string } = {};
    for (const cat of catBodyList) {
      const name = cat.attributes.qualifiedName.split('@');
      catIdList[name[2]] = cat.guid;
    }

    await this.atlas.put('/entity/guid/' + archetypeId, '60', params, token);

    for (const node of subcatList) {
      const relatedEdge = template.edges.filter(
        (edge: any) => edge.source == node.id || edge.target == node.id,
      );

      const categoryId =
        relatedEdge[0].source == node.id
          ? catIdList[relatedEdge[0].target]
          : catIdList[relatedEdge[0].source];

      const subcatBody = {
        typeName: 'archetype_subcategory',
        status: 'ACTIVE',
        attributes: {
          displayName: node.data.label,
          name: node.data.label,
          owner: 'user',
          qualifiedName: `${archetypeId}@${node.data.label.replace(' ', '_')}@${node.id}`,
          position: {
            x: node.position.x,
            y: node.position.y,
          },
          label: node.data.label,
          width: node.width,
          height: node.height,
          selected: false,
          dragging: false,
        },
        relationshipAttributes: {
          archetype: {
            guid: archetypeId,
            typeName: 'archetype',
          },
          category: {
            guid: categoryId,
            type: 'archetype_category',
          },
        },
      };

      entities.push(subcatBody);
    }

    await this.atlas.post('/entity/bulk', { entities: entities });

    await this.atlas.put('/entity/guid/' + archetypeId, '80', params, token);

    await this.prisma.project.update({
      where: { projectId: projectId },
      data: { lastModified: new Date() },
    });

    const tableParams = {
      query: `from rdbms_db where instance.__guid = "${dbId}" select tables`,
    };

    const tableResult = await this.atlas.get('/search/dsl', tableParams, token);

    const activeTables = tableResult.entities.filter(
      (entity: any) => entity.status === 'ACTIVE',
    );

    for (const node of columnMapping) {
      const params = {
        'attr:qualifiedName': `${archetypeId}@${node.nodeName.replace(' ', '_')}@${node.nodeId}`,
      };

      const result = await this.atlas.get(
        `/entity/uniqueAttribute/type/archetype_${node.nodeType}`,
        params,
        token,
      );

      if (result.entity.relationshipAttributes.columns.length !== 0) {
        continue;
      }

      result.entity.relationshipAttributes.columns = [];

      for (const col of node.columns) {
        const tableGuid = activeTables.find(
          (table: any) => table.attributes.name === col.table,
        ).guid;

        const colParams = {
          query: `from rdbms_column where table.__guid = "${tableGuid}"`,
        };
        const colResult = await this.atlas.get('/search/dsl', colParams, token);

        const activeColumns = colResult.entities.filter(
          (entity: any) => entity.status === 'ACTIVE',
        );

        const columnEntity = activeColumns.find(
          (column: any) => column.attributes.name === col.name,
        );

        const relationship = await this.atlas.get(
          `/types/relationshipdef/name/archetype_${node.nodeType}_rdbms_columns`,
          undefined,
          token,
        );

        const columnInfo = {
          guid: columnEntity.guid,
          typeName: 'rdbms_column',
          entityStatus: 'ACTIVE',
          relationshipType: `archetype_${node.nodeType}_rdbms_columns`,
          relationshipGuid: relationship.guid,
          relationshipStatus: 'ACTIVE',
        };

        result.entity.relationshipAttributes.columns.push(columnInfo);
      }

      await this.atlas.post('/entity', result, undefined, token);
    }
    await this.atlas.put('/entity/guid/' + archetypeId, '100', params, token);
  }

  @Process('process-delete-archetype')
  async handleDeleteTemplateJob(job: Job, token?: string) {
    const { templateId, projectId } = job.data;

    await this.atlas.delete('/entity/guid/' + templateId, undefined, token);
    await this.prisma.project.update({
      where: {
        projectId: projectId,
      },
      data: {
        lastModified: new Date(),
      },
    });
  }

  @Process('process-add-permissions')
  async handleAddPermissionsJob(job: Job, token?: string) {
    const { projectId, permissions } = job.data;

    for (const p of permissions) {
      const templateGuid = p.templateId;

      const templateEntity = await this.atlas.get(
        `/entity/guid/${templateGuid}`,
        undefined,
        token,
      );

      const templateNodesGuid = [];

      for (const key in templateEntity.referredEntities) {
        const entity = templateEntity.referredEntities[key];

        if (
          entity.typeName.includes('archetype_') &&
          entity.status === 'ACTIVE'
        ) {
          templateNodesGuid.push(key);
        }
      }

      const getGuid = (name: string) => {
        for (const key in templateEntity.referredEntities) {
          if (
            templateEntity.referredEntities[key].attributes.qualifiedName ==
            name
          ) {
            return key;
          }
        }
      };

      const params = { name: 'is_active' };
      await this.atlas.put(
        `/entity/guid/${templateGuid}`,
        JSON.stringify(p.active ? 'true' : 'false'),
        params,
        token,
      );

      if (p.active) {
        const activeParams = {
          query: `from permission where __state = "ACTIVE"`,
        };

        const activeResult = await this.atlas.get(
          '/search/dsl',
          activeParams,
          token,
        );

        if (activeResult.entities) {
          let guidList = [];
          for (const entity of activeResult.entities) {
            const params = {
              minExtInfo: true,
            };

            const permissionEntity = await this.atlas.get(
              `/entity/guid/${entity.guid}`,
              params,
              token,
            );

            const objects =
              permissionEntity.entity.relationshipAttributes.object.filter(
                (o) =>
                  templateNodesGuid.includes(o.guid) &&
                  o.relationshipStatus === 'ACTIVE',
              );

            const categories =
              permissionEntity.entity.relationshipAttributes.category.filter(
                (s) =>
                  templateNodesGuid.includes(s.guid) &&
                  s.relationshipStatus === 'ACTIVE',
              );
            const subcategories =
              permissionEntity.entity.relationshipAttributes.subcategory.filter(
                (c) =>
                  templateNodesGuid.includes(c.guid) &&
                  c.relationshipStatus === 'ACTIVE',
              );

            const combined = [...objects, ...categories, ...subcategories];
            guidList = [
              ...guidList,
              ...combined.map((c) => c.relationshipGuid),
            ];
          }

          guidList = Array.from(new Set(guidList));

          for (const guid of guidList) {
            await this.atlas.delete(
              `/relationship/guid/${guid}`,
              undefined,
              token,
            );
          }
        }

        for (const setting of p.settings) {
          const role = setting.role;

          for (const node of setting.access) {
            const nodeType = `archetype_${node.nodeType}`;
            const nodeGuid = await getGuid(
              `${templateGuid}@${node.nodeName.replace(' ', '_')}@${node.nodeId}`,
            );

            const uniquePermissions = [...new Set(node.permissions)];

            for (const permission of uniquePermissions) {
              const permissionName = `permission_${permission}@${role}`;
              const permissionParams = {
                query: `from permission where qualifiedName = "${permissionName}" and __state = "ACTIVE" limit 1`,
              };

              const permissionResult = await this.atlas.get(
                '/search/dsl',
                permissionParams,
                token,
              );

              if (permissionResult.entities) {
                const permissionGuid = permissionResult.entities[0].guid;

                const permissionEntity = await this.atlas.get(
                  `/entity/guid/${permissionGuid}`,
                  undefined,
                  token,
                );

                const hasRelationship =
                  permissionEntity.entity.relationshipAttributes[
                    `${node.nodeType}`
                  ].some(
                    (p: any) =>
                      p.guid === nodeGuid && p.relationshipStatus === 'ACTIVE',
                  );

                if (!hasRelationship) {
                  const relationshipBody = {
                    typeName: `${nodeType}_permissions`,
                    end1: {
                      guid: nodeGuid,
                    },
                    end2: {
                      guid: permissionGuid,
                    },
                    status: 'ACTIVE',
                  };

                  await this.atlas.post(
                    '/relationship',
                    relationshipBody,
                    token,
                  );
                }
              } else {
                const permissionBody = {
                  entity: {
                    typeName: 'permission',
                    status: 'ACTIVE',
                    attributes: {
                      owner: 'user',
                      qualifiedName: `permission_${permission}@${role}`,
                      name: permission,
                    },
                    relationshipAttributes: {
                      object: [],
                      category: [],
                      subcategory: [],
                    },
                  },
                };

                const relationship = await this.atlas.get(
                  `/types/relationshipdef/name/${nodeType}_permissions`,
                  undefined,
                  token,
                );
                const relationshipInfo = {
                  guid: nodeGuid,
                  typeName: nodeType,
                  entityStatus: 'ACTIVE',
                  relationshipType: `${nodeType}_permissions`,
                  relationshipGuid: relationship.guid,
                  relationshipStatus: 'ACTIVE',
                };

                permissionBody.entity.relationshipAttributes[
                  node.nodeType
                ].push(relationshipInfo);

                await this.atlas.post('/entity', permissionBody, token);
              }
            }
          }
        }
      }
    }

    await this.prisma.project.update({
      where: {
        projectId: projectId,
      },
      data: {
        lastModified: new Date(),
      },
    });
  }

  @Process('process-data-broker')
  async handleDataBrokerJob(job: Job) {
    const { ownerId, sourceId, database } = job.data;
    await this.docker.runDataBroker(ownerId, sourceId, database);
  }
}

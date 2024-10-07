import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { AtlasService } from 'src/atlas/atlas.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
@Processor('atlas-queue')
export class AtlasProcessor {
  constructor(
    private readonly atlas: AtlasService,
    private prisma: PrismaService,
  ) {}

  @Process('process-add-archetype')
  async handleAddArchetypeJob(job: Job) {
    const jobData = job.data;

    const dbId = jobData.dbId;
    const parsedMapping = jobData.columnMapping;
    const parsedTemplate = jobData.template;
    const projectId = jobData.projectId;

    const archetypeBody = {
      entity: {
        typeName: 'archetype',
        status: 'ACTIVE',
        attributes: {
          owner: 'user',
          qualifiedName: `${dbId}@${parsedTemplate.name}`,
          is_active: true,
        },
        relationshipAttributes: {
          instance: {
            guid: dbId,
            typeName: 'rdbms_instance',
          },
        },
      },
    };

    const result = await this.atlas.post('/entity', archetypeBody);
    const archetypeId = Object.values(result.guidAssignments)[0];

    // Continue processing with object, category, and subcategory nodes
    const object = parsedTemplate.nodes.filter(
      (node: any) => node.type === 'object',
    );
    const catList = parsedTemplate.nodes.filter(
      (node: any) => node.type === 'category',
    );
    const subcatList = parsedTemplate.nodes.filter(
      (node: any) => node.type === 'subcategory',
    );

    const objectBody = {
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

    const objectResult = await this.atlas.post('/entity/bulk', {
      entities: [objectBody],
    });
    const objectId = Object.values(objectResult.guidAssignments)[0];

    const catBodyList = catList.map((node: any) => ({
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
          guid: objectId,
          typeName: 'archetype_object',
        },
      },
    }));

    const catResult = await this.atlas.post('/entity/bulk', {
      entities: catBodyList,
    });

    const catIdList: { [key: string]: string } = {};
    for (const cat of catResult.mutatedEntities.CREATE) {
      const name = cat.attributes.qualifiedName.split('@');
      catIdList[name[2]] = cat.guid;
    }

    const subcatBodyList = [];

    for (const node of subcatList) {
      const relatedEdge = parsedTemplate.edges.filter(
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

      subcatBodyList.push(subcatBody);
    }

    if (subcatBodyList.length > 0) {
      await this.atlas.post('/entity/bulk', { entities: subcatBodyList });
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: { lastUpdated: new Date() },
    });

    const tableParams = {
      query: `from rdbms_db where instance.__guid = "${dbId}" select tables`,
    };

    const tableResult = await this.atlas.get('/search/dsl', tableParams);

    const activeTables = tableResult.entities.filter(
      (entity: any) => entity.status === 'ACTIVE',
    );

    for (const node of parsedMapping) {
      const params = {
        'attr:qualifiedName': `${archetypeId}@${node.nodeName.replace(' ', '_')}@${node.nodeId}`,
      };

      const result = await this.atlas.get(
        `/entity/uniqueAttribute/type/archetype_${node.nodeType}`,
        params,
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
        const colResult = await this.atlas.get('/search/dsl', colParams);

        const activeColumns = colResult.entities.filter(
          (entity: any) => entity.status === 'ACTIVE',
        );

        const columnEntity = activeColumns.find(
          (column: any) => column.attributes.name === col.name,
        );

        const relationship = await this.atlas.get(
          `/types/relationshipdef/name/archetype_${node.nodeType}_rdbms_columns`,
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

      await this.atlas.post('/entity', result);
    }
  }

  async handleDeleteTemplateJob(job: Job) {
    const template = job.data;

    await this.atlas.delete('/entity/guid/' + template.templateId);
    await this.prisma.project.update({
      where: {
        id: template.projectId,
      },
      data: {
        lastUpdated: new Date(),
      },
    });
  }
}

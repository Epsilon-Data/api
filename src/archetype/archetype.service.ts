import { Injectable, Logger } from '@nestjs/common';
import { AtlasService } from 'src/atlas/atlas.service';
import { QueueService } from 'src/queue/queue.service';
import {
  ArchetypeDto,
  ArchetypeEdgeDto,
  ArchetypeNodeDto,
  ArchetypeNodeType,
  ArchetypePermission,
  ArchetypeStatus,
} from './dto';
import {
  AtlasArchetypeEntityResponseDto,
  AtlasEntityResponseDto,
  AtlasSearchBasicHeadlessResponseDto,
  AtlasSearchBasicResponseDto,
} from 'src/atlas/dto';

@Injectable()
export class ArchetypeService {
  private readonly logger = new Logger(ArchetypeService.name);
  constructor(
    private atlas: AtlasService,
    private readonly queue: QueueService,
  ) {}

  async fetchArchetypes(projectId: string, token?: string) {
    // NOTE: can also remove headers to reduce payload
    const body = {
      typeName: 'archetype_template',
      excludeDeletedEntities: true,
      includeClassificationAttributes: false,
      includeSubTypes: false,
      includeSubClassifications: false,
      excludeHeaderAttributes: false,
      entityFilters: {
        attributeName: 'projectId',
        operator: 'eq',
        attributeValue: projectId,
      },
      attributes: [
        'name',
        'qualifiedName',
        'status',
        '__createdBy ',
        '__timestamp ',
        '__modificationTimestamp',
      ],
    };

    const res = await this.atlas.post<AtlasSearchBasicResponseDto>(
      '/search/basic',
      body,
      token,
    );
    const entities = res?.entities ?? [];
    return entities.map((entity) => ({
      id: entity.guid,
      name: entity.displayText,
      status: entity.attributes?.status,
      createdBy: entity.attributes?.__createdBy,
      created: entity.attributes?.__timestamp,
      lastModified: entity.attributes?.__modificationTimestamp,
    }));
  }

  async createArchetype(username: string, archetype: ArchetypeDto) {
    return await this.queue.addArchetypeJob(username, archetype);
  }

  async updateArchetype(username: string, archetype: ArchetypeDto) {
    return await this.queue.updateArchetypeJob(username, archetype);
  }

  async getArchetypeDetails(
    projectId: string,
    archetypeId: string,
    token?: string,
  ) {
    // TODO: handle errors
    const entityRes = await this.atlas.get<AtlasArchetypeEntityResponseDto>(
      `/entity/guid/${archetypeId}`,
      undefined,
      token,
    );

    const templateInfo: ArchetypeDto = {
      projectId: projectId,
      archetypeId: archetypeId,
      name: entityRes.entity?.attributes?.name,
      status: entityRes.entity?.attributes?.status as ArchetypeStatus,
      nodes: [],
      edges: [],
      permissions: [],
      lastModified: new Date(entityRes.entity?.updateTime),
    };

    // add all archetype_nodes
    for (const key in entityRes.referredEntities) {
      const entity = entityRes.referredEntities[key];
      const nodeId = entity.attributes?.qualifiedName.split('@')[2];
      // add node itself
      const node: ArchetypeNodeDto = {
        id: nodeId, // NOTE: Maybe use GUID
        data: {
          label: entity.attributes?.label,
          level: entity.attributes?.level,
        },
        position: entity.attributes?.position,
        type: (entity.attributes?.level === 0
          ? 'root'
          : 'category') as ArchetypeNodeType,
      };
      templateInfo.nodes.push(node);

      // add edge if has parent exists
      if (entity.relationshipAttributes?.parent_node) {
        const parentNodeId =
          entity.relationshipAttributes?.parent_node?.qualifiedName.split(
            '@',
          )[2]; // NOTE: Maybe use GUID
        const edge: ArchetypeEdgeDto = {
          id: `edge_${parentNodeId}_${nodeId}`, // NOTE: maybe use relationship GUID here
          source: parentNodeId,
          target: nodeId,
        };
        templateInfo.edges.push(edge);
      }
      // add column node and edges
      if (entity.relationshipAttributes?.column) {
        const columnNodeId = entity.relationshipAttributes?.column?.guid;
        const columName =
          entity.relationshipAttributes?.column?.qualifiedName.split('@')[2];
        const node: ArchetypeNodeDto = {
          id: columnNodeId,
          data: {
            label: columName,
            level: entity.attributes?.level + 1,
          },
          position: entity.attributes?.position, // TODO: figure out where to put column, relative to node
          type: ArchetypeNodeType.Column,
        };
        templateInfo.nodes.push(node);
        const edge: ArchetypeEdgeDto = {
          source: nodeId,
          target: columnNodeId,
          id: `edge_${nodeId}_${columnNodeId}`, // NOTE: maybe use relationship GUID here
        };
        templateInfo.edges.push(edge);
      }

      const analysisPermission = (() => {
        const permission = entity.classifications?.find(
          (c) => c.typeName === 'archetype_node_analysis_permissions',
        );
        return {
          id: nodeId,
          permission: (permission?.attributes?.access_level ??
            'NONE') as ArchetypePermission,
        };
      })();
      templateInfo.permissions.push(analysisPermission);
    }

    return templateInfo;
  }

  async deleteArchetype(projectId: string, archetypeId: string) {
    return await this.queue.deleteArchetypeJob(projectId, archetypeId);
  }

  async getAnalysisArchetype(projectId: string, token?: string) {
    // get ID of PUBLISHED archetype
    const body = {
      typeName: 'archetype_template',
      excludeDeletedEntities: true,
      includeSubClassifications: false,
      excludeHeaderAttributes: true,
      includeSubTypes: false,
      entityFilters: {
        condition: 'AND',
        criterion: [
          {
            attributeName: 'projectId',
            operator: 'eq',
            attributeValue: `${projectId}`,
          },
          {
            attributeName: 'status',
            operator: 'eq',
            attributeValue: 'PUBLISHED',
          },
        ],
      },
      attributes: ['name', '__guid'],
    };

    const res = await this.atlas.post<AtlasSearchBasicHeadlessResponseDto>(
      '/search/basic',
      body,
      token,
    );
    if (res.approximateCount) {
      const properties: Record<string, object> = {};
      const schema = {
        $schema: 'https://json-schema.org/draft/2020-12/schema#',
        title: res.attributes?.values[0][0],
        type: 'object',
        properties,
      };

      const templateGuid = res.attributes?.values[0][1];
      const templateEntity =
        await this.atlas.get<AtlasArchetypeEntityResponseDto>(
          `/entity/guid/${templateGuid}`,
          undefined,
          token,
        );

      // TODO: handle errors
      for (const key in templateEntity.referredEntities) {
        const node = templateEntity.referredEntities[key];
        // TODO: check if this is the best thing to use
        const objectName = node.attributes?.label
          .replace(/\s+/g, '_')
          .toLowerCase();
        const description = node.attributes?.label;
        // check for node has children
        if (node.relationshipAttributes?.child_nodes?.length) {
          const type = 'object';
          const properties: Record<string, object> = {};
          schema.properties[objectName] = { type, properties };
        }
        // check if node has a column
        if (node.relationshipAttributes?.column) {
          const column = node.relationshipAttributes?.column;
          const properties: Record<string, object> = {};
          // TODO: handle errors
          const { entity } = await this.atlas.get<AtlasEntityResponseDto>(
            `/entity/guid/${column.guid}`,
            undefined,
            token,
          );
          const jsonType = this.atlasTypeToJSONType(
            entity.attributes?.data_type as string,
          );
          properties[objectName] = {
            type: jsonType,
            description,
          };

          // add nodes to parent
          if (node.relationshipAttributes?.parent_node) {
            const parentRef =
              node.relationshipAttributes?.parent_node.displayText
                .replace(/\s+/g, '_')
                .toLowerCase();
            schema.properties[parentRef]['properties'] = {
              ...schema.properties[parentRef]['properties'],
              ...properties,
            };
          } else {
            schema.properties = { ...schema.properties, ...properties };
          }
        }
      }
      return schema;
    }
    return {};
  }

  private atlasTypeToJSONType(dataType: string): string {
    switch (dataType) {
      case 'string':
      case 'date':
        return 'string';
      case 'int':
      case 'integer':
        return 'integer';
      case 'long':
      case 'float':
      case 'double':
      case 'short':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'array<string>':
      case 'list<string>':
        return 'array';
      // You can expand this for nested object types too
      default:
        return 'object'; // fallback for unknown types
    }
  }
}

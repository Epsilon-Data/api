import { Injectable, Logger } from '@nestjs/common';
import { AtlasService } from 'src/atlas/atlas.service';
// import { DatabaseService } from 'src/database/database.service';
import { QueueService } from 'src/queue/queue.service';
import { ArchetypeDto } from './dto';
import {
  AtlasSearchAttributeResponseDto,
  AtlasSearchDslAttributesResponseDto,
} from 'src/atlas/dto';

@Injectable()
export class ArchetypeService {
  private readonly logger = new Logger(ArchetypeService.name);
  constructor(
    private atlas: AtlasService,
    private readonly queue: QueueService,
    // @Inject(forwardRef(() => DatabaseService))
    // private databaseSource: DatabaseService,
  ) {}

  // TODO: use code and remove this method
  async getArchetypes(projectId: string, token?: string) {
    const activeTemplates = await this.fetchArchetypes(projectId, token);

    const output = [];
    for (const template of activeTemplates) {
      const templateGuid = template.id;
      const templateName = template.name;

      const templateInfo = {
        id: templateGuid,
        name: templateName,
        nodes: [],
        edges: [],
      };

      // const templateEntity = await this.atlas.get(
      //   `/entity/guid/${templateGuid}`,
      //   undefined,
      //   token,
      // );

      // for (const key in templateEntity.referredEntities) {
      //   const entity = templateEntity.referredEntities[key];

      //   if (entity.typeName.includes('archetype_')) {
      //     const splitted = entity.attributes.qualifiedName.split('@');
      //     const node = {
      //       id: splitted[2],
      //       position: {
      //         x: Number(entity.attributes.position.x),
      //         y: Number(entity.attributes.position.y),
      //       },
      //       data: {
      //         label: entity.attributes.displayName,
      //       },
      //       type: entity.typeName.replace('archetype_', ''),
      //       width: entity.attributes.width,
      //       height: entity.attributes.height,
      //       selected: false,
      //       positionAbsolute: {
      //         x: Number(entity.attributes.position.x),
      //         y: Number(entity.attributes.position.y),
      //       },
      //       dragging: false,
      //     };
      //     templateInfo.nodes.push(node);

      //     if (entity.typeName != 'archetype_object') {
      //       const edge = {
      //         source: splitted[2],
      //         target: '',
      //         sourceHandle: null,
      //         targetHandle: null,
      //         id: '',
      //       };

      //       const name =
      //         entity.typeName == 'archetype_category'
      //           ? entity.relationshipAttributes.object.qualifiedName
      //           : entity.relationshipAttributes.category.qualifiedName;

      //       edge.target = name.split('@')[2];
      //       edge.id = `edge_${edge.source}_${edge.target}`;

      //       templateInfo.edges.push(edge);
      //     }
      //   }
      // }

      output.push(templateInfo);
    }

    return output;
  }

  async fetchArchetypes(projectId: string, token?: string) {
    const params = {
      typeName: 'archetype_template',
      attrName: `projectId`,
      attrValuePrefix: projectId,
    };
    try {
      const res = await this.atlas.get<AtlasSearchAttributeResponseDto>(
        '/search/attribute',
        params,
        token,
      );

      const entities = res?.entities ?? [];
      return entities.map((entity) => {
        this.logger.debug(entity);
        return {
          id: entity.guid,
          name: entity.displayText,
          status: entity.attributes?.status,
        };
      });
    } catch (err) {
      // translate to your API error if needed
      // throw new InternalServerErrorException('Atlas search failed');
      throw err;
    }
  }

  async createArchetype(username: string, archetype: ArchetypeDto) {
    await this.queue.addArchetypeJob(username, archetype);
  }

  // MAKE: entity call to Atlas
  async getArchetypeDetails(
    projectId: string,
    archetypeId: string,
    token?: string,
  ) {
    let activeTemplates = [];

    const params = {
      query: `from archetype_template where instance.projectId = "${projectId}" select __state, __guid, qualifiedName`,
    };
    await this.atlas
      .get<AtlasSearchDslAttributesResponseDto>('/search/dsl', params, token)
      .then((res) => {
        activeTemplates = res.attributes.values
          .filter((item) => item[0] === 'ACTIVE')
          .map((item) => {
            return {
              guid: item[1],
              name: item[2].split('@', 2)[1],
            };
          });
      })
      .catch(() => {
        activeTemplates = [];
      });

    return activeTemplates;
  }

  async deleteArchetype(projectId: string, archetypeId: string) {
    return await this.queue.deleteTemplateJob(projectId, archetypeId);
  }

  async getAnalysisArchetype(projectId: string, token?: string) {
    const activeTemplates = await this.fetchArchetypes(projectId, token);

    const output = [];
    for (const template of activeTemplates) {
      // const templateGuid = template.guid;

      const properties: Record<string, object> = {};
      const schema = {
        $schema: 'https://json-schema.org/draft/2020-12/schema#',
        title: template.name,
        type: 'object',
        properties,
      };

      // const templateEntity = await this.atlas.get(
      //   `/entity/guid/${templateGuid}`,
      //   undefined,
      //   token,
      // );

      // for (const key in templateEntity.referredEntities) {
      //   const entity = templateEntity.referredEntities[key];

      //   if (entity.typeName.includes('archetype_')) {
      //     if (entity.typeName != 'archetype_object') {
      //       const objectName = entity.attributes.qualifiedName;
      //       if (entity.relationshipAttributes.subcategories?.length) {
      //         const type = 'object';
      //         const properties: Record<string, object> = {};
      //         schema.properties[objectName] = { type, properties };
      //       }
      //       if (entity.relationshipAttributes.columns?.length) {
      //         const properties: Record<string, object> = {};
      //         for (const column of entity.relationshipAttributes.columns) {
      //           const { entity } = await this.atlas.get(
      //             `/entity/guid/${column.guid}`,
      //             undefined,
      //             token,
      //           );
      //           const jsonType = this.atlasTypeToJSONType(
      //             entity.attributes.data_type,
      //           );
      //           properties[objectName] = {
      //             type: jsonType,
      //           };
      //         }
      //         if (entity.relationshipAttributes.category) {
      //           schema.properties[
      //             entity.relationshipAttributes.category.qualifiedName
      //           ]['properties'] = {
      //             ...schema.properties[
      //               entity.relationshipAttributes.category.qualifiedName
      //             ]['properties'],
      //             ...properties,
      //           };
      //         } else {
      //           schema.properties = { ...schema.properties, ...properties };
      //         }
      //       }
      //     }
      //   }
      // }

      output.push(schema);
    }
    return output;
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

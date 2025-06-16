import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { AtlasService } from 'src/atlas/atlas.service';
import { DatabaseService } from 'src/database/database.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueueService } from 'src/queue/queue.service';
import { ArchetypeDto } from './dto';

@Injectable()
export class ArchetypeService {
  constructor(
    private prisma: PrismaService,
    private atlas: AtlasService,
    private readonly queue: QueueService,
    @Inject(forwardRef(() => DatabaseService))
    private databaseSource: DatabaseService,
  ) {}

  async archetypeNames(projectId: string, token?: string) {
    const dbId = await this.databaseSource.findDbId(projectId);

    let activeTemplates = [];

    const params = {
      query: `from archetype where instance.__guid = "${dbId}" select __state, __guid, qualifiedName, progress`,
    };
    await this.atlas
      .get('/search/dsl', params, token)
      .then((res) => {
        activeTemplates = res.attributes.values
          .filter((item) => item[0] === 'ACTIVE')
          .map((item) => {
            return {
              guid: item[1],
              name: item[2].split('@', 2)[1],
              progress: item[3],
            };
          });
      })
      .catch(() => {
        activeTemplates = [];
      });

    return activeTemplates;
  }

  async archetypes(projectId: string, token?: string) {
    const activeTemplates = await this.archetypeNames(projectId);

    const output = [];
    for (const template of activeTemplates) {
      const templateGuid = template.guid;
      const templateName = template.name;

      const templateInfo = {
        id: templateGuid,
        name: templateName,
        nodes: [],
        edges: [],
      };

      const templateEntity = await this.atlas.get(
        `/entity/guid/${templateGuid}`,
        undefined,
        token,
      );

      for (const key in templateEntity.referredEntities) {
        const entity = templateEntity.referredEntities[key];

        if (entity.typeName.includes('archetype_')) {
          const splitted = entity.attributes.qualifiedName.split('@');
          const node = {
            id: splitted[2],
            position: {
              x: Number(entity.attributes.position.x),
              y: Number(entity.attributes.position.y),
            },
            data: {
              label: entity.attributes.displayName,
            },
            type: entity.typeName.replace('archetype_', ''),
            width: entity.attributes.width,
            height: entity.attributes.height,
            selected: false,
            positionAbsolute: {
              x: Number(entity.attributes.position.x),
              y: Number(entity.attributes.position.y),
            },
            dragging: false,
          };
          templateInfo.nodes.push(node);

          if (entity.typeName != 'archetype_object') {
            const edge = {
              source: splitted[2],
              target: '',
              sourceHandle: null,
              targetHandle: null,
              id: '',
            };

            const name =
              entity.typeName == 'archetype_category'
                ? entity.relationshipAttributes.object.qualifiedName
                : entity.relationshipAttributes.category.qualifiedName;

            edge.target = name.split('@')[2];
            edge.id = `edge_${edge.source}_${edge.target}`;

            templateInfo.edges.push(edge);
          }
        }
      }

      output.push(templateInfo);
    }

    return output;
  }

  async deleteArchetype(template: ArchetypeDto) {
    return await this.queue.deleteTemplateJob(template);
  }

  async createArchetype(projectId: string, template: ArchetypeDto) {
    const dbId = await this.databaseSource.findDbId(projectId);
    await this.queue.addArchetypeJob(template, dbId);
  }
}

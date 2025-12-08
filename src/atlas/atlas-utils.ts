import {
  ArchetypeDto,
  ArchetypeEdgeDto,
  ArchetypeNodeDto,
  ArchetypeNodePermissionDto,
  ArchetypeNodeType,
} from 'src/archetype/dto';
import {
  AtlasArchetypeAnalysisPermissionClassificationDto,
  AtlasArchetypeEntityDto,
  AtlasArchetypeNodeType,
  AtlasArchetypeTypeName,
  AtlasExistingNode,
  AtlasSubmitArchetypeEntityDto,
} from 'src/atlas/dto';

export const hasAnalysisPermClassification = (
  guid: string,
  classifications: AtlasArchetypeEntityDto['classifications'] | undefined,
): boolean => {
  if (!guid || !classifications?.length) return false;
  return classifications.some(
    (c) =>
      c.typeName === 'archetype_node_analysis_permissions' &&
      c.entityGuid === guid &&
      c.entityStatus === 'ACTIVE',
  );
};

// TODO: move to archetype utils?
export const separateColumnsNodes = (archetype: ArchetypeDto) => {
  // separate columns from actual archetype_nodes
  if (archetype.nodes) {
    const [columns, nodes] = archetype.nodes.reduce<
      [ArchetypeNodeDto[], ArchetypeNodeDto[]]
    >(
      (acc, node) => {
        if (node.type === ArchetypeNodeType.Column) acc[0].push(node);
        else acc[1].push(node);
        return acc;
      },
      [[], []],
    );
    return { columns, nodes };
  }
  return { columns: [], nodes: [] };
};

export const getPermissionClassification = (
  nodeId: string,
  permissions: ArchetypeNodePermissionDto[],
): AtlasArchetypeEntityDto['classifications'] => {
  const classifications: AtlasArchetypeEntityDto['classifications'] = [];
  const permission = permissions.find((p) => p.id === nodeId)?.permission;
  if (permission) {
    classifications.push({
      typeName: 'archetype_node_analysis_permissions',
      propagate: true,
      removePropagationsOnEntityDelete: true,
      attributes: { access_level: permission },
    } as AtlasArchetypeAnalysisPermissionClassificationDto);
  }
  return classifications;
};

export const archetypeTemplateToAtlasEntities = (
  projectId: string,
  archetype: ArchetypeDto,
  nodes: ArchetypeNodeDto[],
  columns: ArchetypeNodeDto[],
  existingNodes: Record<string, AtlasExistingNode> = {},
  isUpdate: boolean = false,
  owner?: string,
  templateGuid?: string,
): { entities: AtlasSubmitArchetypeEntityDto[]; guidAssignments: string[] } => {
  // init negative guid
  let negativeGuid = -2;

  // nextGuid function
  const nextGuid = () => String(negativeGuid--);

  // Lookup for parent entities
  const parentLookup: Record<string, string> = {};

  // sort nodes by Id (needed for parent lookup)
  nodes.sort((a, b) => a.id.localeCompare(b.id));

  // get column edges if exists
  const columnEdges =
    archetype.edges?.filter((edge: ArchetypeEdgeDto) =>
      columns.find((e) => e.id === edge.target),
    ) || [];

  const guidAssignments: string[] = [];

  return {
    entities: nodes.map((node: ArchetypeNodeDto) => {
      // get column if exists
      const columnGuid = columnEdges.find((e) => e.source === node.id)?.target;

      // find parent node
      const parentId = archetype.edges?.find(
        (e) => e.target === node.id,
      )?.source;

      const parentIdQualifiedName = `${projectId}@${archetype.archetypeId}@${parentId}`;

      const currentGuid = nextGuid(); // decrease neg guid

      const qualifiedName = `${projectId}@${archetype.archetypeId}@${node.id}`;

      // update lookup for parent-child relationship
      // use qualifiedName if already existing node or negative guid if not
      parentLookup[node.id] =
        isUpdate && existingNodes[qualifiedName] ? qualifiedName : currentGuid;

      if (isUpdate && !existingNodes[qualifiedName])
        guidAssignments.push(currentGuid);
      return {
        // add GUID if new entity
        ...(isUpdate && existingNodes[qualifiedName]
          ? {}
          : { guid: currentGuid }),
        typeName: AtlasArchetypeTypeName.Node,
        status: 'ACTIVE',
        attributes: {
          label: node.data.label,
          // NOTE: needed for analysis SDK JSONSchema
          name: node.data.label,
          // only add new owner if not update
          ...(isUpdate && existingNodes[qualifiedName] ? {} : { owner }),
          level: node.data.level,
          qualifiedName,
          // set atlas node type
          // NOTE: should make it not optional
          type: getAtlasNodeType(columnGuid ? true : false, node.type),
          position: {
            x: node.position.x,
            y: node.position.y,
          },
        },
        ...(isUpdate && existingNodes[qualifiedName] // existing classifications don't update
          ? {}
          : {
              classifications: getPermissionClassification(
                node.id,
                archetype.permissions || [],
              ),
            }),
        relationshipAttributes: {
          // NOTE: Adds/updates relationships, but does NOT delete relationships
          //   e.g. column and child_nodes relationships will not get removed
          template: {
            typeName: AtlasArchetypeTypeName.Template,
            ...(templateGuid
              ? {
                  guid: templateGuid,
                }
              : {
                  uniqueAttributes: {
                    qualifiedName: `${projectId}@${archetype.archetypeId}`,
                  },
                }),
          },
          ...(parentId
            ? {
                parent_node: {
                  typeName: AtlasArchetypeTypeName.Node,
                  ...(isUpdate && existingNodes[parentIdQualifiedName]
                    ? {
                        uniqueAttributes: {
                          qualifiedName: parentLookup[parentId],
                        },
                      }
                    : { guid: parentLookup[parentId] }),
                },
              }
            : {}),
          ...(columnGuid
            ? { column: { guid: columnGuid, typeName: 'rdbms_column' } }
            : {}),
        },
      };
    }),
    guidAssignments,
  };
};

export const getDesiredChildNodeIdsForSource = (
  sourceNodeId: string,
  edges: ArchetypeEdgeDto[] | undefined,
  nodeIds: Set<string>,
): Set<string> =>
  new Set(
    (edges ?? [])
      .filter((e) => e.source === sourceNodeId && nodeIds.has(e.target))
      .map((e) => e.target),
  );

export const getDesiredColumnGuidForSource = (
  sourceNodeId: string,
  edges: ArchetypeEdgeDto[] | undefined,
  nodeIds: Set<string>,
): string | undefined => {
  const columnEdge = (edges ?? []).find(
    (e) => e.source === sourceNodeId && !nodeIds.has(e.target),
  );

  // If column edge was removed from this node, this will be undefined
  return columnEdge?.target; // atlas rdbms_column GUID
};

export const getAtlasNodeType = (
  isLeaf: boolean,
  archetypeNodeType: ArchetypeNodeType,
) =>
  isLeaf
    ? AtlasArchetypeNodeType.LEAF
    : archetypeNodeType === ArchetypeNodeType.Root
      ? AtlasArchetypeNodeType.ROOT
      : AtlasArchetypeNodeType.BRANCH;

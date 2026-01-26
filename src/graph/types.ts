import { ApiProperty } from '@nestjs/swagger';

export class GraphNode {
  @ApiProperty({
    description: 'Unique node identifier',
    example: 'node-1',
  })
  id: string;

  @ApiProperty({
    description: 'Node label text',
    example: 'Root Category',
  })
  label: string;

  @ApiProperty({
    description: 'Hierarchical depth (0 = root)',
    example: 0,
  })
  depth: number;

  @ApiProperty({
    description: 'Node color in hex format',
    example: '#0ea5e9',
  })
  colour: string;
}

export class GraphEdge {
  @ApiProperty({
    description: 'Source node ID (parent)',
    example: 'node-1',
  })
  source: string;

  @ApiProperty({
    description: 'Target node ID (child)',
    example: 'node-2',
  })
  target: string;
}

export class GraphPayload {
  @ApiProperty({
    description: 'Graph nodes',
    type: [GraphNode],
  })
  nodes: GraphNode[];

  @ApiProperty({
    description: 'Graph edges (parent → child)',
    type: [GraphEdge],
  })
  edges?: GraphEdge[];
}

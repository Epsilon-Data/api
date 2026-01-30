import { Injectable, Logger } from '@nestjs/common';
import chroma, { Color } from 'chroma-js';
import { LlmService } from '../llm/llm.service';
import { GraphNode, GraphPayload } from './types';

@Injectable()
export class GraphService {
  private readonly logger = new Logger('GraphService');

  constructor(private readonly llm: LlmService) {}

  async generateGraphFromFile(
    filename: string,
    filePath: string,
    mimetype: string,
    context?: string,
    modelId?: string,
  ): Promise<GraphPayload> {
    const raw = await this.llm.analyseFile(
      filename,
      filePath,
      mimetype,
      context,
      modelId,
    );

    this.logger.log(
      `Raw graph data received: ${JSON.stringify(raw)}, type of raw data: ${typeof raw}`,
    );

    const palette: chroma.Scale<Color> = chroma
      .scale(['#0ea5e9', '#eab308', '#ec4899'])
      .mode('lch');
    // Make color scaling more dynamic based on actual max depth
    const maxDepth = raw.nodes.reduce(
      (max, node) => Math.max(max, node.depth),
      0,
    );
    const nodes: GraphNode[] = raw.nodes.map((n) => ({
      ...n,
      colour: palette(maxDepth > 0 ? n.depth / maxDepth : 0).hex(),
    }));

    return { nodes, edges: raw.edges };
  }
}

/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { GraphService } from './graph.service';
import { LlmService } from '../llm/llm.service';
import { GraphPayload } from './types';

describe('GraphService', () => {
  let service: GraphService;
  let llmService: jest.Mocked<LlmService>;

  const mockAnalyseFileResponse: GraphPayload = {
    nodes: [
      { id: 'node_1', label: 'Root', depth: 0, colour: '#0ea5e9' },
      { id: 'node_2', label: 'Child A', depth: 1, colour: '#eab308' },
      { id: 'node_3', label: 'Child B', depth: 1, colour: '#eab308' },
      { id: 'node_4', label: 'Grandchild', depth: 2, colour: '#ec4899' },
    ],
    edges: [
      { source: 'node_1', target: 'node_2' },
      { source: 'node_1', target: 'node_3' },
      { source: 'node_2', target: 'node_4' },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GraphService,
        {
          provide: LlmService,
          useValue: {
            analyseFile: jest.fn(), // im not calling the actual function so we dont use up tokens
          },
        },
      ],
    }).compile();

    service = module.get(GraphService);
    llmService = module.get(LlmService);

    jest.clearAllMocks();
  });

  describe('generateGraphFromFile', () => {
    it('should assign colours scaled by depth and return nodes with edges', async () => {
      llmService.analyseFile.mockResolvedValueOnce(mockAnalyseFileResponse);

      const result = await service.generateGraphFromFile(
        'test.pdf',
        '/tmp/test.pdf',
        'application/pdf',
        'some context',
        'some-model-id',
      );

      expect(llmService.analyseFile).toHaveBeenCalledTimes(1);
      expect(llmService.analyseFile).toHaveBeenCalledWith(
        'test.pdf',
        '/tmp/test.pdf',
        'application/pdf',
        'some context',
        'some-model-id',
      );

      expect(result.edges).toEqual(mockAnalyseFileResponse.edges);

      expect(result.nodes).toHaveLength(4);
      result.nodes.forEach((node, i) => {
        expect(node.id).toBe(mockAnalyseFileResponse.nodes[i].id);
        expect(node.label).toBe(mockAnalyseFileResponse.nodes[i].label);
        expect(node.depth).toBe(mockAnalyseFileResponse.nodes[i].depth);
      });

      // colour is valid hex
      result.nodes.forEach((node) => {
        expect(node.colour).toMatch(/^#[0-9a-f]{6}$/i);
      });

      const rootColour = result.nodes.find((n) => n.depth === 0)?.colour;
      const leafColour = result.nodes.find((n) => n.depth === 2)?.colour;
      expect(rootColour).not.toBe(leafColour);
    });

    it('should handle a single node at depth 0', async () => {
      llmService.analyseFile.mockResolvedValueOnce({
        nodes: [{ id: 'solo', label: 'Alone', depth: 0, colour: '#ec4899' }],
        edges: [],
      });

      const result = await service.generateGraphFromFile(
        'single.pdf',
        '/tmp/single.pdf',
        'application/pdf',
      );

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].colour).toMatch(/^#[0-9a-f]{6}$/i);
      expect(result.edges).toEqual([]);
    });

    it('should work when optional context and modelId are not present', async () => {
      llmService.analyseFile.mockResolvedValueOnce(mockAnalyseFileResponse);

      const result = await service.generateGraphFromFile(
        'test.pdf',
        '/tmp/test.pdf',
        'application/pdf',
        // no context, no modelId
      );

      expect(llmService.analyseFile).toHaveBeenCalledWith(
        'test.pdf',
        '/tmp/test.pdf',
        'application/pdf',
        undefined,
        undefined,
      );

      expect(result.nodes).toHaveLength(4);
    });

    it('should propagate errors thrown by analyseFile', async () => {
      llmService.analyseFile.mockRejectedValueOnce(new Error('API timeout'));

      await expect(
        service.generateGraphFromFile(
          'bad.pdf',
          '/tmp/bad.pdf',
          'application/pdf',
        ),
      ).rejects.toThrow('API timeout');
    });
  });
});

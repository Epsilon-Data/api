import { Test, TestingModule } from '@nestjs/testing';
import { ArchetypeController } from './archetype.controller';

describe('ArchetypeController', () => {
  let archetypeController: ArchetypeController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ArchetypeController],
    }).compile();

    archetypeController = app.get<ArchetypeController>(ArchetypeController);
  });

  it('should be defined', () => {
    expect(archetypeController).toBeDefined();
  });

  // describe('health', () => {
  //   it('should return {"status":"OK","title":"Epsilon API Hub"}', () => {
  //     expect(archetypeController.getArchetype()).toStrictEqual(
  //       JSON.parse('{"status":"OK","title":"Epsilon API Hub"}'),
  //     );
  //   });
  // });
});

import { Transform } from 'class-transformer';
import { IsDefined, IsNotEmpty, IsUUID } from 'class-validator';

export class TemplateDto {
  @IsDefined()
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @IsDefined()
  @IsNotEmpty()
  @Transform(({ value }) => JSON.parse(value))
  template: JSON;
}

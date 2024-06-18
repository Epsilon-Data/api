import { Injectable } from '@nestjs/common';
import { CassandraService } from 'src/cassandra/cassandra.service';

@Injectable()
export class ScriptService {
  constructor(private cassandra: CassandraService) {}

  async runScript(filePath: string): Promise<string> {
    return filePath;
  }
}

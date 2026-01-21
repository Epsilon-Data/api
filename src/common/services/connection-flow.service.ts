import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueueService } from 'src/queue/queue.service';
import { VaultService } from 'src/vault/vault.service';
import { CurrentUserInfo } from 'src/common/decorators/user.decorator';
import { DatabaseInfoDto } from 'src/connection-request/dto';

@Injectable()
export class ConnectionFlowService {
  constructor(
    private prisma: PrismaService,
    private queue: QueueService,
    private readonly vaultService: VaultService,
  ) {}

  async run(
    user: CurrentUserInfo,
    projectId: string,
    requestId: string,
    dbDetails: DatabaseInfoDto,
    accessToken: string,
  ) {
    await this.prisma.project.update({
      where: { projectId },
      data: { status: 'CRAWLING' },
    });

    const token = await this.vaultService.auth(accessToken);

    const ciphertext = await this.vaultService.transitEncrypt(
      token,
      'connector-db',
      { ...dbDetails },
    );

    await this.vaultService.writeProjectCiphertext(
      token,
      projectId,
      ciphertext,
    );

    await this.queue.dataBrokerJob(
      user.username,
      projectId,
      requestId,
      dbDetails,
    );

    return;
  }
}

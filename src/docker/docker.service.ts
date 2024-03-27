import { Injectable } from '@nestjs/common';
import { DatabaseInfoDto } from 'src/connection_request/dto';
import * as Docker from 'dockerode';

@Injectable()
export class DockerService {
  private docker: Docker;

  constructor() {
    this.docker = new Docker();
  }

  async runDataBroker(id: string, database: DatabaseInfoDto): Promise<string> {
    const host =
      database.host == 'localhost' ? 'host.docker.internal' : database.host;
    const url = `${database.type}://${database.username}:${database.password}@${host}:${database.port}/${database.name}?sslmode=disable`;

    return new Promise((resolve, reject) => {
      this.docker.createContainer(
        {
          Image: 'go-packages-data_broker',
          name: 'data_broker_' + database.name,
          Env: [
            `DATABASE_URL=${url}`,
            'CASSANDRA_HOST=cassandra',
            'CASSANDRA_USERNAME=cassandra',
            'CASSANDRA_PASSWORD=cassandra',
            'CASSANDRA_KEYSPACE=source',
            'SOURCE_ID=' + id,
          ],
          NetworkingConfig: {
            EndpointsConfig: {
              epsilon_pg_internal: {},
              epsilon_cassandra_internal: {},
            },
          },
          HostConfig: {
            LogConfig: {
              Type: 'json-file',
              Config: {
                'max-size': '1024k',
                'max-file': '10',
              },
            },
          },
          AutoRemove: true,
        },
        function (err, container) {
          if (err) {
            console.log('create container error: ', err);
            reject(err);
          } else {
            container.start(function (err) {
              if (err) {
                console.log('start container error: ', err);
                reject(err);
              } else {
                container.wait(function (err) {
                  if (err) {
                    console.log('wait container error: ', err);
                    reject(err);
                  } else {
                    container.remove(function (err) {
                      if (err) {
                        console.log('remove container error: ', err);
                        reject(err);
                      } else {
                        resolve('success');
                      }
                    });
                  }
                });
              }
            });
          }
        },
      );
    });
  }
}

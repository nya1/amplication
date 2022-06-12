import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientKafka } from '@nestjs/microservices';
import { plainToClass } from 'class-transformer';
import { GENERATE_PULL_REQUEST_TOPIC } from 'src/constants';
import assert from 'assert';
import { SendPullRequestResponse } from '../build/dto/sendPullRequestResponse';
import { SendPullRequestArgs } from '../build/dto/sendPullRequest';
import { ResultMessage } from './dto/ResultMessage';

export const QUEUE_SERVICE_NAME = 'QUEUE_SERVICE';

@Injectable()
export class QueueService implements OnModuleInit {
  generatePullRequestTopic: string;
  constructor(
    @Inject(QUEUE_SERVICE_NAME)
    private readonly kafkaService: ClientKafka,
    configService: ConfigService
  ) {
    const envGeneratePullRequestTopic = configService.get<string>(
      GENERATE_PULL_REQUEST_TOPIC
    );
    assert(
      envGeneratePullRequestTopic,
      'Missing env for generate pull request topics'
    );
    this.generatePullRequestTopic = envGeneratePullRequestTopic;
  }
  onModuleInit(): void {
    this.kafkaService.subscribeToResponseOf(this.generatePullRequestTopic);
  }

  sendCreateGitPullRequest(
    data: SendPullRequestArgs
  ): Promise<SendPullRequestResponse | null> {
    return new Promise(res => {
      this.kafkaService
        .send(this.generatePullRequestTopic, data)
        .subscribe((response: ResultMessage<SendPullRequestResponse>) => {
          try {
            const validClass = plainToClass(
              SendPullRequestResponse,
              response.value
            );
            res(validClass);
          } catch (error) {
            res(null);
          }
        });
    });
  }
}

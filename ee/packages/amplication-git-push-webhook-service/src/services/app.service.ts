import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { EmitterWebhookEventName, Webhooks } from '@octokit/webhooks';
import { CreateRepositoryPushRequest } from '../entities/dto/CreateRepositoryPushRequest';
import { EnumProvider } from '../entities/enums/provider';
import { QueueService } from './queue.service';
import { ConfigService } from '@nestjs/config';
import { GitOrganizationRepository } from '../repositories/gitOrganization.repository';
import { PushEvent } from '@octokit/webhooks-types';
import { AppInterface } from '../contracts/app.interface';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

const WEBHOOKS_SECRET_KEY = 'WEBHOOKS_SECRET_KEY';

@Injectable()
export class AppService implements AppInterface {
  private webhooks: Webhooks;
  constructor(
    private readonly queueService: QueueService,
    configService: ConfigService,
    private readonly gitOrganizationRepository: GitOrganizationRepository,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {
    this.webhooks = new Webhooks({
      secret: configService.get<string>(WEBHOOKS_SECRET_KEY),
    });
  }

  async createMessage(
    id: string,
    eventName: EmitterWebhookEventName,
    payload: string,
    signature: string,
    provider: EnumProvider,
  ) {
    this.logger.log('start createMessage', { class: AppService.name, id });
    switch (eventName.toString().toLowerCase()) {
      case 'push':
        await this.createPushMessage(
          id,
          eventName,
          payload,
          signature,
          provider,
        );
        break;
      default:
        return;
    }
  }

  async createPushMessage(
    id: string,
    eventName: EmitterWebhookEventName,
    payload: string,
    signature: string,
    provider: EnumProvider,
  ) {
    const pushEventObj: PushEvent = JSON.parse(JSON.stringify(payload));
    if (!this.isMasterBranch(pushEventObj, id)) {
      return;
    }
    if (await !this.verifyAndReceive(id, eventName, payload, signature)) {
      return;
    }

    const pushRequest = await this.createPushRequestObject(pushEventObj, id);
    if (!this.isInstallationIdExist(pushRequest.installationId, provider, id)) {
      return;
    }
    await this.queueService.createPushRequest(pushRequest);
  }

  async isInstallationIdExist(
    installationId: string,
    provider: EnumProvider,
    id: string,
  ): Promise<boolean> {
    const { installationId: gitInstallationId } =
      await this.gitOrganizationRepository.getOrganizationByInstallationId(
        installationId,
        provider,
      );
    if (gitInstallationId) return true;
    this.logger.log(
      `createWebhooksMessage not send, installationId: ${installationId} does not exist`,
      { class: AppService.name, id },
    );
    return false;
  }

  async verifyAndReceive(
    id: string,
    eventName: EmitterWebhookEventName,
    payload: string,
    signature: string,
  ): Promise<boolean> {
    try {
      await this.webhooks.verifyAndReceive({
        id: id,
        name: eventName,
        payload: payload,
        signature: signature,
      });
    } catch (error) {
      this.logger.error(
        `failed to createWebhooksMessage: verifyAndReceive, error: ${error}`,
        { class: AppService.name, id },
      );
      return false;
    }
    return true;
  }

  getBranchName(fullName: string): string {
    const splitName = fullName.split('/');
    return splitName[2];
  }

  isMasterBranch(payload: PushEvent, id: string): boolean {
    const currentBranch = this.getBranchName(payload.ref);
    const masterBranch = payload.repository.master_branch;
    if (currentBranch === masterBranch) return true;
    this.logger.log(
      `createWebhooksMessage not send, not master branch, branch name: ${payload.ref}`,
      { class: AppService.name, id },
    );
    return false;
  }

  async createPushRequestObject(
    payload: PushEvent,
    id: string,
  ): Promise<CreateRepositoryPushRequest> {
    const req: CreateRepositoryPushRequest = {
      provider: EnumProvider.Github,
      repositoryOwner: payload.repository.owner.login,
      repositoryName: payload.repository.name,
      branch: await this.getBranchName(payload.ref),
      commit: payload.head_commit.id,
      pushedAt: new Date(
        this.intTryParse(payload.repository.pushed_at.toString()) * 1000,
      ),
      installationId: payload.installation.id.toString(),
      messageId: id,
    };
    return req;
  }

  private intTryParse(value: string): number {
    let res = 0;
    try {
      res = parseInt(value);
    } catch (error) {}
    return res;
  }
}

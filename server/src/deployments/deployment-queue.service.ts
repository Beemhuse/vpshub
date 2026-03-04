import { Injectable, Logger } from '@nestjs/common';

export enum DeploymentState {
  QUEUED = 'queued',
  BUILDING = 'building',
  DEPLOYING = 'deploying',
  ACTIVE = 'completed',
  FAILED = 'failed',
}

export interface DeploymentTask {
  id: string;
  deploymentId: string;
  serverId: string;
  userId: string;
  attempt: number;
}

@Injectable()
export class DeploymentQueueService {
  private readonly logger = new Logger(DeploymentQueueService.name);
  private queue: DeploymentTask[] = [];
  private processing = false;
  private workerCallback: (task: DeploymentTask) => Promise<void>;

  constructor() {}

  setWorker(callback: (task: DeploymentTask) => Promise<void>) {
    this.workerCallback = callback;
  }

  async add(taskData: Omit<DeploymentTask, 'attempt'>) {
    const task: DeploymentTask = { ...taskData, attempt: 0 };
    this.queue.push(task);
    this.logger.log(
      `Added deployment ${task.deploymentId} to queue (Size: ${this.queue.length})`,
    );

    if (!this.processing) {
      this.processNext();
    }
  }

  private async processNext() {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const task = this.queue.shift();

    if (!task) return this.processNext();

    try {
      this.logger.log(
        `Processing deployment ${task.deploymentId} (Attempt: ${task.attempt + 1})`,
      );
      if (this.workerCallback) {
        await this.workerCallback(task);
      } else {
        this.logger.error(
          'No worker callback registered for DeploymentQueueService',
        );
      }
    } catch (error) {
      this.logger.error(
        `Deployment ${task.deploymentId} failed: ${error.message}`,
      );

      if (task.attempt < 2) {
        task.attempt++;
        this.queue.push(task);
        this.logger.log(
          `Re-queued deployment ${task.deploymentId} (Attempt: ${task.attempt + 1})`,
        );
      }
    } finally {
      // Small delay between tasks
      setTimeout(() => this.processNext(), 1000);
    }
  }

  getQueueStatus() {
    return {
      size: this.queue.length,
      isProcessing: this.processing,
    };
  }
}

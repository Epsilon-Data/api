import { Injectable } from '@nestjs/common';

type JobFn<T> = () => Promise<T>;
type JobStatus<T> =
  | { status: 'pending' }
  | { status: 'completed'; result: T }
  | { status: 'error'; error: string };

@Injectable()
export class JobsService {
  private readonly store = new Map<string, JobStatus<unknown>>();

  enqueue<T>(id: string, fn: JobFn<T>) {
    this.store.set(id, { status: 'pending' });
    fn()
      .then((r) => this.store.set(id, { status: 'completed', result: r }))
      .catch((e: unknown) => {
        console.error('Job failed', e);
        const errorMessage = e instanceof Error ? e.message : JSON.stringify(e);
        this.store.set(id, { status: 'error', error: errorMessage });
      });
  }

  status<T>(id: string): JobStatus<T> | undefined {
    return this.store.get(id) as JobStatus<T> | undefined;
  }
}

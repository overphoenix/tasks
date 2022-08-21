import {
  isNumber,
  isFunction,
  isPromise,
  promise,
  NotAllowedException
} from "@recalibratedsystems/common";
import { BaseTask } from "./base_task";
import { OBSERVER_SYMBOL, TaskInfo, TaskState } from "./common";

export class TaskObserver {
  public state: TaskState = TaskState.IDLE;
  public result: any;
  public error: any;

  constructor(public task: BaseTask, public taskInfo: TaskInfo) {
    this.task[OBSERVER_SYMBOL] = this;
  }

  get taskName() {
    return this.taskInfo.name;
  }

  set taskName(val) {
    throw new NotAllowedException("Property 'taskName' is immutable");
  }

  /**
     * Cancels task.
     */
  async cancel() {
    if (!this.cancelable) {
      throw new NotAllowedException(`Task '${this.taskInfo.name}' is not cancelable`);
    }
    if (this.state === TaskState.RUNNING) {
      this.state = TaskState.CANCELLING;
      const d = promise.defer();
      await this.task.cancel(d);
      await d.promise;
    }
  }

  /**
     * Pauses task.
     * 
     * @param {number} ms If provided, the task will be resumed after the specified timeout.
     * @param {function} callback Is used only in conjunction with the 'ms' parameter, otherwise will be ignored.
     */
  async suspend(ms: number, callback: (() => any)) {
    if (this.suspendable) {
      switch (this.state) {
        case TaskState.CANCELLED:
        case TaskState.COMPLETED:
          return isNumber(ms) && isFunction(callback) && callback();
      }
      const d = promise.defer();
      await this.task.suspend(d);
      await d.promise;
      this.state = TaskState.SUSPENDED;
      if (isNumber(ms)) {
        setTimeout(() => {
          if (isFunction(callback)) {
            callback();
          }
          this.resume();
        }, ms);
      }
    }
  }

  /**
     * Resumes task.
     */
  async resume() {
    if (this.state === TaskState.SUSPENDED) {
      const d = promise.defer();
      await this.task.resume(d);
      await d.promise;
      this.state = TaskState.RUNNING;
    }
  }

  async finally(fn: (() => any)) {
    if (isPromise(this.result)) {
      this.result = this.result.then(async (result: any) => {
        await fn();
        return result;
      }).catch(async (err: any) => {
        await fn();
        throw err;
      });
    } else {
      await fn();
    }
  }

  /**
     * Returns true if the task is suspendable.
     */
  get suspendable() {
    return this.taskInfo.suspendable;
  }

  /**
     * Returns true if the task is cancelable.
     */
  get cancelable() {
    return this.taskInfo.cancelable;
  }

  /**
     * Returns true if the task was running.
     */
  get running() {
    return this.state === TaskState.RUNNING;
  }

  /**
     * Returns true if the task was canceled.
     */
  get cancelled() {
    return this.state === TaskState.CANCELLED;
  }

  /**
     * Returns true if the task was completed.
     */
  get completed() {
    return this.state === TaskState.COMPLETED;
  }

  /**
     * Returns true if the task was finished.
     */
  get failed() {
    return this.state === TaskState.FAILED;
  }

  /**
     * Returns true if the task was finished.
     */
  get finished() {
    return this.state === TaskState.CANCELLED || this.state === TaskState.COMPLETED;
  }

  /**
     * Returns true if the task is suspended.
     */
  get suspended() {
    return this.state === TaskState.SUSPENDED;
  }
}

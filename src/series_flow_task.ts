import { FlowTask } from "./flow_task";
import { TaskObserver } from "./task_observer";

/**
 * This flow run the tasks in series, each one running once the previous task has completed.
 * If any task in the series throw, no more tasks are run.
 * If all tasks has finished, the result will be an array of all tasks results.
 */
export default class SeriesFlowTask extends FlowTask {
  private shouldStop: boolean = false;
  private activeObserver?: TaskObserver;

  async main() {
    this.result = [];
    this.shouldStop = false;

    await this._iterate(async (observer: TaskObserver): Promise<boolean> => {
      if (!this.shouldStop) {
        this.activeObserver = observer;
        this.result.push(await observer.result);
      }

      return false;
    });
  }

  cancel(defer: any) {
    this.shouldStop = true;

    if (this.activeObserver && this.activeObserver.cancelable) {
      return this.activeObserver.cancel().then(() => defer.resolve());
    }
  }
}

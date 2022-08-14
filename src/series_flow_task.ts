import { FlowTask } from "./flow_task";
import { TaskObserver } from "./task_observer";

/**
 * This flow run the tasks in series, each one running once the previous task has completed.
 * If any task in the series throw, no more tasks are run.
 * If all tasks has finished, the result will be an array of all tasks results.
 */
export default class SeriesFlowTask extends FlowTask {
  private shouldStop: boolean;
  private activeObserver?: TaskObserver;

  async main() {
    const results: any[] = [];
    this.shouldStop = false;

    await this._iterate(async (observer) => {
      if (!this.shouldStop) {
        this.activeObserver = observer;
        results.push(await observer.result);
      }
    });

    return results;
  }

  cancel(defer) {
    this.shouldStop = true;

    if (this.activeObserver && this.activeObserver.cancelable) {
      return this.activeObserver.cancel().then(() => defer.resolve());
    }
  }
}
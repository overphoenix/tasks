import { FlowTask } from "./flow_task";
import { TaskObserver } from "./task_observer";

/**
 * This flow run the tasks in parallel, and returns the result of first completed task or throw if task is rejected.
 */
export default class RaceFlowTask extends FlowTask {
  async main() {
    const promises: Promise<any>[] = [];

    await this._iterate((observer: TaskObserver): boolean => {
      promises.push(observer.result);

      return false;
    });

    this.result = Promise.race(promises);
  }
}

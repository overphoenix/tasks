import { noop, isPromise } from "@recalibratedsystems/common-cjs";
import { FlowTask } from "./flow_task";
import { TaskObserver } from "./task_observer";


/**
 * This flow run the tasks in parallel, without waiting until the previous task has completed.
 * If any of the task throw, the remaining tasks will continue to be performed, but in this case results of these tasks will be unavailable.
 * Once the tasks have completed, the results are passed as object where keys are names of the tasks and values are results.
 */
export default class ParallelFlowTask extends FlowTask {
  async main(): Promise<any[]> {
    const results: any[] = [];
    const promises: Promise<any>[] = [];
    await this._iterate((observer: TaskObserver): boolean => {
      let result = observer.result;
      if (!isPromise(result)) {
        result = Promise.resolve(result);
      }

      result.then((result: any) => {
        results.push(result);
      }).catch(noop);
      promises.push(result);
      
      return false;
    });

    await Promise.all(promises);

    return results;
  }

  /**
     * Cancel only cancelable tasks and await result of non-cancelable.
     */
  cancel(defer: any) {
    const promises: Promise<any>[] = [];
    for (const observer of this.observers) {
      if (observer.cancelable) {
        promises.push(observer.cancel());
      } else {
        promises.push(observer.result);
      }
    }

    return Promise.all(promises).then(() => defer.resolve());

  }
}

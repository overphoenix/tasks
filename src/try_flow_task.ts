import { AggregateException } from "@recalibratedsystems/common-cjs";
import { FlowTask } from "./flow_task";
import { TaskObserver } from "./task_observer";

/**
 * This flow runs each task in series but stops whenever any of the task were successful and the result of this task will be returned.
 * If all tasks fail, flow throw AggregateException with all errors.
 */
export default class TryFlowTask extends FlowTask {
  async main() {
    const errors: any[] = [];

    await this._iterate(async (observer: TaskObserver): Promise<boolean> => {
      try {
        this.result = await observer.result;
        return true;
      } catch (err) {
        errors.push(err);
      }

      return false;
    });

    if (this.tasks.length === errors.length) {
      throw new AggregateException(errors);
    }
  }
}

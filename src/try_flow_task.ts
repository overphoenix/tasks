import { AggregateException } from "@recalibratedsystems/common/error";
import { FlowTask } from "./flow_task";

/**
 * This flow runs each task in series but stops whenever any of the task were successful and the result of this task will be returned.
 * If all tasks fail, flow throw AggregateException with all errors.
 */
export default class TryFlowTask extends FlowTask {
  async main() {
    let result;
    const errors: any[] = [];

    await this._iterate(async (observer) => {
      try {
        result = await observer.result;
        return true;
      } catch (err) {
        errors.push(err);
      }
    });

    if (this.tasks.length === errors.length) {
      throw new AggregateException(errors);
    }

    return result;
  }
}

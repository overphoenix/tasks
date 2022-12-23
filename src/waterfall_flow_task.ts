import { arrify } from "@recalibratedsystems/common-cjs";
import { FlowTask } from "./flow_task";

/**
 * This flow runs the tasks in series, but result of each task passing to the next task in the array.
 * If any task in the series throw, no more tasks are run.
 * If all tasks has finished, result of the last task will be returned.
 */
export class WaterfallFlowTask extends FlowTask {
  async main(arg: any) {
    this.result = arg;

    for (const t of this.tasks) {
      const observer = await this._runTask(t.task, this.result);
      this.result = await observer.result;
    }
  }
}

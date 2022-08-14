import { ImmutableException, NotImplementedException } from "@recalibratedsystems/common/error";
import { MANAGER_SYMBOL, OBSERVER_SYMBOL } from "./common";
import { TaskManager } from "./manager";
import { TaskObserver } from "./task_observer";

export class BaseTask {
  constructor() {
    this[MANAGER_SYMBOL] = null;
    this[OBSERVER_SYMBOL] = null;
  }

  get observer(): TaskObserver {
    return this[OBSERVER_SYMBOL];
  }

  set observer(val) {
    throw new ImmutableException("Task's 'observer' is immutable");
  }

  get manager(): TaskManager {
    return this[MANAGER_SYMBOL];
  }

  set manager(val) {
    throw new ImmutableException("Task's 'manager' is immutable");
  }

  /**
     * Actual task implementation.
     * 
     * @return {any}
     */
  main(...args) {
    throw new NotImplementedException("Method main() is not implemented");
  }

  /**
     * This method that the manager actually calls when performing the task.
     * 
     * If you need some custom steps before the actual task's code run, you should override this method.
     * 
     * @param  {...any} args 
     */
  _run(...args: any[]) {
    return this.main(...args);
  }

  /**
     * Suspends task. Should be implemented in derived class.
     */
  suspend(...args) {
  }

  /**
     * Resumes task. Should be implemented in derived class.
     */
  resume(...args) {
  }

  /**
     * Cancels task. Should be implemented in derived class.
     */
  cancel(...args) {
  }
}

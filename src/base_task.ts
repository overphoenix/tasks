import { ImmutableException, NotImplementedException, NotValidException } from "@recalibratedsystems/common-cjs";
import { MANAGER_SYMBOL, OBSERVER_SYMBOL } from "./common";
import { TaskManager } from "./manager";
import { TaskObserver } from "./task_observer";

export class BaseTask {
  [MANAGER_SYMBOL]: TaskManager | null;
  [OBSERVER_SYMBOL]: TaskObserver | null;

  public result: any;

  constructor() {
    this[MANAGER_SYMBOL] = null;
    this[OBSERVER_SYMBOL] = null;
  }

  get observer(): TaskObserver {
    if (this[OBSERVER_SYMBOL] === null) {
      throw new NotValidException("Task observer is not attached");
    }
    return this[OBSERVER_SYMBOL] as TaskObserver;
  }

  set observer(val) {
    throw new ImmutableException("Task's 'observer' is immutable");
  }

  get manager(): TaskManager {
    if (this[MANAGER_SYMBOL] === null) {
      throw new NotValidException("Task manager is not attached");
    }
    return this[MANAGER_SYMBOL] as TaskManager;
  }

  set manager(val) {
    throw new ImmutableException("Task's 'manager' is immutable");
  }

  /**
     * Actual task implementation.
     * 
     * @return {any}
     */
  main(...args: any[]) {
    throw new NotImplementedException("Method main() is not implemented");
  }

  /**
     * This method that the manager actually calls when performing the task.
     * 
     * If you need some custom steps before the actual task's code run, you should override this method.
     * 
     * @param  {...any} args 
     */
  async _run(...args: any[]) {
    await this.main(...args);
    return this.result;
  }

  /**
     * Suspends task. Should be implemented in derived class.
     */
  suspend(...args: any[]) {
  }

  /**
     * Resumes task. Should be implemented in derived class.
     */
  resume(...args: any[]) {
  }

  /**
     * Cancels task. Should be implemented in derived class.
     */
  cancel(...args: any[]) {
  }
}

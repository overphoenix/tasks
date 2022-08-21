import { IsomorphicTask } from "./isomorphic_task";

// TODO: tests
export class AdvancedTask extends IsomorphicTask {
  public result: any;

  async _run(...args: any[]) {
    this._validateArgs(args);
    try {
      await this.initialize(...args);
      this.result = await this.main(...args);
      await this.uninitialize(...args);
    } catch (err) {
      await this.error(err);
      return;
    }
    return this.result;
  }

  async runAnotherTask(name: string, ...args: any[]) {
    return this.manager.runAndWait(name, ...args);
  }

  /**
     * The method in which you can implement the initializing logic and is called before the main() method.
     */
  initialize(...args: any[]) {
  }

  /**
     * The method in which you can implement the final logic and is called after the main() method.
     */
  uninitialize(...args: any[]) {
  }

  /**
     * Calls in case of error.
     *
     * @param {Error} err
     */
  error(err: any) {
    throw err;
  }
}
import { IsomorphicTask } from "../lib/isomorphic_task";

// TODO: tests
export class AdvancedTask extends IsomorphicTask {
  public result: any;

  async _run(...args) {
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

  async runAnotherTask(name, ...args) {
    return this.manager.runAndWait(name, ...args);
  }

  /**
     * The method in which you can implement the initializing logic and is called before the main() method.
     */
  initialize(...args) {
  }

  /**
     * The method in which you can implement the final logic and is called after the main() method.
     */
  uninitialize(...args) {
  }

  /**
     * Calls in case of error.
     *
     * @param {Error} err
     */
  error(err) {
    throw err;
  }
}

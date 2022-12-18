import {
  typeOf,
  InvalidNumberOfArgumentsException,
  InvalidArgumentException
} from "@recalibratedsystems/common-cjs";
import { BaseTask } from "./base_task";

const ALLOWED_TYPES = ["Object", "undefined", "null"];

/**
 * Isomorphic task taskes only one argument as Object instead of many arguments.
 * 
 * In this case, you don’t need to know the task execution signature, which facilitates the interaction between tasks,
 * allows you to load parameters from configuration files or other sources.
 */
export class IsomorphicTask extends BaseTask {
  async _run(...args: any[]) {
    return this.main(this._validateArgs(args));
  }

  _validateArgs(args: any[]) {
    if (args.length > 1) {
      throw new InvalidNumberOfArgumentsException(`Isomorphic task takes nothing or only one argument of type Object. Received ${args.length} arguments`);
    }

    if (!ALLOWED_TYPES.includes(typeOf(args[0]))) {
      throw new InvalidArgumentException(`Isomorphic task takes only argument of type Object. Received ${typeOf(args[0])}`);
    }

    return args[0];
  }
}

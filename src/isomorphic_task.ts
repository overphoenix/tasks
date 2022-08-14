import { InvalidNumberOfArgumentsException, InvalidArgumentException } from "@recalibratedsystems/common/error";
import typeOf from "@recalibratedsystems/common/typeof";
import { BaseTask } from "./base_task";

const ALLOWED_TYPES = ["Object", "global", "ateos", "undefined", "null"];

/**
 * Isomorphic task taskes only one argument as Object instead of many arguments.
 * 
 * In this case, you don’t need to know the task execution signature, which facilitates the interaction between tasks,
 * allows you to load parameters from configuration files or other sources and to use the latest features of the ESNext.
 */
export class IsomorphicTask extends BaseTask {
  async _run(...args) {
    return this.main(this._validateArgs(args));
  }

  _validateArgs(args) {
    if (args.length > 1) {
      throw new InvalidNumberOfArgumentsException(`Isomorphic task takes nothing or only one argument of type Object. Received ${args.length} arguments`);
    }

    if (!ALLOWED_TYPES.includes(typeOf(args[0]))) {
      throw new InvalidArgumentException(`Isomorphic task takes only argument of type Object. Received ${typeOf(args[0])}`);
    }

    return args[0];
  }
}

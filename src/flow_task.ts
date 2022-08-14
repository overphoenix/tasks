import { arrify, isExist, isFunction, isString, isObject } from "@recalibratedsystems/common";
import typeOf from "@recalibratedsystems/common/typeof";
import { NotValidException, NotAllowedException, NotExistsException } from "@recalibratedsystems/common/error";
import { IsomorphicTask } from "./isomorphic_task";
import { TaskObserver } from "./task_observer";


const normalizeAndCheck = (manager, tasks) => {
  const result: any[] = [];
  for (const t of tasks) {
    let item;
    if (isString(t) || isFunction(t)/* || ateos.isClass(t)*/) {
      item = {
        task: t
      };
    } else if (isObject(t)) {
      if (!isExist(t.task)) {
        throw new NotValidException("Missing task property");
      }
      item = t;
    } else {
      throw new NotValidException(`Invalid type of task: ${typeOf(t)}. Should be string, class or function`);
    }

    if (isString(item.task)) {
      if (!manager.hasTask(item.task)) {
        throw new NotExistsException(`Task '${item.task}' not exists`);
      }
    }

    result.push(item);
  }

  return result;
};

/**
 * This task implements common logic for running flows.
 *
 * See other flow tasks for details.
 */
export class FlowTask extends IsomorphicTask {
  public tasks: any[] = [];
  private args: any[] = [];
  public observers: TaskObserver[] = [];

  _run(...args) {
    const taskData = this._validateArgs(args);

    this.tasks = normalizeAndCheck(this.manager, taskData.tasks);
    this.args = arrify(taskData.args);
    this.observers = [];
    // this.options = options;

    return this.main(...this.args);
  }

  async _iterate(handler) {
    for (const t of this.tasks) {
      const args = isExist(t.args)
        ? arrify(t.args)
        : this.args;
      const observer = await this._runTask(t.task, args);
      this.observers.push(observer);

      if (await handler(observer)) {
        break;
      }
    }
  }

  _runTask(task, args) {
    if (isString(task)) {
      return this.manager.run(task, ...args);
    } else if (isFunction(task)/* || ateos.isClass(task)*/) {
      return this.manager.runOnce(task, ...args);
    }

    throw new NotAllowedException(`Invalid type of task: ${typeOf(task)}`);
  }
}

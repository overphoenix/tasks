import {
  arrify,
  isExist,
  isFunction,
  isString,
  isObject,
  typeOf,
  NotValidException, NotAllowedException, NotExistsException
} from "@recalibratedsystems/common-cjs";
import { TaskManager } from "./manager";
import { IsomorphicTask } from "./isomorphic_task";
import { TaskObserver } from "./task_observer";


const normalizeAndCheck = (manager: TaskManager, tasks: any[]) => {
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
  private arg: any;
  public observers: TaskObserver[] = [];

  async _run(...args: any[]) {
    const taskData = this._validateArgs(args);

    this.tasks = normalizeAndCheck(this.manager, taskData.tasks);
    this.arg = taskData.arg;
    this.observers = [];

    await this.main(this.arg);
    return this.result;
  }

  async _iterate(handler: ((o: TaskObserver) => boolean | Promise<boolean>)) {
    for (const t of this.tasks) {
      const observer = await this._runTask(t.task, Object.assign({}, t.args, this.arg || {}));
      this.observers.push(observer);

      if (await handler(observer)) {
        break;
      }
    }
  }

  _runTask(task: any, arg: any) {
    if (isString(task)) {
      return this.manager.run(task, arg);
    } else if (isFunction(task)/* || ateos.isClass(task)*/) {
      return this.manager.runOnce(task, arg);
    }

    throw new NotAllowedException(`Invalid type of task: ${typeOf(task)}`);
  }
}

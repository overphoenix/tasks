import {
  isArray,
  isBoolean,
  isNumber,
  isFunction,
  isPlainObject,
  isClass,
  isString,
  isObject,
  isPromise,
  isUndefined
} from "@recalibratedsystems/common";
import * as upath from "upath";
import * as fs from "fs";
import typeOf from "@recalibratedsystems/common/typeof";
import { identity, noop, truly } from "@recalibratedsystems/common";
import { AsyncEventEmitter } from "@recalibratedsystems/common/async_event_emitter";
import { finally as _finally } from "@recalibratedsystems/common/promise";
import { throttle } from "@recalibratedsystems/common/throttle";
import { NotExistsException, InvalidArgumentException, ExistsException, NotValidException, NotAllowedException } from "@recalibratedsystems/common/error";
import { TaskObserver } from "./task_observer";
import { BaseTask } from "./base_task";
import { getTaskMeta, MANAGER_SYMBOL, TaskInfo, TaskState } from "./common";
import { customAlphabet } from "nanoid";
import { isTask } from "./predicates";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz", 16);

const ANY_NOTIFICATION = Symbol();

const DUMMY_THROTTLE = (tsk) => tsk();

const getOptionValue = (arg, meta, predicate, def) => predicate(arg)
  ? arg
  : predicate(meta)
    ? meta
    : def;


/**
 * Basic implementation of task manager that owns and manages tasks.
 * 
 * 
 * 
 * To implement more advanced manager you should inherit this class.
 */
export class TaskManager extends AsyncEventEmitter {
  static DEFAULT_LOAD_POLICY = "throw";

  private tasks = new Map<string, TaskInfo>();

  private domains = new Map();

  private notifications = new Map();

  constructor() {
    super();
    this.notifications.set(ANY_NOTIFICATION, []);
  }

  /**
     * Adds or replaces task with specified name.
     * 
     * @param {string} name task name
     * @param {class|function} task task class inherited from {BaseTask} or function
     * @param {object} options 
     */
  addTask(options: any) {
    if (isClass(options.task)) {
      const taskInstance = new options.task();

      if (!isTask(taskInstance)) {
        throw new NotValidException("The task class should be inherited from 'ateos.task.Task' class");
      }
    } else if (!isFunction(options.task)) {
      throw new NotValidException("Task should be a class or a function");
    }

    let name;
    if (!isString(options.name)) {
      const meta = getTaskMeta(options.task);
      if (isString(meta)) {
        name = meta;
      } else if (isObject(meta)) {
        name = meta.name;
      }

      if (!name && isClass(options.task)) {
        name = options.task.name;
      }

      if (!name) {
        throw new NotValidException(`Invalid name of task: ${name}`);
      }
    } else {
      name = options.name;
    }

    const hasTask = this.tasks.has(name);

    if (options.loadPolicy === "throw") {
      if (hasTask) {
        throw new ExistsException(`Task '${name}' already exists`);
      }
    } else if (options.loadPolicy === "ignore") {
      if (hasTask) {
        return false;
      }
    } else if (options.loadPolicy === "replace") {
      // Nothing to do...
      // But, in this case we need check previous task state and if task is busy we should wait for it completion.
    }

    const taskInfo = this.initTaskInfo(options.task, name, options);

    let TaskClass;
    if (isClass(options.task)) {
      TaskClass = options.task;
    } else if (isFunction(options.task)) {
      TaskClass = class extends BaseTask {
        main(...args) {
          return options.task.apply(this, args);
        }
      };
    } else {
      throw new InvalidArgumentException(`Invalid type of task argument: ${typeOf(options.task)}`);
    }

    taskInfo.Class = TaskClass;
    return this.installTask(taskInfo);
  }

  // /**
  //    * Loads tasks from specified location(s).
  //    * 
  //    * @param {string|array} path  list of locations from which tasks be loaded
  //    * @param {string} options.policy load policy:
  //    * - throw (default): throw an exception if a task with the same name is already loaded
  //    * - ignore: ignore tasks of the same name
  //    * - replace: replace loaded task by newtask with same name
  //    */
  // async loadTasksFrom(path, { transpile = false, domain, ignore, ignoreExts = [".map"], ...taskOptions } = {}) {
  //   let paths;
  //   if (isString(path)) {
  //     paths = util.arrify(path);
  //   } else if (isArray(path)) {
  //     paths = path;
  //   } else {
  //     throw new InvalidArgumentException("Invalid 'path' argument");
  //   }

  //   ignore = util.arrify(ignore);

  //   for (const p of paths) {
  //     if (!(await fs.pathExists(p))) {
  //       continue;
  //     }

  //     let files;
  //     if (await fs.isDirectory(p)) {
  //       files = await fs.readdir(p);
  //     } else {
  //       files = [p];
  //     }

  //     for (const f of files) {
  //       if (ignoreExts.includes(upath.extname(f)) || ignore.includes(f)) {
  //         continue;
  //       }
  //       let fullPath;
  //       try {
  //         fullPath = ateos.module.resolve(upath.join(p, f));
  //       } catch (err) {
  //         continue;
  //       }

  //       if (await fs.isDirectory(fullPath)) {
  //         continue;
  //       }

  //       let modExports;

  //       try {
  //         modExports = (transpile)
  //           ? ateos.require(fullPath)
  //           : require(fullPath);
  //       } catch (err) {
  //         console.error(err);
  //         // ignore non javascript files
  //         continue;
  //       }
  //       if (modExports.default) {
  //         modExports = modExports.default;
  //       }

  //       let tasks;
  //       if (isClass(modExports)) {
  //         tasks = [modExports];
  //       } else if (isPlainObject(modExports)) {
  //         tasks = [...Object.values(modExports)];
  //       } else {
  //         continue;
  //       }

  //       for (const task of tasks) {
  //         // console.log(fullPath);
  //         await this.addTask({
  //           ...taskOptions,
  //           task,
  //           domain
  //         });
  //       }
  //     }
  //   }
  // }

  /**
     * Returns task info.
     * 
     * @param {object} name task name
     */
  getTask(name) {
    return this.getTaskInfo(name);
  }

  /**
     * Returns task class.
     * 
     * @param {string} name task name
     */
  getTaskClass(name) {
    const taskInfo = this.getTaskInfo(name);
    return taskInfo.Class;
  }

  /**
     * Returns tasks info by domain.
     * 
     * @param {*} name 
     */
  getTasksByDomain(domain) {
    const tasks = this.domains.get(domain);
    if (isUndefined(tasks)) {
      return [];
    }
    return tasks;
  }

  /**
     * Returns task instance.
     * 
     * @param {string} name task name
     */
  getTaskInstance(name) {
    return this.createTaskInstance(this.getTaskInfo(name));
  }

  /**
     * Returns true if task with such name owned by the manager.
     * @param {string} name 
     */
  hasTask(name) {
    return this.tasks.has(name);
  }

  /**
     * Deletes task with specified name.
     * 
     * @param {string} name 
     */
  deleteTask(name) {
    const taskInfo = this.getTaskInfo(name);
    if (taskInfo.runners.size > 0) {
      taskInfo.zombi = true;
    } else {
      return this.uninstallTask(taskInfo);
    }
  }

  /**
     * Deletes all tasks.
     */
  async deleteAllTasks() {
    const names = this.getTaskNames();
    for (const name of names) {
      // eslint-disable-next-line no-await-in-loop
      await this.deleteTask(name);
    }
  }

  /**
     * Deletes all tasks with domain
     * @param {*} domain 
     */
  async deleteTasksByDomain(domain) {
    const names = this.getTaskNames(domain);
    for (const name of names) {
      // eslint-disable-next-line no-await-in-loop
      await this.deleteTask(name);
    }
  }

  /**
     * Returns list of names all of tasks.
     */
  getTaskNames(domain?: string) {
    let result = [...this.tasks.entries()].filter((entry) => !entry[1].zombi);
    if (isString(domain)) {
      result = result.filter(([, info]) => info.domain === domain);
    }

    return result.map((entry) => entry[0]);
  }

  /**
     * Register notification observer.
     */
  onNotification(selector, observer) {
    let name;
    let filter = truly;

    if (isString(selector)) {
      name = selector;
    } else if (isFunction(selector)) {
      filter = selector;
    } else if (isObject(selector)) {
      if (isString(selector.name)) {
        name = selector.name;
      }

      if (isString(selector.task)) {
        filter = (task) => task.observer.taskName === selector.task;
      } else if (isArray(selector.tasks)) {
        filter = (task) => selector.task.includes(task.observer.taskName);
      }
    }

    if (isString(name)) {
      let observers = this.notifications.get(name);
      if (isUndefined(observers)) {
        observers = [{
          filter,
          observer
        }];
        this.notifications.set(name, observers);
      } else {
        if (observers.findIndex((info) => info.observer === observer) >= 0) {
          throw new ExistsException("Shuch observer already exists");
        }

        observers.push({
          filter,
          observer
        });
      }
    } else {
      const anyNotif = this.notifications.get(ANY_NOTIFICATION);
      if (anyNotif.findIndex((info) => info.observer === observer) >= 0) {
        throw new ExistsException("Shuch observer already exists");
      }
      anyNotif.push({
        filter,
        observer
      });
    }
  }

  /**
     * Emit notification from task
     * 
     * @param {*} sender - notification sender
     * @param {string} name - notification name
     * @param {array} args - notification arguments
     */
  notify(sender, name, ...args) {
    const observers = this.notifications.get(name);
    if (isArray(observers)) {
      for (const info of observers) {
        if (info.filter(sender, name)) {
          info.observer(sender, name, ...args);
        }
      }
    }

    const any = this.notifications.get(ANY_NOTIFICATION);
    for (const info of any) {
      if (info.filter(sender, name)) {
        info.observer(sender, name, ...args);
      }
    }
  }

  /**
     * Runs task.
     * 
     * @param {*} name task name
     * @param {*} args task arguments
     */
  run(name, ...args) {
    return this.runNormal(name, ...args);
  }

  /**
     * Runs task in secure vm.
     * 
     * @param {*} name 
     * @param  {...any} args 
     */
  runInVm() {
    // TODO
  }

  /**
     * Runs task in worker thread.
     * 
     * @param {*} name 
     * @param  {...any} args 
     */
  runInThread() {
    // TODO
  }

  /**
     * Runs task in new process.
     * 
     * @param {*} name 
     * @param  {...any} args 
     */
  runInProcess() {
    // TODO
  }

  /**
     * Runs tasks and wait for result.
     * 
     * @param {*} name task name
     * @param {*} args task arguments
     */
  async runAndWait(name, ...args) {
    const observer = await this.run(name, ...args);
    return observer.result;
  }

  /**
     * Runs task once.
     * 
     * @param {class} task 
     * @param {*} args 
     */
  async runOnce(task, ...args) {
    let name;
    if (isClass(task) && !this.hasTask(task.name)) {
      name = task.name;
    } else {
      name = nanoid();
    }
    await this.addTask({ name, task });
    const observer = await this.runNormal(name, ...args);
    this.deleteTask(name);

    return observer;
  }

  private async runNormal(name, ...args) {
    const taskInfo = this.getTaskInfo(name);
    let taskObserver;

    if (taskInfo.singleton) {
      if (taskInfo.runner === noop) {
        taskInfo.runner = await this.createTaskRunner(taskInfo);
      }
      taskObserver = await taskInfo.runner(args);
    } else {
      const runTask = await this.createTaskRunner(taskInfo);
      taskInfo.runners.add(runTask);
      taskObserver = await runTask(args);

      const releaseRunner = () => {
        taskInfo.runners.delete(runTask);
        if (taskInfo.zombi === true && taskInfo.runners.size === 0) {
          this.uninstallTask(taskInfo);
        }
      };

      if (isPromise(taskObserver.result)) {
        _finally(taskObserver.result, releaseRunner).catch(noop);
      } else {
        releaseRunner();
      }
    }

    return taskObserver;
  }

  private async createTaskRunner(taskInfo) {
    return async (args) => {
      const instance = await this.createTaskInstance(taskInfo);

      const taskObserver = new TaskObserver(instance, taskInfo);
      taskObserver.state = TaskState.RUNNING;
      try {
        taskObserver.result = taskInfo.throttle(() => instance._run(...args));
      } catch (err) {
        if (isFunction(taskObserver.task.undo)) {
          await taskObserver.task.undo(err);
        }
        taskObserver.result = Promise.reject(err);
      }

      if (isPromise(taskObserver.result)) {
        // Wrap promise if task has undo method.
        if (isFunction(taskObserver.task.undo)) {
          taskObserver.result = taskObserver.result.then(identity, async (err) => {
            await taskObserver.task.undo(err);
            throw err;
          });
        }

        taskObserver.result.then(() => {
          taskObserver.state = (taskObserver.state === TaskState.CANCELLING) ? TaskState.CANCELLED : TaskState.COMPLETED;
        }).catch((err) => {
          taskObserver.state = TaskState.FAILED;
          taskObserver.error = err;
        });
      } else {
        taskObserver.state = TaskState.COMPLETED;
      }
      return taskObserver;
    };
  }

  private createTaskInstance(taskInfo) {
    let instance;
    if (taskInfo.singleton) {
      if (isUndefined(taskInfo.instance)) {
        instance = taskInfo.instance = new taskInfo.Class();
      } else {
        return taskInfo.instance;
      }
    } else {
      instance = new taskInfo.Class();
    }

    instance[MANAGER_SYMBOL] = this;

    return instance;
  }

  private initTaskInfo(task: any, name: string, taskInfo: Partial<TaskInfo>): Partial<TaskInfo> {
    if (taskInfo.suspendable && taskInfo.singleton) {
      throw new NotAllowedException("Singleton task cannot be suspendable");
    }

    if (taskInfo.cancelable && taskInfo.singleton) {
      throw new NotAllowedException("Singleton task cannot be cancelable");
    }

    let meta = getTaskMeta(task);
    if (isString(meta) || isUndefined(meta)) {
      meta = {};
    }

    const validatedTaskInfo: TaskInfo = {
      name,
      suspendable: getOptionValue(taskInfo.suspendable, meta.suspendable, isBoolean, false),
      cancelable: getOptionValue(taskInfo.cancelable, meta.cancelable, isBoolean, false),
      concurrency: getOptionValue(taskInfo.concurrency, meta.concurrency, isNumber, Infinity),
      interval: getOptionValue(taskInfo.interval, meta.interval, isNumber, undefined),
      singleton: getOptionValue(taskInfo.singleton, meta.singleton, isBoolean, false),
      description: getOptionValue(taskInfo.description, meta.description, isString, ""),
      domain: getOptionValue(taskInfo.domain, meta.domain, isString, undefined),
      throttle: DUMMY_THROTTLE,
      runner: noop,
      runners: new Set()
    };

    if (validatedTaskInfo.concurrency !== Infinity && validatedTaskInfo.concurrency > 0) {
      validatedTaskInfo.throttle = throttle({
        concurrency: validatedTaskInfo.concurrency,
        interval: validatedTaskInfo.interval
      });
    }

    return validatedTaskInfo;
  }

  private installTask(taskInfo) {
    this.tasks.set(taskInfo.name, taskInfo);
    const { domain } = taskInfo;
    if (isString(domain)) {
      const tasks = this.domains.get(domain);
      if (isUndefined(tasks)) {
        this.domains.set(domain, [taskInfo]);
      } else {
        tasks.push(taskInfo);
      }
    }
  }

  private uninstallTask(taskInfo) {
    this.tasks.delete(taskInfo.name);
    const domain = taskInfo.domain;
    if (isString(domain)) {
      const tasks = this.domains.get(domain);
      if (!isUndefined(tasks)) {
        const index = tasks.findIndex((ti) => taskInfo.name === ti.name);
        if (index >= 0) {
          tasks.splice(index, 1);
        }
      }
    }
  }

  private getTaskInfo(name): TaskInfo {
    const taskInfo = this.tasks.get(name);
    if (!taskInfo || taskInfo.zombi === true) {
      throw new NotExistsException(`Task '${name}' not exists`);
    }

    return taskInfo;
  }
}

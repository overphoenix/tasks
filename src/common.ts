import { isObject, isUndefined } from "@recalibratedsystems/common";

export enum TaskState {
  IDLE = 0,
  STARTING = 1,
  RUNNING = 2,
  SUSPENDED = 3,
  CANCELLING = 4,
  CANCELLED = 5,
  FAILED = 6,
  COMPLETED = 7
}

export type TaskRunner = (...args: any[]) => any;

export interface TaskInfo {
  name: string;
  description?: string;
  domain?: string;
  throttle: (...args: any[]) => any;
  suspendable: boolean;
  cancelable: boolean;
  concurrency: number;
  interval?: number;
  singleton: boolean;
  Class?: any;
  zombi?: boolean;
  runner: TaskRunner;
  runners: Set<TaskRunner>;
  [k: string]: any;
}

export const MANAGER_SYMBOL = Symbol.for("rs:manager");
export const OBSERVER_SYMBOL = Symbol.for("rs:observer");

// Decorators
const TASK_ANNOTATION = "rs:task";

const setTaskMeta = (target: any, info: any) => Reflect.defineMetadata(TASK_ANNOTATION, info, target);
export const getTaskMeta = (target: any) => Reflect.getMetadata(TASK_ANNOTATION, target);

export const Task = (taskInfo = {}) => (target: any) => {
  const info = getTaskMeta(target);
  if (isUndefined(info)) {
    setTaskMeta(target, taskInfo);
  } else if (isObject(info)) {
    Object.assign(info, taskInfo);
  } else {
    setTaskMeta(target, taskInfo);
  }
};
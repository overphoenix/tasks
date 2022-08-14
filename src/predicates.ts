import { BaseTask } from "./base_task";
import { FlowTask } from "./flow_task";
import { TaskManager } from "./manager";
import { TaskObserver } from "./task_observer";

export const isTask = (obj: any) => obj instanceof BaseTask;
export const isFlowTask = (obj: any) => obj instanceof FlowTask;
export const isTaskObserver = (obj: any) => obj instanceof TaskObserver;
export const isTaskManager = (obj: any) => obj instanceof TaskManager;

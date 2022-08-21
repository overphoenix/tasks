import { TaskManager } from "./manager";
import ParallelFlowTask from "./parallel_flow_task";
import SeriesFlowTask from "./series_flow_task";

export * from "./common";
export * from "./manager";
export * from "./task_observer";
export * from "./base_task";
export * from "./flow_task";
export * from "./isomorphic_task";
export * from "./race_flow_task";
export * from "./try_flow_task";
export * from "./waterfall_flow_task";
export * from "./advanced_task";
export {
  ParallelFlowTask,
  SeriesFlowTask
}

/**
 * Runs task in series.
 * 
 * @param {ateos.task.TaskManager} manager
 * @param {array} tasks array of task names
 */
export const runSeries = (manager: TaskManager, tasks: any[], ...args: any[]) => manager.runOnce(SeriesFlowTask, { args, tasks });

/**
 * Runs tasks in parallel.
 * 
 * @param {ateos.task.TaskManager} manager
 * @param {array} tasks array of tasks
 */
export const runParallel = (manager: TaskManager, tasks: any[], ...args: any[]) => manager.runOnce(ParallelFlowTask, { args, tasks });

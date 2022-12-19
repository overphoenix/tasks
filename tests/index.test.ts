import "reflect-metadata";
import {
  omit,
  isString,
  isPromise,
  isNull,
  isNumber,
  promise,
  typeOf,
  Exception,
  InvalidNumberOfArgumentsException,
  NotExistsException,
  RuntimeException,
  ImmutableException,
  NotImplementedException,
  NotValidException,
  InvalidArgumentException,
  NotAllowedException,
  AggregateException,
  ExistsException
} from "@recalibratedsystems/common-cjs";
import {
  IsomorphicTask,
  BaseTask,
  TaskManager,
  TaskObserver,
  SeriesFlowTask,
  ParallelFlowTask,
  WaterfallFlowTask,
  runSeries,
  runParallel,
  Task
} from "../lib";
import { } from "../lib/isomorphic_task";
import { isTask, isTaskManager, isTaskObserver } from "../lib/predicates";
import TryFlowTask from "../lib/try_flow_task";
import RaceFlowTask from "../lib/race_flow_task";
import * as upath from "upath";


describe("tasks", () => {
  let manager;

  class SCTask extends BaseTask {
    public _runDefer: any = null;
    public _suspendDefer: any = null;
    public _cancelDefer: any = null;
    public reallySuspended = false;
    public reallyResumed = false;
    public _maxTicks: number = 0;
    public data: any;

    async _run(maxTimeout = 1000) {
      this._maxTicks = maxTimeout / 10;
      this.data = 0;
      this._runDefer = promise.defer();
      this.main();
      return this._runDefer.promise;
    }

    async main() {
      this.reallySuspended = false;
      for (; ;) {
        await promise.delay(10);
        this.data++;
        if (this.data >= this._maxTicks) {
          this._runDefer.resolve(this.data);
          return;
        }

        if (!isNull(this._suspendDefer)) {
          this._suspendDefer.resolve();
          this.reallyResumed = false;
          this.reallySuspended = true;
          return;
        }
        if (!isNull(this._cancelDefer)) {
          this._runDefer.resolve(this.data);
          await promise.delay(300);
          this._cancelDefer.resolve();
          return;
        }
      }
    }

    suspend(defer) {
      this._suspendDefer = defer;
    }

    async resume(defer) {
      promise.delay(200).then(() => {
        this._suspendDefer = null;
        this.main();
        this.reallyResumed = true;
        defer.resolve();
      });
    }

    cancel(defer) {
      this._cancelDefer = defer;
    }
  }

  class SimpleTask extends BaseTask {
    private value = 0;

    async main(value, timeout) {
      this.value++;
      if (isNumber(timeout)) {
        await promise.delay(timeout);
      }
      return value;
    }
  }

  beforeEach(() => {
    manager = new TaskManager();
  });

  it("task prototype", () => {
    const t = new BaseTask();

    expect(isTask(t)).toBeTruthy();
    expect(() => t.manager).toThrow(NotValidException);
    expect(() => t.observer).toThrow(NotValidException);
    expect(() => t.manager = undefined).toThrow(ImmutableException);
    expect(() => t.observer = undefined).toThrow(ImmutableException);

    expect(t._run).toBeInstanceOf(Function);
    expect(t.main).toBeInstanceOf(Function);
    expect(() => t.main()).toThrow(NotImplementedException);

    expect(t.suspend).toBeInstanceOf(Function);
    expect(t.resume).toBeInstanceOf(Function);
    expect(t.cancel).toBeInstanceOf(Function);
  });

  it("construct manager", () => {
    expect(isTaskManager(manager)).toBeTruthy();
    expect(manager.getTaskNames()).toHaveLength(0);
  });

  it("ateos.is.task() should be defined", () => {
    class MyTask extends BaseTask {
    }

    expect(isTask(new MyTask())).toBeTruthy();
  });

  it("should add only valid task", async () => {
    const InvalidTask1 = null;
    const InvalidTask2 = {};
    class InvalidTask3 {
      main() {
        return "invalid";
      }
    }

    class ValidTask extends BaseTask {
      main() {
        return "ok";
      }
    }

    const invalidTasks = [
      InvalidTask1,
      InvalidTask2,
      InvalidTask3
    ];

    for (const InvalidTask of invalidTasks) {
      await expect(async () => manager.addTask({
        name: "task",
        task: InvalidTask
      })).rejects.toThrow(NotValidException);
    }

    await manager.addTask({
      name: "task",
      task: ValidTask
    });
    expect(manager.getTaskNames()).toEqual(["task"]);
  });

  it("task's immutable properties", async () => {
    const props = [
      {
        name: "manager",
        expected: manager,
        createNew: () => new TaskManager()
      },
      {
        name: "observer",
        expected: null,
        createNew: () => ({})
      }
    ];

    class TaskA extends BaseTask {
      main() {
      }
    }

    await manager.addTask({
      name: "task",
      task: TaskA
    });
    const taskA = await manager.getTaskInstance("task");

    for (const prop of props) {
      if (prop.name === "manager") {
        expect(taskA[prop.name]).toStrictEqual(prop.expected);
      } else {
        expect(() => taskA[prop.name]).toThrow(NotValidException);
      }

      expect(() => taskA[prop.name] = prop.createNew()).toThrow(ImmutableException);
    }
  });

  it("run task", async () => {
    await manager.addTask({
      name: "a",
      task: SimpleTask
    });
    const observer = await manager.run("a", "ABC");
    expect(isTaskObserver(observer)).toBeTruthy();
    expect(observer.completed).toBeTruthy();
    expect(await observer.result).toEqual("ABC");
    expect(observer.completed).toBeTruthy();
  });

  it("regular task is stateless", async () => {
    await manager.addTask({
      name: "a",
      task: SimpleTask
    });
    const observer1 = await manager.run("a", "ABC");
    const observer2 = await manager.run("a", "ABC");
    await Promise.all([observer1.result, observer2.result]);
    expect(observer1.task.value).toEqual(1);
    expect(observer1.task.value).toEqual(observer1.task.value);
  });

  it("observer should contain common task information", async () => {
    class TaskA extends BaseTask {
      main() {
        return promise.delay(10);
      }
    }

    await manager.addTask({
      name: "a",
      task: TaskA
    });
    const observer = await manager.run("a", "ABC");
    expect(observer.taskName).toEqual("a");
    expect(observer.suspendable).toBeFalsy();
    expect(observer.cancelable).toBeFalsy();
    expect(observer.running).toBeTruthy();
    expect(observer.cancelled).toBeFalsy();
    expect(observer.completed).toBeFalsy();
    expect(observer.failed).toBeFalsy();
    expect(observer.finished).toBeFalsy();
    expect(observer.suspended).toBeFalsy();
    expect(isPromise(observer.result)).toBeTruthy();

    await observer.result;
    expect(observer.running).toBeFalsy();
    expect(observer.completed).toBeTruthy();
    expect(observer.finished).toBeTruthy();
  });

  it("observer should contain correct error info for sync task", async () => {
    class TaskA extends BaseTask {
      main() {
        throw new RuntimeException("sad");
      }
    }

    await manager.addTask({
      name: "a",
      task: TaskA
    });
    const observer = await manager.run("a", "ABC");
    await expect(async () => observer.result).rejects.toThrow(RuntimeException);
    expect(observer.failed).toBeTruthy();
    expect(observer.error).toBeInstanceOf(RuntimeException);
  });

  it("observer should contain correct error info for async task", async () => {
    class TaskA extends BaseTask {
      async main() {
        await promise.delay(10);
        throw new RuntimeException("sad");
      }
    }

    await manager.addTask({
      name: "a",
      task: TaskA
    });
    const observer = await manager.run("a", "ABC");
    await expect(async () => observer.result).rejects.toThrow(RuntimeException);
    expect(observer.failed).toBeTruthy;
    expect(observer.error).toBeInstanceOf(RuntimeException);
  });

  it("run async task", async () => {
    class TaskA extends BaseTask {
      async main(version) {
        await promise.delay(10);
        return `RS ${version}`;
      }
    }

    await manager.addTask({
      name: "a",
      task: TaskA
    });
    const observer = await manager.run("a", "ABC");
    expect(observer.running).toBeTruthy();
    expect(await observer.result).toEqual("RS ABC");
    expect(observer.completed).toBeTruthy();
  });

  it("delete nonexisting task", async () => {
    await expect(async () => manager.deleteTask("unknown")).rejects.toThrow(NotExistsException);
  });

  it("delete existing task", async () => {
    class TaskA extends BaseTask {
      main() {
        return 0;
      }
    }

    await manager.addTask({
      name: "a",
      task: TaskA
    });
    expect(manager.getTaskNames()).toEqual(["a"]);
    await manager.deleteTask("a");
    expect(manager.getTaskNames()).toHaveLength(0);
  });

  it("delete all tasks", async () => {
    class TasksA extends BaseTask {
      main() { }
    }

    class TasksB extends BaseTask {
      main() { }
    }

    class TasksC extends BaseTask {
      main() { }
    }

    class TasksD extends BaseTask {
      main() { }
    }

    await manager.addTask({ name: "a", task: TasksA });
    await manager.addTask({ name: "b", task: TasksB });
    await manager.addTask({ name: "c", task: TasksC });
    await manager.addTask({ name: "d", task: TasksD });

    expect(manager.getTaskNames()).toEqual(["a", "b", "c", "d"]);

    await manager.deleteTask("b");

    expect(manager.getTaskNames()).toEqual(["a", "c", "d"]);

    await manager.deleteAllTasks();

    expect(manager.getTaskNames()).toHaveLength(0);
  });

  it("run task once", async () => {
    const observer = await manager.runOnce(SimpleTask, "abc");
    expect(manager.getTaskNames()).toHaveLength(0);
    expect(observer.completed).toBeTruthy();
    expect(await observer.result).toEqual("abc");
    expect(observer.completed).toBeTruthy();
  });

  it("run async task once", async () => {
    class TaskA extends BaseTask {
      async main(version) {
        await promise.delay(10);
        return `rs ${version}`;
      }
    }

    const observer = await manager.runOnce(TaskA, "abc");
    expect(manager.getTaskNames()).toHaveLength(0);
    expect(observer.running).toBeTruthy();
    expect(await observer.result).toEqual("rs abc");
    expect(observer.completed).toBeTruthy();
  });

  it("run deleted but still running task should have thrown", async () => {
    class TaskA extends BaseTask {
      async main(version) {
        await promise.delay(100);
        return `123 ${version}`;
      }
    }

    await manager.addTask({ name: "a", task: TaskA });
    const observer = await manager.run("a", "abc");
    await manager.deleteTask("a");
    await expect(async () => manager.run("a", "abc")).rejects.toThrow(NotExistsException);

    expect(manager.getTaskNames()).toHaveLength(0);
    expect(observer.running).toBeTruthy();
    expect(await observer.result).toEqual("123 abc");
    expect(observer.completed).toBeTruthy();
  });

  describe("domains", () => {
    class TaskA extends BaseTask {
      main() { }
    }

    class TaskB extends BaseTask {
      main() { }
    }

    class TaskC extends BaseTask {
      main() { }
    }

    class TaskD extends BaseTask {
      main() { }
    }

    it("add tasks with tag", async () => {
      await manager.addTask({ name: "a", task: TaskA });
      await manager.addTask({
        name: "b",
        task: TaskB,
        domain: "group1"
      });

      await manager.addTask({
        name: "c",
        task: TaskC,
        domain: "group2"
      });
      await manager.addTask({
        name: "d",
        task: TaskD,
        domain: "group2"
      });

      expect(manager.getTaskNames()).toEqual(["a", "b", "c", "d"]);

      expect(manager.getTasksByDomain("group1").map((taskInfo) => taskInfo.name)).toEqual(["b"]);
      expect(manager.getTasksByDomain("group2").map((taskInfo) => taskInfo.name)).toEqual(["c", "d"]);
    });

    it("delete tasks by tag", async () => {
      await manager.addTask({ name: "a", task: TaskA });
      await manager.addTask({
        name: "b",
        task: TaskB,
        domain: "group1"
      });

      await manager.addTask({
        name: "c",
        task: TaskC,
        domain: "group2"
      });
      await manager.addTask({
        name: "d",
        task: TaskD,
        domain: "group2"
      });

      expect(manager.getTaskNames()).toEqual(["a", "b", "c", "d"]);

      await manager.deleteTasksByDomain("group2");

      expect(manager.getTaskNames()).toEqual(["a", "b"]);
      expect(manager.getTasksByDomain("group2")).toHaveLength(0);
    });
  });

  describe("isomorphic tasks", () => {
    class BadTask extends IsomorphicTask {
    }

    class IsomorphicA extends IsomorphicTask {
      main(data) {
        return typeOf(data);
      }
    }

    it("should throw if #main() is not implemented", async () => {
      await manager.addTask({ name: "bad", task: BadTask });

      await expect(async () => manager.runAndWait("bad", {})).rejects.toThrow(NotImplementedException);
    });

    it("throw in #main()", async () => {
      class A extends IsomorphicTask {
        main() {
          throw new Error("bad bad bad");
        }
      }

      await manager.addTask({ name: "a", task: A });
      await expect(async () => manager.runAndWait("a")).rejects.toThrow(new Error("bad bad bad"));
    });

    it("should throw if pass more then one argument", async () => {
      await manager.addTask({ name: "a", task: IsomorphicA });

      await expect(async () => manager.runAndWait("a", { a: 1 }, { b: 2 })).rejects.toThrow(InvalidNumberOfArgumentsException);
    });

    describe("should throw if non-object argument is passed", () => {
      const vars = [
        12,
        "abc",
        String("abc"),
        new Date(),
        /^word/,
        ["a", "b"],
        BaseTask,
        new Map(),
        new Set(),
        new Int16Array(),
        new Error()
      ];

      for (const v of vars) {
        // eslint-disable-next-line no-loop-func
        it(typeOf(v), async () => {
          await manager.addTask({ name: "a", task: IsomorphicA });

          await expect(async () => manager.runAndWait("a", v)).rejects.toThrow(InvalidArgumentException);
        });
      }
    });

    describe("allowed arguments", () => {
      const allowed = {
        "Object.create(null)": [Object.create(null)],
        "{}": [{}],
        "new BaseTask()": [new BaseTask()],
        null: [null],
        undefined: [undefined]
      };

      for (const [key, val] of Object.entries(allowed)) {
        it(key, async () => {
          await manager.addTask({ name: "a", task: IsomorphicA });

          expect(await manager.runAndWait("a", ...val)).toEqual(typeOf(val[0]));
        });
      }
    });
  });

  describe("singleton tasks", () => {
    it("correct value of 'manager' property in task", async () => {
      await manager.addTask({
        name: "a",
        task: SimpleTask,
        singleton: true
      });

      const observer = await manager.run("a");
      await observer.result;
      expect(observer.task.manager).not.toBeNull();
    });

    it("singleton task is stateful", async () => {
      await manager.addTask({
        name: "a",
        task: SimpleTask,
        singleton: true
      });
      const observer1 = await manager.run("a", "abc");
      const observer2 = await manager.run("a", "abc");
      await Promise.all([observer1.result, observer2.result]);
      expect(observer1.task.value).toEqual(2);
      expect(observer1.task).toEqual(observer1.task);
    });

    it("deletion of singleton task should be performed immediately", async () => {
      await manager.addTask({
        name: "a",
        task: SimpleTask,
        singleton: true
      });
      const observer = await manager.run("a", "abc", 100);
      expect(manager.getTaskNames()).toHaveLength(1);
      manager.deleteTask("a");
      expect(manager.getTaskNames()).toHaveLength(0);
      await observer.result;
    });

    it("singleton task cannot be suspendable", async () => {
      await expect(async () => manager.addTask({
        name: "a",
        task: SimpleTask,
        singleton: true,
        suspendable: true
      })).rejects.toThrow(NotAllowedException);
    });

    it("singleton task cannot be cancelable", async () => {
      await expect(async () => manager.addTask({
        name: "a",
        task: SimpleTask,
        singleton: true,
        cancelable: true
      })).rejects.toThrow(NotAllowedException);
    });
  });

  describe("concurrency", () => {
    let counter;
    let inc;

    class TaskA extends BaseTask {
      async main(maxVal, timeout, check) {
        counter++;
        inc++;
        if (maxVal) {
          expect(inc).toBeLessThanOrEqual(maxVal);
        }
        if (check) {
          expect(counter).toEqual(inc);
        }
        await promise.delay(timeout);
        inc--;
        return inc;
      }
    }

    class SingletonTask extends BaseTask {
      public inc = 0;

      async main(maxVal, timeout) {
        this.inc++;
        if (maxVal) {
          expect(this.inc).toBeLessThanOrEqual(maxVal);
        }
        await promise.delay(timeout);
        this.inc--;
        return this.inc;
      }
    }

    beforeEach(() => {
      inc = 0;
      counter = 0;
    });

    it("run 10 task instances without cuncurrency", async () => {
      await manager.addTask({ name: "a", task: TaskA });

      const promises: Promise<any>[] = [];
      for (let i = 0; i < 10; i++) {
        const observer = await manager.run("a", 0, 30, true);
        promises.push(observer.result);
      }

      await Promise.all(promises);
    });

    it("concurrency should involve tasks but not creation of observers", async () => {
      await manager.addTask({
        name: "a",
        task: TaskA,
        concurrency: 10
      });

      const observers: TaskObserver[] = [];
      const results: Promise<any>[] = [];
      for (let i = 0; i < 10; i++) {
        const observer = await manager.run("a", 0, 30, true);
        observers.push(observer);
        results.push(observer.result);
      }

      expect(counter).toBeGreaterThanOrEqual(10);
      await Promise.all(results);
      expect(counter).toEqual(10);
    });

    it("run maximum 3 task instances at a time", async () => {
      await manager.addTask({
        name: "a",
        task: TaskA,
        concurrency: 3
      });

      const promises: Promise<any>[] = [];
      for (let i = 0; i < 100; i++) {
        const observer = await manager.run("a", 3, 50, false);
        promises.push(observer.result);
      }

      await Promise.all(promises);
    });

    it("run singleton task in parallel", async () => {
      await manager.addTask({
        name: "a",
        task: SingletonTask,
        concurrency: 3,
        singleton: true
      });

      const promises: Promise<any>[] = [];
      for (let i = 0; i < 100; i++) {
        const observer = await manager.run("a", 3, 50);
        promises.push(observer.result);
      }

      await Promise.all(promises);
    });
  });

  describe("suspend/resume/cancel", () => {
    it("suspend/resume non suspendable task", async () => {
      await manager.addTask({ name: "a", task: SCTask });
      const observer = await manager.run("a");
      await promise.delay(200);
      await observer.suspend();
      expect(observer.suspended).toBeFalsy();
      expect(await observer.result).toEqual(100);
    });

    it("cancel non cancelable task", async () => {
      await manager.addTask({ name: "a", task: SCTask });
      const observer = await manager.run("a");
      await promise.delay(200);
      await expect(async () => observer.cancel()).rejects.toThrow(NotAllowedException);
      expect(await observer.result).toEqual(100);
      expect(observer.completed).toBeTruthy();
      expect(observer.cancelled).toBeFalsy();
    });

    it("suspend/resume suspendable task", async () => {
      await manager.addTask({
        name: "a",
        task: SCTask,
        suspendable: true
      });
      const observer = await manager.run("a");
      await promise.delay(200);
      await observer.suspend();
      expect(observer.task.reallySuspended).toBeTruthy();
      expect(observer.suspended).toBeTruthy();
      await promise.delay(100);
      await observer.resume();
      expect(observer.task.reallyResumed).toBeTruthy();
      expect(observer.running).toBeTruthy();
      expect(await observer.result).toEqual(100);
    });

    it("cancel cancelable task", async () => {
      await manager.addTask({
        name: "a",
        task: SCTask,
        cancelable: true
      });
      const observer = await manager.run("a");
      await promise.delay(200);
      await observer.cancel();
      expect(observer.cancelled).toBeTruthy();
      expect(await observer.result).not.toEqual(100);
      expect(observer.completed).toBeFalsy();
    });
  });

  describe("flows", () => {
    class TaskA extends BaseTask {
      async main() {
        await promise.delay(10);
        return 1;
      }
    }

    class TaskBadA extends BaseTask {
      async main() {
        await promise.delay(10);
        throw new Exception("some error");
      }
    }

    class TaskB extends BaseTask {
      async main({ suffix }) {
        await promise.delay(10);
        return `suffix-${suffix}`;
      }
    }

    class TaskC extends BaseTask {
      main({ suffix }) {
        return suffix;
      }
    }

    it("should throw if pass more them one argument", async () => {
      await manager.addTask({ name: "a", task: TaskA });
      await manager.addTask({ name: "b", task: TaskB });
      await manager.addTask({ name: "series", task: SeriesFlowTask });

      await expect(async () => manager.runAndWait("series", {
        args: {
          suffix: "ateos"
        },
        tasks: ["a", "b"]
      }, {})).rejects.toThrow(InvalidNumberOfArgumentsException);
    });

    it("should throw if pass non object argument", async () => {
      await manager.addTask({ name: "a", task: TaskA });
      await manager.addTask({ name: "b", task: TaskB });
      await manager.addTask({ name: "series", task: SeriesFlowTask });

      await expect(async () => manager.runAndWait("series", ["a", "b"])).rejects.toThrow(InvalidArgumentException);
    });

    describe("series", () => {
      it("managed tasks", async () => {
        await manager.addTask({ name: "a", task: TaskA });
        await manager.addTask({ name: "b", task: TaskB });
        await manager.addTask({ name: "series", task: SeriesFlowTask });

        const observer = await manager.run("series", {
          arg: {
            suffix: "ateos"
          },
          tasks: ["a", "b"]
        });
        expect((await observer.result)).toEqual([1, "suffix-ateos"]);
      });

      it("managed+unmanaged tasks", async () => {
        await manager.addTask({ name: "a", task: TaskA });
        await manager.addTask({ name: "b", task: TaskB });
        await manager.addTask({ name: "series", task: SeriesFlowTask });

        const observer = await manager.run("series", {
          arg: {
            suffix: "ateos"
          },
          tasks: ["a", "b", TaskC]
        });
        expect(await observer.result).toEqual([1, "suffix-ateos", "ateos"]);
      });

      it("run tasks with separate args", async () => {
        class SomeTask extends BaseTask {
          main({ val }) {
            return val;
          }
        }

        await manager.addTask({ name: "a", task: SomeTask });
        await manager.addTask({ name: "b", task: SomeTask });
        await manager.addTask({ name: "series", task: SeriesFlowTask });

        const observer = await manager.run("series", {
          tasks: [
            {
              task: "a", args: {
                val: "ateos"
              }
            },
            {
              task: "b", args: {
                val: 888
              }
            }
          ]
        });
        expect(await observer.result).toEqual(["ateos", 888]);
      });

      it("should stop follow-up tasks is one of the task has thrown", async () => {
        const results: any[] = [];
        class TaskA extends BaseTask {
          main() {
            results.push(666);
          }
        }

        class TaskB extends BaseTask {
          main() {
            throw new RuntimeException("Task error");
          }
        }

        class TaskC extends BaseTask {
          main() {
            results.push(777);
          }
        }

        await manager.addTask({ name: "a", task: TaskA });
        await manager.addTask({ name: "b", task: TaskB });
        await manager.addTask({ name: "c", task: TaskC });
        await manager.addTask({ name: "series", task: SeriesFlowTask });

        const observer = await manager.run("series", {
          tasks: ["a", "b", "c"]
        });
        await expect(async () => observer.result).rejects.toThrow(RuntimeException);

        expect(results).toHaveLength(1);
        expect(results[0]).toEqual(666);
      });

      it("cancel flow with all cancelable tasks", async () => {
        class SCTaskA extends SCTask {
        }

        class SCTaskB extends SCTask {
        }

        await manager.addTask({
          name: "a",
          task: SCTaskA,
          cancelable: true
        });
        await manager.addTask({
          name: "b",
          task: SCTaskB,
          cancelable: true
        });
        await manager.addTask({
          name: "series",
          task: SeriesFlowTask,
          cancelable: true
        });

        const observer = await manager.run("series", {
          tasks: ["a", "b"]
        });
        await promise.delay(100);
        expect(observer.cancelable).toBeTruthy();

        await observer.cancel();

        const result = await observer.result;
        expect(result).toHaveLength(1);
        expect(isNumber(result[0])).toBeTruthy();

        await observer.result;
      });

      it("cancel flow with first non-cancelable task should cancel flow", async () => {
        class TaskA extends BaseTask {
          async main() {
            await promise.delay(1000);
            return 888;
          }
        }

        class SCTaskB extends SCTask {
        }

        await manager.addTask({
          name: "a",
          task: TaskA
        });
        await manager.addTask({
          name: "b",
          task: SCTaskB,
          cancelable: true
        });
        await manager.addTask({
          name: "series",
          task: SeriesFlowTask,
          cancelable: true
        });

        const observer = await manager.run("series", {
          tasks: ["a", "b"]
        });
        await promise.delay(300);
        expect(observer.cancelable).toBeTruthy();

        await promise.delay(800);

        await observer.cancel();

        const result = await observer.result;
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual(888);
        expect(isNumber(result[1])).toBeTruthy();

        await observer.result;
      });
    });

    describe("parallel", () => {
      it("managed tasks", async () => {
        await manager.addTask({ name: "a", task: TaskA });
        await manager.addTask({ name: "b", task: TaskB });
        await manager.addTask({ name: "parallel", task: ParallelFlowTask });

        const observer = await manager.run("parallel", {
          arg: {
            suffix: "ateos"
          },
          tasks: ["a", "b"]
        });
        expect((await observer.result).sort()).toEqual([1, "suffix-ateos"].sort());
      });

      it("managed+unmanaged tasks", async () => {
        await manager.addTask({ name: "a", task: TaskA });
        await manager.addTask({ name: "b", task: TaskB });
        await manager.addTask({ name: "parallel", task: ParallelFlowTask });

        const observer = await manager.run("parallel", {
          arg: {
            suffix: "ateos"
          },
          tasks: ["a", "b", TaskC]
        });
        expect((await observer.result).sort()).toEqual([1, "suffix-ateos", "ateos"].sort());
      });

      it("run tasks with separate args", async () => {
        class SomeTask extends BaseTask {
          main({ val }) {
            return val;
          }
        }

        await manager.addTask({ name: "a", task: SomeTask });
        await manager.addTask({ name: "b", task: SomeTask });
        await manager.addTask({ name: "parallel", task: ParallelFlowTask });

        const observer = await manager.run("parallel", {
          tasks: [
            {
              task: "a", args: {
                val: "ateos"
              }
            },
            {
              task: "b", args: {
                val: 888
              }
            }
          ]
        });
        expect((await observer.result).sort()).toEqual(["ateos", 888].sort());
      });

      it("should not stop follow-up tasks is one of the task has thrown", async () => {
        const results: any[] = [];
        class TaskA extends BaseTask {
          main() {
            results.push(666);
          }
        }

        class TaskB extends BaseTask {
          main() {
            throw new RuntimeException("Task error");
          }
        }

        class TaskC extends BaseTask {
          main() {
            results.push(777);
          }
        }

        await manager.addTask({ name: "a", task: TaskA });
        await manager.addTask({ name: "b", task: TaskB });
        await manager.addTask({ name: "c", task: TaskC });
        await manager.addTask({ name: "parallel", task: ParallelFlowTask });

        const observer = await manager.run("parallel", {
          tasks: ["a", "b", "c"]
        });
        await expect(async () => observer.result).rejects.toThrow(RuntimeException);

        await promise.delay(300);

        expect(results).toEqual([666, 777]);
      });

      it("cancel flow with all cancelable tasks", async () => {
        class SCTaskA extends SCTask {
        }

        class SCTaskB extends SCTask {
        }

        await manager.addTask({
          name: "a",
          task: SCTaskA,
          cancelable: true
        });
        await manager.addTask({
          name: "b",
          task: SCTaskB,
          cancelable: true
        });
        await manager.addTask({
          name: "parallel",
          task: ParallelFlowTask,
          cancelable: true
        });

        const observer = await manager.run("parallel", {
          tasks: ["a", "b"]
        });
        await promise.delay(100);
        expect(observer.cancelable).toBeTruthy();

        await observer.cancel();

        const result = await observer.result;
        expect(result[0]).toBeTruthy();
        expect(result[1]).toBeTruthy();

        await observer.result;
      });

      it("cancel flow with one non-cancelable and one cancelable", async () => {
        class TaskA extends BaseTask {
          async main() {
            await promise.delay(1000);
            return 888;
          }
        }

        class SCTaskB extends SCTask {
        }

        await manager.addTask({ name: "a", task: TaskA });
        await manager.addTask({
          name: "b",
          task: SCTaskB,
          cancelable: true
        });
        await manager.addTask({
          name: "parallel",
          task: ParallelFlowTask,
          cancelable: true
        });

        const observer = await manager.run("parallel", {
          tasks: ["a", "b"]
        });

        await promise.delay(300);
        expect(observer.cancelable).toBeTruthy();

        await promise.delay(1000);

        await observer.cancel();

        const result = await observer.result;
        expect(result.sort()).toHaveLength(2);

        await observer.result;
      });

      // it.todo("correct process of case when one of non-cancelable task throws", async () => {

      // });
    });

    describe("try", () => {
      it("managed tasks", async () => {
        await manager.addTask({ name: "badA", task: TaskBadA });
        await manager.addTask({ name: "b", task: TaskB });
        await manager.addTask({ name: "try", task: TryFlowTask });

        const observer = await manager.run("try", {
          arg: {
            suffix: "ateos"
          },
          tasks: ["badA", "b"]
        });
        expect(await observer.result).toEqual("suffix-ateos");
      });

      it("managed+unmanaged tasks", async () => {
        await manager.addTask({ name: "badA", task: TaskBadA });
        await manager.addTask({ name: "try", task: TryFlowTask });

        const observer = await manager.run("try", {
          arg: {
            suffix: "ateos"
          },
          tasks: ["badA", TaskC]
        });
        expect(await observer.result).toEqual("ateos");
      });

      it("should throw if all tasks have failed", async () => {
        await manager.addTask({ name: "a", task: TaskBadA });
        await manager.addTask({ name: "b", task: TaskBadA });
        await manager.addTask({ name: "c", task: TaskBadA });
        await manager.addTask({ name: "try", task: TryFlowTask });

        const observer = await manager.run("try", {
          args: "ateos",
          tasks: ["a", "b", "c"]
        });
        await expect(async () => observer.result).rejects.toThrow(AggregateException);
      });

      // TODO: add more tests for canceling and other cases
    });

    describe("waterfall", () => {
      class TaskD extends BaseTask {
        async main({ num }) {
          return {
            num1: num,
            num2: 7
          };
        }
      }

      class TaskE extends BaseTask {
        async main({ num1, num2 }) {
          await promise.delay(10);
          return num1 * num2;
        }
      }

      it("managed tasks", async () => {
        await manager.addTask({ name: "d", task: TaskD });
        await manager.addTask({ name: "e", task: TaskE });
        await manager.addTask({ name: "waterfall", task: WaterfallFlowTask });

        const observer = await manager.run("waterfall", {
          arg: {
            num: 3
          },
          tasks: ["d", "e"]
        });
        expect(await observer.result).toEqual(21);
      });

      it("managed+unmanaged tasks", async () => {
        class TaskF extends BaseTask {
          async main(sum) {
            await promise.delay(10);
            return `sum = ${sum}`;
          }
        }
        await manager.addTask({ name: "d", task: TaskD });
        await manager.addTask({ name: "e", task: TaskE });
        await manager.addTask({ name: "waterfall", task: WaterfallFlowTask });

        const observer = await manager.run("waterfall", {
          arg: {
            num: 3
          },
          tasks: ["d", "e", TaskF]
        });
        const result = await observer.result;
        expect(isString(result)).toBeTruthy();
        expect(result).toEqual("sum = 21");
      });
    });

    describe("race", () => {
      class TaskD extends BaseTask {
        async main() {
          await promise.delay(500);
          return 3;
        }
      }

      class TaskE extends BaseTask {
        async main() {
          await promise.delay(300);
          return 5;
        }
      }

      it("managed tasks", async () => {
        await manager.addTask({ name: "d", task: TaskD });
        await manager.addTask({ name: "e", task: TaskE });
        await manager.addTask({ name: "race", task: RaceFlowTask });

        const observer = await manager.run("race", {
          tasks: ["d", "e"]
        });
        expect(await observer.result).toEqual(5);
      });

      it("managed+unmanaged tasks", async () => {
        class TaskF extends BaseTask {
          async main() {
            await promise.delay(100);
            return 7;
          }
        }
        await manager.addTask({ name: "d", task: TaskD });
        await manager.addTask({ name: "e", task: TaskE });
        await manager.addTask({ name: "race", task: RaceFlowTask });

        const observer = await manager.run("race", {
          args: 3,
          tasks: ["d", "e", TaskF]
        });
        expect(await observer.result).toEqual(7);
      });
    });
  });

  it("runSeries() with functions", async () => {

    const task1 = async () => {
      await promise.delay(100);
      return 777;
    };

    const task2 = () => {
      return 888;
    };

    const observer = await runSeries(manager, [
      task1,
      task2
    ]);

    expect(await observer.result).toStrictEqual([777, 888]);
  });

  it("runParallel() with functions", async () => {

    const task1 = async () => {
      await promise.delay(100);
      return 777;
    };

    const task2 = () => {
      return 888;
    };

    const observer = await runParallel(manager, [
      task1,
      task2
    ]);

    const result = await observer.result;
    expect(Object.keys(result)).toHaveLength(2);
    expect(Object.values(result).sort()).toEqual([777, 888].sort());
  });

  describe("TaskObserver#finally", () => {
    it("finally function should be executed atomically (async)", async () => {
      let val;
      class TaskA extends BaseTask {
        async main() {
          await promise.delay(100);
          val = 1;
        }
      }

      await manager.addTask({ name: "a", task: TaskA });
      const observer = await manager.run("a");

      observer.finally(async () => {
        await promise.delay(100);
        val = 2;
      });
      await observer.result;
      expect(val).toEqual(2);
    });

    it("finally function should be executed atomically (async)", async () => {
      let val = 0;
      class TaskA extends BaseTask {
        main() {
          val = 1;
        }
      }

      await manager.addTask({ name: "a", task: TaskA });
      const observer = await manager.run("a");
      observer.finally(() => {
        val = 2;
      });
      await observer.result;
      expect(val).toEqual(2);
    });
  });

  describe("undo", () => {
    it("task's undo method should be executed atomically (async)", async () => {
      const data: any[] = [];

      class TaskA extends BaseTask {
        async main() {
          data.push(1);
          await promise.delay(100);
          data.push(2);
          throw new RuntimeException("task error");
        }

        async undo() {
          await promise.delay(1000);
          data.length = 0;
        }
      }

      await manager.addTask({ name: "a", task: TaskA });
      try {
        const observer = await manager.run("a");
        await observer.result;
      } catch (err) {
        expect(data).toHaveLength(0);
      }
    });

    it("task's undo method should be executed atomically (sync)", async () => {
      const data: any[] = [];

      class TaskA extends BaseTask {
        main() {
          data.push(1);
          data.push(2);
          throw new RuntimeException("task error");
        }

        async undo() {
          await promise.delay(1000);
          data.length = 0;
        }
      }

      await manager.addTask({ name: "a", task: TaskA });
      try {
        const observer = await manager.run("a");
        await observer.result;
      } catch (err) {
        expect(data).toHaveLength(0);
      }
    });
  });

  describe("task notifications", () => {
    class Task1 extends BaseTask {
      async main() {
        this.manager.notify(this, "progress", {
          value: 0.1,
          message: "step1"
        });

        await promise.delay(1);

        this.manager.notify(this, "progress", {
          value: 0.5,
          message: "step2"
        });

        await promise.delay(1);

        this.manager.notify(this, "progress", {
          value: 1.0,
          message: "step3"
        });
      }
    }

    class Task2 extends BaseTask {
      async main() {
        this.manager.notify(this, "p", {
          value: 0.2,
          message: "bam1"
        });

        await promise.delay(1);

        this.manager.notify(this, "pro", {
          value: 0.6,
          message: "bam2"
        });

        await promise.delay(1);

        this.manager.notify(this, "progre", {
          value: 0.8,
          message: "bam3"
        });
      }
    }

    it("add same observer second time shoud have thrown", async () => {
      const observer = () => { };
      manager.onNotification("progress", observer);
      expect(() => manager.onNotification("progress", observer)).toThrow(ExistsException);
    });

    it("add same observer for any notification second time shoud have thrown", async () => {
      const observer = () => { };
      manager.onNotification(null, observer);
      expect(() => manager.onNotification(null, observer)).toThrow(ExistsException);
    });

    it("observe all notifications", async () => {
      await manager.addTask({ name: "1", task: Task1 });

      let i = 1;
      const values = [0.1, 0.5, 1.0];

      manager.onNotification("progress", (task, name, data) => {
        expect(isTask(task)).toBeTruthy();
        expect(name).toEqual("progress");
        expect(values[i - 1]).toEqual(data.value);
        expect(`step${i++}`).toEqual(data.message);
      });

      await manager.runAndWait("1");

      expect(i).toEqual(4);
    });

    it("observe notifications from specific task", async () => {
      await manager.addTask({ name: "1", task: Task1 });
      await manager.addTask({ name: "2", task: Task2 });

      let i = 1;
      const values = [0.1, 0.5, 1.0];

      manager.onNotification({
        name: "progress",
        task: "1"
      }, (task, name, data) => {
        expect(isTask(task)).toBeTruthy();
        expect(name).toEqual("progress");
        expect(values[i - 1]).toEqual(data.value);
        expect(`step${i++}`).toEqual(data.message);
      });

      await Promise.all([
        manager.runAndWait("1"),
        manager.runAndWait("2")
      ]);

      // await promise.promise.delay(300);
      expect(i).toEqual(4);
    });

    it("observe all notifications", async () => {
      await manager.addTask({ name: "1", task: Task1 });
      await manager.addTask({ name: "2", task: Task2 });

      let i = 0;
      const values = [0.1, 0.5, 1.0, 0.2, 0.6, 0.8];
      const messages = ["step1", "step2", "step3", "bam1", "bam2", "bam3"];

      manager.onNotification(null, (task, name, data) => {
        expect(isTask(task)).toBeTruthy();
        expect(values.includes(data.value)).toBeTruthy();
        expect(messages.includes(data.message)).toBeTruthy();
        i++;
      });

      await Promise.all([
        (await manager.run("1")).result,
        (await manager.run("2")).result
      ]);

      expect(i).toEqual(6);
    });

    it("observe notification accepts by function selector", async () => {
      await manager.addTask({ name: "1", task: Task1 });
      await manager.addTask({ name: "2", task: Task2 });

      let i = 0;
      const values = [0.2, 0.6, 0.8];
      const messages = ["bam1", "bam2", "bam3"];

      manager.onNotification((task) => task.observer.taskName === "2", (task, name, data) => {
        expect(isTask(task)).toBeTruthy();
        expect(task.observer.taskName === "2").toBeTruthy();
        expect(values.includes(data.value)).toBeTruthy();
        expect(messages.includes(data.message)).toBeTruthy();
        i++;
      });

      await Promise.all([
        (await manager.run("1")).result,
        (await manager.run("2")).result
      ]);

      expect(i).toEqual(3);
    });
  });

  describe("tasks decorators", () => {

    @Task({
      name: "1"
    })
    class Task1 extends BaseTask {
      main() {
        return 8;
      }
    }

    @Task("2")
    class Task2 extends BaseTask {
      main() {
        return 8;
      }
    }

    @Task({
      suspendable: true,
      cancelable: true,
      concurrency: 12,
      interval: 10,
      singleton: true,
      description: "regular",
      tag: "common"
    })
    class Task3 extends BaseTask {
      main() {
        return 8;
      }
    }

    it("use name from task meta (object)", async () => {
      await manager.addTask({ task: Task1 });

      expect(manager.hasTask("1")).toBeTruthy();
      expect(await manager.runAndWait("1")).toEqual(8);
    });

    it("use name from task meta (string)", async () => {
      await manager.addTask({ task: Task2 });

      expect(manager.hasTask("2")).toBeTruthy();
      expect(await manager.runAndWait("2")).toEqual(8);
    });

    it("should get task parameters from meta", async () => {
      await manager.addTask({ name: "3", task: Task3 });

      expect(manager.hasTask("3")).toBeTruthy();
      const actual = omit(manager.getTask("3"), "throttle");
      expect(omit(actual, ["runner", "runners"])).toEqual({
        name: "3",
        Class: Task3,
        suspendable: true,
        cancelable: true,
        concurrency: 12,
        interval: 10,
        singleton: true,
        description: "regular",
        domain: undefined
      });
    });

    it("argument options take precedence over meta options", async () => {
      await manager.addTask({
        suspendable: false,
        concurrency: 100,
        name: "3",
        description: "non-regular",
        task: Task3
      });
      const ti = manager.getTask("3");
      expect(ti.suspendable).toEqual(false);
      expect(ti.concurrency).toEqual(100);
      expect(ti.description).toEqual("non-regular");
    });
  });

  describe("loadTasksFrom()", () => {
    it("single location", async () => {
      await manager.loadTasksFrom(upath.join(__dirname, "fixtures"));

      expect(manager.hasTask("1")).toBeTruthy();
      expect(manager.hasTask("2")).toBeTruthy();
      expect(manager.hasTask("3")).toBeTruthy();
    });

    it("multiple location", async () => {
      const basePath = upath.join(__dirname, "fixtures");
      await manager.loadTasksFrom([
        basePath,
        upath.join(basePath, "other"),
        upath.join(basePath, "multi"),
      ]);

      expect(manager.hasTask("1")).toBeTruthy();
      expect(manager.hasTask("2")).toBeTruthy();
      expect(manager.hasTask("3")).toBeTruthy();
      expect(manager.hasTask("4")).toBeTruthy();
      expect(manager.hasTask("5")).toBeTruthy();
      expect(manager.hasTask("6")).toBeTruthy();
    });
  });










  // // describe.only("contexts", () => {
  // //     const {
  // //         task: { Manager }
  // //     } = ateos;

  // //     it("manager api", () => {
  // //         const manager = new Manager();


  // //         assert.isFunction(manager.getIsolate);
  // //         assert.isFunction(manager.getContextBook);
  // //     });

  // //     it("create std context with defaults", async () => {
  // //         const manager = new Manager();
  // //         const stdContext = await manager.getContextBook().createContext("main");
  // //         assert.isObject(stdContext);

  // //         class MyTask extends Task {
  // //             run(a, b) {
  // //                 global.a = a;
  // //                 global.b = b;
  // //                 global.c = a + b;
  // //                 return global.c;
  // //             }
  // //         }

  // //         manager.addTask("my", MyTask);
  // //         const observer = await manager.runInContext(stdContext, "my", 1, 2);
  // //         const result = await observer.result;
  // //         console.log(result);
  // //     });

  // // });

});

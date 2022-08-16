import { BaseTask, Task } from "../../lib";

@Task("3")
export default class Task3 extends BaseTask {
  main() {
    return 3;
  }
}

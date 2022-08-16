import { BaseTask, Task } from "../../lib";

@Task({
  name: "2"
})
export default class Task2 extends BaseTask {
  main() {
    return 2;
  }
}

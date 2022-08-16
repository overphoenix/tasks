import { BaseTask, Task } from "../../lib";

@Task({
  name: "1"
})
export default class Task1 extends BaseTask {
  main() {
    return 1;
  }
}

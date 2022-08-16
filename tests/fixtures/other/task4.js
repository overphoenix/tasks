import { BaseTask, Task } from "../../../lib";

@Task({
  name: "4"
})
export default class Task4 extends BaseTask {
  main() {
    return 4;
  }
}

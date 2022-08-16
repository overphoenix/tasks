import { BaseTask, Task } from "../../../lib";

@Task({
    name: "5"
})
export class Task5 extends BaseTask {
    main() {
        return 5;
    }
}

@Task({
    name: "6"
})
export class Task6 extends BaseTask {
    main() {
        return 6;
    }
}


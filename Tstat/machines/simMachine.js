const Machine = require("./machine_v3");

class SimMachine extends Machine {
    constructor(opts) {
        super(opts);
        this.init();
    }
    init() {
        console.log(`${this.data.name} setup. init pin ${this.data.pin}`);
        if (!this[this.data.initialFunc]()) throw new Error(`${this.data.name} init failed!`);
        this.state = this.data.initialState;
        console.log(`${this.data.name} SimMachine init complete`);
    }
    stop() {
        console.log(`@${this.data.name} SimMachine setting pin to off`);
        super.stop();
        return true;
    }
    start() {
        console.log(`@${this.data.name} SimMachine setting pin to on`);
        super.start();
        return true;
    }
}

module.exports = SimMachine;
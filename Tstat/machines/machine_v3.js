

const {client, dataBus} = require("../global.js");

const testOptions = {
    name: 'fan',
    neededClass: 'simMachine',
    pin: 5,
    initialState: 'idle',
    initialFunc: 'stop',
    states: {
        idle: {
            run: {
                actions: {
                    0: {
                        func: 'delay',
                        options: {
                            timer: 'idle',
                            minTime: 20000
                        }
                    },
                    1: {
                        func: 'start'
                    }
                },
                success: 'run',
                fail: 'idle'
            }
        },
        run: {
            idle: {
                actions: {
                    0: {
                        func: 'stop'
                    }
                },
                success: 'idle',
                fail: 'run'
            }
        }
    },
    timers: {
        idle: 0,
        run: 0,
    },
    accumulators: {
        idle: 0,
        run: 0,
    }
};

class Machine {
    constructor(opts) {
        this.data = opts;
        this.shutdownNow = false;
        this.machineInit();
    }
    async poll(req){
        //console.log(`${this.data.name} poll request ${req}`);
        if (this.shutdownNow === true) return false;
        let stateKnown = 0;
        for (let state in this.data.states) {
            if (this.state === state) stateKnown = 1;
        }
        if (stateKnown != 1) throw new Error(`${this.data.name} poll FSM in unknown state!`);
        if (this.state === req) {
            console.log(`${this.data.name} poll request ${req} already in this state SUCCESS`);
            return true;
        }
        let transition = 0;
        for (let trans in this.data.states[this.state]) {
            if (req === trans) transition = 1;
        }
        if (transition != 1) throw new Error(`${this.data.name} poll request ${req} not found`);
        
        for (let actions in this.data.states[this.state][req].actions) {
            if (!this[this.data.states[this.state][req].actions[actions].func](this.data.states[this.state][req].actions[actions].options)) {
                //console.log(`${this.data.name} poll request ${req} blocked in action ${actions} FAIL`);
                return false;
            }
        }
        this.state = this.data.states[this.state][req].success;
        this.eventEmit(this.state);
        console.log(`${this.data.name} poll request ${req} Moved to new state ${this.state} SUCCESS`);
        return true;
    }
    machineInit() {
        //set all timers to now.
        for (let timer in this.data.timers) {
            this.data.timers[timer] = Date.now();
        }
        console.log(`Machine ${this.data.name} init complete`);
    }
    delay(options){
        let lastTime = this.data.timers[options.timer];
        if (Date.now()-lastTime > options.minTime) return true;
        return false;
    }
    stop(){
        this.data.timers.idle = Date.now();
        if (this.state !== 'idle') this.data.accumulators.run = this.data.accumulators.run + (Date.now() - this.data.timers.run);
        console.log(`Machine Stop @${this.data.name} run time ${this.data.accumulators.run/1000} seconds`);
    }
    start(){
        this.data.timers.run = Date.now();
        if (this.state !== 'run') this.data.accumulators.idle = this.data.accumulators.idle + (Date.now() - this.data.timers.idle);
        console.log(`Machine Start @${this.data.name} idle time ${this.data.accumulators.idle/1000} seconds`);
    }
    eventEmit(msg) {
        client.publish(`home/hvac/machines/${this.data.name}`, msg);
        dataBus.emit(this.data.name, msg);
        dataBus.emit(`${this.data.name}/${msg}`);
    }
    shutDown() {
        console.log(`Stopping ${this.data.name} NOW!`);
        this.shutdownNow = true;
        this.stop();
        this.eventEmit(this.data.initialState);
    }
    resend() {
        if (this?.state === undefined) return;
        client.publish(`home/hvac/machines/${this.data.name}`, this.state);
    }
}


module.exports = Machine;

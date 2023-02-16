const Machine = require("./machine_v3");
const {pigpio} = require("../global.js");
const Gpio = pigpio.Gpio;

const gpioDefaults = {
    
    deviceOn: 0,
    deviceOff: 1,
};

class GpioMachine extends Machine {
    constructor(opts) {
        super(opts);
        this.init();
    }
    init() {
        //console.log(`${this.data.name} setup. init pin ${this.data.pin}`);
        if (this.data?.deviceOn === undefined) this.data.deviceOn = gpioDefaults.deviceOn;
        if (this.data?.deviceOff === undefined) this.data.deviceOff = gpioDefaults.deviceOff;
        this.gpio = new Gpio(this.data.pin, {mode: Gpio.OUTPUT});
        if (!this[this.data.initialFunc]()) throw new Error(`${this.data.name} init failed!`);
        this.state = this.data.initialState;
        console.log(`${this.data.name} init complete`);
    }
    stop() {
        console.log(this.gpio.digitalWrite(this.data.deviceOff));
        super.stop();
        return true;
    }
    start() {
        console.log(this.gpio.digitalWrite(this.data.deviceOn));
        super.start();
        return true;
    }
}

module.exports = GpioMachine;
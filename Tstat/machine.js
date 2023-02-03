
const devOn = 1;
const devOff = 0;

Gpio = require('onoff').Gpio;
const {client} = require("./global.js");


function Machine(delay, pin, name, rate = 1000) {
    this.name = name;
    this.delayTime = delay || 0;
    this.pin = pin;
    this.rate = rate;
    this.state = 'idle';
    this.request = 'stop';
    this.lastOffTime = 48309836520000;
    this.states = {
        idle: {
            start: {
                action: 'delayCheck',
                successState: 'run',
                failState: 'delay'
            }
        },
        delay: {
            start: {
                action: 'delayCheck',
                successState: 'run'
            },
            stop: {
                action: 'success',
                successState: 'idle'
            }
        },
        run: {
            stop: {
                action: 'stop',
                successState: 'idle'
            }
        }
    };
    this.gpio = new Gpio(this.pin, 'out');
    setInterval(() => {this.poll()}, rate);
}

Machine.prototype.delayCheck = function() {
    // check delay. transiton to on.
    console.log(`${this.name} delay check`);
    if (Date.now() - this.lastOffTime < this.delayTime) return 0;
    console.log(`${this.name} starting fan`);
    this.gpio.writeSync(devOn);
    return 1;
}

Machine.prototype.stop = function() {
    // transition to stop
    console.log(`${this.name} stop`);
    this.lastOffTime = Date.now();
    //stop function.
    this.gpio.writeSync(devOff);
    return 1;
}

Machine.prototype.poll = function() {
    // attempt to transition.
    //console.log(`${this.name} poll state:${this.state}, request:${this.request}`);
    if (this.lastOffTime == 48309836520000) this.lastOffTime = Date.now();
    //logic
    let action = this.states?.[this.state]?.[this.request]?.action
    let result = 0;
    if (action === undefined) return;
    if (action === 'success') result = 1; else result = this[this.states[this.state][this.request].action]();
    if (result !== 1) {
        if (this.states?.[this.state]?.[this.request]?.failState !== undefined) this.state = this.states[this.state][this.request].failState;
        return;
    }
    this.state = this.states[this.state][this.request].successState;
}

Machine.prototype.newRequest = function(req) {
    console.log(`${this.name} newRequest ${req}`);
    if (req === 'start' || req === 'stop') this.request = req; 
}

module.exports = Machine;
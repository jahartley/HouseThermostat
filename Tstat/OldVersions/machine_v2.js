
const deviceOn = 0;
const deviceOff = 1;

const {client, pigpio, dataBus} = require("./global.js");
const Gpio = pigpio.Gpio;

/* 
    machine states idle, delay, run.
    requests start, stop.

*/

class Machine {
    constructor(name, pin, rate = 1000) {
        this.name = name;
        this.pin = pin;
        this.rate = rate;
        this.state = 'idle';
        this.request = 'stop';
        this.lastOffTime = Date.now();
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
    }
    
}

module.exports = Machine;

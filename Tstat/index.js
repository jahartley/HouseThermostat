


/*
    events start stop.


    TODO:
        Make System State Machine.
        Make Modes...
        Make Config...
        Make Schedules...
        Make Setpoints...
*/
const {client, pigpio, dataBus} = require("./global.js");

pigpio.initialize();

const gracefulShutdown = () => {
    console.log(`Shutting down.`);
    clearInterval(watchdog);
    client.publish('home/pi64', 'shutdown');
    client.end();
    for (let machine in lotsOfMachines) {
        lotsOfMachines[machine].newRequest('stop');
    }
    
    for (let sensor in sensors) {
        sensors[sensor].close();
    }
    setTimeout(() => {console.log("Stopping pigpio"); pigpio.terminate();}, 5000);
    setTimeout(() => {console.log("Terminating"); process.exit();}, 8000);

}

process.on('SIGHUP', gracefulShutdown);
process.on('SIGCONT', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

process.on('uncaughtException', (err) => {
    console.log(`PROCESS ON ERROR CAUGHT at ${new Date()}`);
    console.trace(err);
});


const Machine = require("./machine.js");
const Bme = require("./Bme_v2.js");
const DsTs = require("./Ds18_v4.js");
const Serial = require("./Serial_v2.js");



const options0 = {
    i2cBusNo   : 1, // defaults to 1
    i2cAddress : 0x76 // defaults to 0x77
};
const options1 = {
    i2cBusNo   : 1, // defaults to 1
    i2cAddress : 0x77 // defaults to 0x77
};


//const first = new Bme(options0, "Upstream", 10000);
//const second = new Bme(options1, "Downstream", 10000);

const sensors = {};
sensors[0] = new Bme("DuctBeforeHVAC", options1, 10000);
sensors[1] = new Bme("DuctAfterHVAC", options0, 10000);
sensors[2] = new DsTs("Line Temps");
sensors[3] = new Serial("Hallway");

client.on('connect', () => {
    client.subscribe('home/boss/resend');
    client.publish('home/pi64', 'ok');
})

client.on('message', function(topic, message) {
    if (topic.toString() == 'home/boss/resend' && message.toString() == '1') {
      client.publish('home/pi64', 'ok');
      for (let i in sensors) {
        sensors[i].resend();
      }
    }
});

//watchdog
const watchdog = setInterval(() => {
    client.publish('home/pi64', 'ok');
}, 300000);

let lotsOfMachines = {};
lotsOfMachines[0] = new Machine(10000, 5, "Fan ONE");
lotsOfMachines[1] = new Machine(10000, 6, "Heat ONE");
lotsOfMachines[2] = new Machine(10000, 13, "Cool ONE");

console.log(lotsOfMachines[0].state);
setTimeout(() => {lotsOfMachines[0].newRequest('start')}, 7000);
setTimeout(() => {lotsOfMachines[0].newRequest('stop')}, 10000);
setTimeout(() => {lotsOfMachines[0].newRequest('start')}, 13000);
setTimeout(() => {lotsOfMachines[0].newRequest('stop')}, 23000);
setTimeout(() => {lotsOfMachines[0].newRequest('start')}, 25000);

class Ema {
    constructor(name, samples, stale) {
        this.name = name;
        this.weight = (2/(samples+1));
        this.stale = stale;
        this.timer = 0;
        this.ema = 0;
        dataBus.on(this.name, (value) => this.pushValue(value));
    }
    getValue () {
        if (Date.now()-this.timer > this.stale) {
            return null;
        } else {
            return this.ema;
        }
    }
    pushValue(value) {
        let float = parseFloat(value);
        if (Date.now()-this.timer > this.stale) {
            //ema stale. reset.
            this.ema = float.toFixed(3);
        } else {
            let emaValue = ((float - this.ema)*this.weight)+this.ema;
            this.ema = emaValue.toFixed(3);
        }
        
        console.log(`${this.name} ema: ${this.ema} value: ${value} tDiff: ${Date.now()-this.timer}`);
        this.timer = Date.now();
    }
}

const ema1 = new Ema('Hallway/temperature', 10, 60000);
const ema2 = new Ema('Line Temps/28-0316a27915ac', 10, 60000);

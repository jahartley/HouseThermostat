


/*
    events start stop.


    TODO:
        Make System State Machine.
        Make Modes...
        Make Config...
        Make Schedules...
        Make Setpoints...
*/
const {client, pigpio} = require("./global.js");

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
    setTimeout(() => pigpio.terminate(), 5000);

}

process.on('SIGHUP', gracefulShutdown);
process.on('SIGCONT', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

process.on('uncaughtException', (err) => {
    console.log('PROCESS ON ERROR CAUGHT');
    console.trace(err);
});


const Machine = require("./machine.js");
const Bme = require("./Bme.js");
const DsTs = require("./Ds18_v3.js");
const Serial = require("./Serial.js");



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
sensors[0] = new Bme(options1, "Before", 10000);
sensors[1] = new Bme(options0, "After", 10000,0,1.265,0);
sensors[2] = new DsTs(10000);
sensors[3] = new Serial();

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

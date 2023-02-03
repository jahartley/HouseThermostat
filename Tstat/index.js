


/*
    events start stop.


    TODO:
        Make System State Machine.
        Make Modes...
        Make Config...
        Make Schedules...
        Make Setpoints...
*/

const Machine = require("./machine.js");
const {client} = require("./global.js");
const Bme = require("./sensor.js");
const DsTs = require("./sensor.js");

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
sensors[0] = new Bme(options1, "Upstream", 10000);
sensors[1] = new Bme(options0, "Downstream", 11000);
sensors[2] = new DsTs(12000);


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
setInterval(() => {
    client.publish('home/pi64', 'ok');
}, 300000);

let lotsOfMachines = {};
lotsOfMachines[0] = new Machine(10000, 0, "Fan ONE");
lotsOfMachines[1] = new Machine(10000, 2, "Heat ONE");
lotsOfMachines[2] = new Machine(10000, 3, "Cool ONE");

console.log(lotsOfMachines[0].state);
setTimeout(() => {lotsOfMachines[0].newRequest('start')}, 7000);
setTimeout(() => {lotsOfMachines[0].newRequest('stop')}, 10000);
setTimeout(() => {lotsOfMachines[0].newRequest('start')}, 13000);
setTimeout(() => {lotsOfMachines[0].newRequest('stop')}, 23000);
setTimeout(() => {lotsOfMachines[0].newRequest('start')}, 25000);

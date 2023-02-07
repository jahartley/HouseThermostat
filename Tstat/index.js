


/*
    events start stop.


    TODO:
        Make System State Machine.
        Make Modes...
        Make Config...
        Make Schedules...
        Make Setpoints...
*/
process.on('uncaughtException', function(err) {
    console.log('Caught exception: ' + err);
});


let remoteTemperature = -150;
let remoteBmeTemperature = -150
let remoteBmeHumidity = -150;
let remoteBmePressure = -150;
let remoteBmeAq = -1;
let remoteHour = -1;
let remomteMinute = -1;
let remoteSecond = -1;

const Machine = require("./machine.js");
const {client} = require("./global.js");
const Bme = require("./Bme.js");
const DsTs = require("./Ds18_v2.js");

const { SerialPort } = require('serialport');
const { DelimiterParser } = require('@serialport/parser-delimiter');
const port = new SerialPort({ path: '/dev/serial0', baudRate: 9600});
const parser = port.pipe(new DelimiterParser({ delimiter: '\n' }));

parser.on('data', (data) => {
    //console.log(data);
    //console.log(`to string: ${data.toString()}`);
    let newData = data.toString();
    let header = newData.slice(0,1);
    //console.log(newData);
    /* 
        t70.25
        y70.1
        b35.3
        g653643
        p96159
        Time 0:52:36

    */
    switch(header) {
        case 't':
            remoteTemperature = parseFloat(newData.slice(1,newData.length-1));
            console.log(remoteTemperature);
            break;
        case 'y':
            remoteBmeTemperature = parseFloat(newData.slice(1,newData.length-1));
            break;
        case 'b':
            remoteBmeHumidity = parseFloat(newData.slice(1,newData.length-1));
            break;
        case 'g':
            remoteBmeAq = parseFloat(newData.slice(1,newData.length-1));
            break;
        case 'p':
            remoteBmePressure = parseFloat(newData.slice(1,newData.length-1))/100;
            console.log(`Remote pressure: ${remoteBmePressure}`);
            break;
        case 'T':
            let timeString = newData.slice(5, newData.length-1);
            let timeString2 = timeString.split(':');
            if (timeString2.length != 3) break;
            let date2 = new Date(Date.now());
            remoteHour = timeString2[0];
            if (remoteHour != date2.getHours()) port.write(`o${date2.getHours()}\r\n`);
            remomteMinute = timeString2[1];
            if (remomteMinute != date2.getMinutes()) port.write(`m${date2.getMinutes()}\r\n`);
            remoteSecond = timeString2[2];
            if (remoteSecond != date2.getSeconds()) port.write(`s${date2.getSeconds()}\r\n`);
            console.log(`time: ${remoteHour} ${remomteMinute} ${remoteSecond}`);
    }
});

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
sensors[1] = new Bme(options0, "Downstream", 11000,0,1.265,0);
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
lotsOfMachines[0] = new Machine(10000, 5, "Fan ONE");
lotsOfMachines[1] = new Machine(10000, 6, "Heat ONE");
lotsOfMachines[2] = new Machine(10000, 13, "Cool ONE");

console.log(lotsOfMachines[0].state);
setTimeout(() => {lotsOfMachines[0].newRequest('start')}, 7000);
setTimeout(() => {lotsOfMachines[0].newRequest('stop')}, 10000);
setTimeout(() => {lotsOfMachines[0].newRequest('start')}, 13000);
setTimeout(() => {lotsOfMachines[0].newRequest('stop')}, 23000);
setTimeout(() => {lotsOfMachines[0].newRequest('start')}, 25000);

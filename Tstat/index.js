
/*
    events start stop.


    TODO:
        Make System State Machine.
        Make Modes...
        Make Config...
        Make Schedules...
        Make Setpoints...
*/





console.log("-------------------------------------------------");
const {client, pigpio, dataBus} = require("./global.js");
const hvacLogic = require("./hvacLogic.js");
const ductPressureMonitor = require("./auxFunctions/ductPressureMonitor.js");


try {
    pigpio.initialize();
} catch (err) {
    console.log("************************PIGPIO STARTUP ERROR REBOOT PI*********************************");
    console.trace(err);
    //gracefulShutdown();
}


const hvac1 = new hvacLogic();
const dpm = new ductPressureMonitor();

const gracefulShutdown = () => {
    console.log(`Shutting down.`);
    dataBus.removeAllListeners();
    hvac1.shutDown();
    clearInterval(watchdog);
    client.publish('home/pi64', 'shutdown');
    client.end();
    console.log("pigpio terminate");
    pigpio.terminate();
    console.log("complete");
    //setTimeout(() => {console.log("Stopping pigpio"); pigpio.terminate();}, 5000);
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


// //const Machine = require("./machine.js");
// const Bme = require("./Bme_v2.js");
// const DsTs = require("./Ds18_v4.js");
// const Serial = require("./Serial_v2.js");



// const options0 = {
//     i2cBusNo   : 1, // defaults to 1
//     i2cAddress : 0x76 // defaults to 0x77
// };
// const options1 = {
//     i2cBusNo   : 1, // defaults to 1
//     i2cAddress : 0x77 // defaults to 0x77
// };


//const first = new Bme(options0, "Upstream", 10000);
//const second = new Bme(options1, "Downstream", 10000);

// const sensors = {};
// sensors[0] = new Bme("DuctBeforeHVAC", options1, 10000);
// sensors[1] = new Bme("DuctAfterHVAC", options0, 10000);
// sensors[2] = new DsTs("Line Temps");
// sensors[3] = new Serial("Hallway");



client.on('connect', () => {
    client.subscribe('home/boss/resend');
    client.subscribe('home/hvac/control/userFanMode');
    client.subscribe('home/hvac/control/userMode');
    client.subscribe('home/hvac/control/setpoint');
    client.publish('home/pi64', 'ok');
})

client.on('message', function(topic, message) {
    if (topic.toString() == 'home/boss/resend' && message.toString() == '1') {
      client.publish('home/pi64', 'ok');
      hvac1.resend();
    }
    if (topic.toString() == 'home/hvac/control/userFanMode') {
        hvac1.setUserFanMode(message.toString());
    }
    if (topic.toString() == 'home/hvac/control/userMode') {
        hvac1.setUserMode(message.toString());
    }
    if (topic.toString() == 'home/hvac/control/setpoint') {
        hvac1.setSetPointAuto(parseFloat(message));
    }

});

//watchdog
const watchdog = setInterval(() => {
    client.publish('home/pi64', 'ok');
}, 300000);

// class tempSorter {
//     constructor() {
//         this.primaryTempName = "Hallway/temperature/ema";
//         this.backupTempName = "Hallway/BME680temperature/ema";
//     }
//     pushValue(name, value) {
//         if (name === this.primaryTempName) hvac1.tempLogicWorker(parseFloat(value));
//     }
// }



// dataBus.on("Hallway/temperature/ema", (temp) => {
//     hvac1.tempLogicWorker(parseFloat(temp));
// });



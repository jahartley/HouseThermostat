


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
const {client, pigpio, dataBus, globalStatus} = require("./global.js");
const hvacLogic = require("./hvacLogic.js");
const ductPressureMonitor = require("./auxFunctions/ductPressureMonitor.js");
const PsychroCalc = require("./auxFunctions/psychrometricCalc.js");


globalStatus.set('INIT');

try {
    pigpio.initialize();
} catch (err) {
    console.log("************************PIGPIO STARTUP ERROR REBOOT PI*********************************");
    console.trace(err);
    //gracefulShutdown();
}


const hvac1 = new hvacLogic();
const dpm = new ductPressureMonitor();
const hallwayPsy = new PsychroCalc("Hallway");
const outsidePsy = new PsychroCalc("Outside");
const DuctBeforeHVACPsy = new PsychroCalc("DuctBeforeHVAC");
const DuctAfterHVACPsy = new PsychroCalc("DuctAfterHVACPsy");

const gracefulShutdown = () => {
    console.log(`Shutting down.`);
    dataBus.removeAllListeners();
    hvac1.shutDown();
    clearInterval(watchdog);
    clearInterval(watchdog2);
    globalStatus.set('shutdown');
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
    client.subscribe('rtl_433/Acurite-5n1/msg56');
})

client.on('message', function(topic, message) {
    if (topic.toString() == 'home/boss/resend' && message.toString() == '1') {
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
    if (topic.toString() == 'rtl_433/Acurite-5n1/msg56') {
        let msg = JSON.parse(message);
        if (msg?.temperature_F != undefined) outsidePsy.setTempF(msg.temperature_F);
        if (msg?.humidity != undefined) outsidePsy.setHumidityRH(msg.humidity);
    }
});



//watchdog
const watchdog = setInterval(() => {
    //client.publish('home/pi64', 'ok');
    globalStatus.set('ok');
}, 300000);

//watchdog2
let lastTime = Math.floor(Date.now() / 1000);

dataBus.on("Hallway/temperature/ema", (temp) => {
    lastTime = Math.floor(Date.now() / 1000);
});

dataBus.on("Hallway/temperature/pub", (value) => {
    hallwayPsy.setTempF(value);
});
dataBus.on("Hallway/humidity/pub", (value) => {
    hallwayPsy.setHumidityRH(value);
});
dataBus.on("Hallway/pressure/pub", (value) => {
    hallwayPsy.setPressuremBar(value);
    outsidePsy.setPressuremBar(value);
    if (hvac1.machines.cool.isRunning() && hvac1.machines.cool.hasRunFor(30000) ||
    hvac1.machines.heat.isRunning() && hvac1.machines.heat.hasRunFor(60000)) {
        DuctBeforeHVACPsy.setPressuremBar(value);
        DuctAfterHVACPsy.setPressuremBar(value);
    }
});

dataBus.on("DuctBeforeHVAC/temperature/pub", (value) => {
    if (hvac1.machines.cool.isRunning() && hvac1.machines.cool.hasRunFor(30000) ||
    hvac1.machines.heat.isRunning() && hvac1.machines.heat.hasRunFor(60000)) {
        DuctBeforeHVACPsy.setTempF(value);
    }
});
dataBus.on("DuctBeforeHVAC/humidity/pub", (value) => {
    if (hvac1.machines.cool.isRunning() && hvac1.machines.cool.hasRunFor(30000) ||
    hvac1.machines.heat.isRunning() && hvac1.machines.heat.hasRunFor(60000)) {
        DuctBeforeHVACPsy.setHumidityRH(value);
    }
});

dataBus.on("DuctAfterHVAC/temperature/pub", (value) => {
    if (hvac1.machines.cool.isRunning() && hvac1.machines.cool.hasRunFor(30000) ||
    hvac1.machines.heat.isRunning() && hvac1.machines.heat.hasRunFor(60000)) {
        DuctAfterHVACPsy.setTempF(value);
    }
});
dataBus.on("DuctAfterHVAC/humidity/pub", (value) => {
    if (hvac1.machines.cool.isRunning() && hvac1.machines.cool.hasRunFor(30000) ||
    hvac1.machines.heat.isRunning() && hvac1.machines.heat.hasRunFor(60000)) {
        DuctAfterHVACPsy.setHumidityRH(value);
    }
});

dataBus.on("DuctBeforeHVAC/temperature/ema", (temp) => {
    //console.log("Duct Before temp: ", temp);
});

const watchdog2 = setInterval(() => {
    if (Math.floor(Date.now() / 1000)-45 > lastTime) {
        console.log("************************ WATCHDOG 2 FAIL RESTART TSTAT *********************************");
        console.log(new Date(lastTime*1000));
        globalStatus.set('Serial Temperature Error!');
        hvac1.sensors.Hallway.restart();
        //gracefulShutdown();
    }
}, 60000);

// class tempSorter {
//     constructor() {
//         this.primaryTempName = "Hallway/temperature/ema";
//         this.backupTempName = "Hallway/BME680temperature/ema";
//     }
//     pushValue(name, value) {
//         if (name === this.primaryTempName) hvac1.tempLogicWorker(parseFloat(value));
//     }
// }



const {client} = require("./global.js");
const DS18B20 = require('ds2482-temperature');

function DsTs(rate) {
    this.rate = rate;
    //this.sense = new DS18B20({pollRate: this.rate});
    this.dataStore = {};
    
    //this.watchdogInterval = setInterval(() => this.watchdog(), this.rate*1000);
    // this.sense.init().
    // then(() => {
    //     this.sense.on('data', val => { console.log(val); console.log('onData'); });
    //     this.sense.on('error', err => { this.errorHandler(err, "onError");});
    // }).
    // catch((err) => { this.errorHandler(err, "DsTs constructor");});
    this.init();
}

DsTs.prototype.init = async function() {
    try {
        this.lastUpdate = Date.now();
        this.watchdogInterval = setInterval(() => this.watchdog(), this.rate);
        this.sense = new DS18B20({pollRate: this.rate/1000});
        await this.sense.init();
        this.sense.on('data', val => this.read(val));
        this.sense.on('error', err => { this.errorHandler(err, "onError");});
    } catch (err) {this.errorHandler(err, "init");}
}

DsTs.prototype.watchdog = function() {
    let timeNow = Date.now();
    if (timeNow - this.lastUpdate > (this.rate*3)) return this.errorHandler(new Error('Watchdog'), "Watchdog Ran Out");
}

DsTs.prototype.errorHandler = async function(err, where = 'unknown') {
    console.log(`DsTs Error Handler fault at ${where}`); 
    console.trace(err);
    console.log(`Resetting DsTs`);
    try {
        await this.sense.destroy();
        clearInterval(this.watchdogInterval);
        await this.init();
    } catch (err) {this.errorHandler(err, "ErrorHandler");}
}

DsTs.prototype.read = async function(data) {
    if (this.dataStore?.[data.rom] === undefined) {
        this.dataStore[data.rom] = {
            temperature: 0,
            temperatureOld: 0
        }
    }
    this.dataStore[data.rom].temperature = (data.value*1.8+32).toFixed(2);
    this.lastUpdate = Date.now();
    return this.publish(data.rom);
}

DsTs.prototype.publish = function(rom) {
    if (this.dataStore?.[rom] === undefined) return;
    let { temperature, temperatureOld} = this.dataStore[rom];
    if (Math.abs(temperature - temperatureOld) > 0.2) {
        client.publish(`home/hvac/DS18B20/${rom}/temperature`, temperature.toString());
        temperatureOld = temperature;
    }
}

DsTs.prototype.resend = function() {
    for (let rom in this.dataStore) {
        if (this.dataStore?.[rom] === undefined) continue;
        let { temperature } = this.dataStore[rom];
        if (temperature === 0) continue;
        client.publish(`home/hvac/DS18B20/${rom}/temperature`, temperature.toString());
    }
}

module.exports = DsTs;

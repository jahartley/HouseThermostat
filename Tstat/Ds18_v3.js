const {client} = require("./global.js");
const fs = require('fs').promises;
const W1_FILE = '/sys/bus/w1/devices/w1_bus_master1/w1_master_slaves';

function DsTs(rate) {
    this.rate = rate;
    this.sensors = [];
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

//try {} catch (err) {}

DsTs.prototype.init = async function () {
    try {
        let data = await fs.readFile(W1_FILE, 'utf8');    
        let parts = data.split('\n');
        parts.pop();
        this.sensors = parts;
        if (this.sensors.length === 0) throw new Error("No sensors found");
        this.interval = setInterval(() => {this.readTemps();}, this.rate);
        console.log(`DsTs found ${this.sensors.length} devices. Init Complete`);
    } catch (err) {this.errorHandler(err, "scan");}
}

DsTs.prototype.readTemps = async function() {
    try {
        for (i = 0; i < this.sensors.length; i++) {
            if (this.dataStore?.[this.sensors[i]] === undefined) {
                this.dataStore[this.sensors[i]] = {
                    temperature: 0,
                    temperatureOld: 0
                }
            }
            let data = await fs.readFile('/sys/bus/w1/devices/' + this.sensors[i] + '/w1_slave', 'utf8');
            let value = this.parseData(data);
            if (value === false)  throw new Error("Bad sensor reading");
            console.log(`DsTs sensor ${this.sensors[i]} value ${value}`);
            this.dataStore[this.sensors[i]].temperature = (value*1.8+32).toFixed(2);
            console.log(`DsTs sensor ${this.sensors[i]} corrected value ${this.dataStore[this.sensors[i]].temperature}`);
        }
        

    } catch (err) {this.errorHandler(err, "readTemps");}
}

DsTs.prototype.parseData = function (data) {
    let arr = data.split('\n');  
    if (arr[0].indexOf('YES') > -1) {
      let output = data.match(/t=(-?(\d+))/);
      console.log(output);
      return Math.round(output[1] / 100) / 10;
    } else if (arr[0].indexOf('NO') > -1) {
      return false;
    }
    throw new Error('Can not get temperature');
}

DsTs.prototype.errorHandler = async function(err, where = 'unknown') {
    console.log(`DsTs Error Handler fault at ${where}`); 
    console.trace(err);
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

const {client} = require("./global.js");
const fs = require('fs').promises;
const W1_FILE = '/sys/bus/w1/devices/w1_bus_master1/w1_master_slaves';

function DsTs(rate) {
    this.rate = rate;
    this.sensors = [];
    this.dataStore = {};
    this.init();
}

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

DsTs.prototype.close = function() {
    if (this.interval) clearInterval(this.interval);
}

DsTs.prototype.readTemps = async function() {
    try {
        for (i = 0; i < this.sensors.length; i++) {
            let rom = this.sensors[i];
            if (this.dataStore?.[rom] === undefined) {
                this.dataStore[rom] = {
                    temperature: 0,
                    temperatureOld: 0
                }
            }
            let data = await fs.readFile('/sys/bus/w1/devices/' + rom + '/w1_slave', 'utf8');
            let value = this.parseData(data);
            this.dataStore[rom].temperature = (value*1.8+32).toFixed(2);
            this.publish(rom);
        }
    } catch (err) {this.errorHandler(err, "readTemps");}
}

DsTs.prototype.parseData = function (data) {
    let arr = data.split('\n');
    if (arr[0].indexOf('YES') > -1) {
      let output = data.match(/t=(-?(\d+))/);
      return output[1] / 1000;
    } else if (arr[0].indexOf('NO') > -1) {
      throw new Error ('CRC check error');
    }
    throw new Error('Can not get temperature');
}

DsTs.prototype.errorHandler = async function(err, where = 'unknown') {
    console.log(`DsTs Error Handler fault at ${where}`); 
    console.trace(err);
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

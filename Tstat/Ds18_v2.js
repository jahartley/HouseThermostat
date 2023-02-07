const {client} = require("./global.js");
const DS18B20 = require('ds2482-temperature');

function DsTs(rate) {
    this.rate = rate/1000;
    this.sense = new DS18B20({pollRate: this.rate});
    this.dataStore = {};
    this.sense.init().
    then(() => {
        this.sense.on('data', val => { console.log(val); console.log('onData'); });
        this.sense.on('error', err => { this.errorHandler(err, "onError");});
    }).
    catch((err) => { this.errorHandler(err, "DsTs constructor");});
}

DsTs.prototype.errorHandler = async function(err, where = 'unknown') {
    console.log(`DsTs Error Handler fault at ${where}`); 
    console.trace(err);
    console.log(`Resetting DsTs`);
    try {
        await this.sense.destroy();
        this.sense = new DS18B20({pollRate: this.rate});
        await this.sense.init();
        this.sense.on('data', val => { console.log(val); console.log('onData'); });
        this.sense.on('error', err => { this.errorHandler(err, "onError");});
    } catch (err) {this.errorHandler(err, "ErrorHandler");}
}

DsTs.prototype.read = async function(data) {
    try {
        if (this.dataStore?.[data.rom] === undefined) {
            this.dataStore[data.rom] = {
                temperature: 0,
                temperatureOld: 0
            }
        }
        this.dataStore[data.rom].temperature = (data.value*1.8+32).toFixed(2);
    } catch (err) {this.errorHandler(err, "DsTs.read");}
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

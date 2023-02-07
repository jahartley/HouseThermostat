const {client} = require("./global.js");
const DS18B20 = require('@jahartley/ds2482-temperature');

function DsTs(rate) {
    this.rate = rate/1000;
    this.sense = new DS18B20({pollRate: this.rate});
    this.currentSensors = [];
    this.dataStore = {};
    this.sense.init().
    then(() => {
        this.sense.on('data', val => { console.log(val); });
        this.sense.on('error', err => { console.error(err); });
    }).
    catch((err) => {console.error(err); console.log("error at DsTs constructor");});
}

DsTs.prototype.read = async function() {
    try {
        let data = await this.sense.readTemperatures();
	    console.log(data);
        for (i = 0; i < data.length; i++) {
            if (this.dataStore?.[data[i].rom] === undefined) {
                this.currentSensors.push(data[i].rom);
                this.dataStore[data[i].rom] = {
                    temperature: 0,
                    temperatureOld: 0
                }
            }
            this.dataStore[data[i].rom].temperature = (data[i].value*1.8+32).toFixed(2);
        }
    } catch (err) { console.error(err); console.log("error at DsTs.read()");}
    return this.publish();
}

DsTs.prototype.publish = function() {
    for (i = 0; i < this.currentSensors.length; i++) {
        if (this.dataStore?.[this.currentSensors[i]] === undefined) continue;
        let { temperature, temperatureOld} = this.dataStore[this.currentSensors[i]];
        if (Math.abs(temperature - temperatureOld) > 0.2) {
            client.publish(`home/hvac/DS18B20/${this.currentSensors[i]}/temperature`, temperature.toString());
            temperatureOld = temperature;
        }
    }
}

DsTs.prototype.resend = function() {
    for (i = 0; i < this.currentSensors.length; i++) {
        if (this.dataStore?.[this.currentSensors[i]] === undefined) continue;
        let { temperature } = this.dataStore[this.currentSensors[i]];
        if (temperature === 0) continue;
        client.publish(`home/hvac/DS18B20/${this.currentSensors[i]}/temperature`, temperature.toString());
    }
}

module.exports = DsTs;

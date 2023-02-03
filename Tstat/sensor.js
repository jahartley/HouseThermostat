const {client} = require("./global.js");
const BME280 = require('bme280-sensor');
const DS18B20 = require('@jahartley/ds2482-temperature');

function Bme(opts, name, rate, tempCorrection = 0, pressureCorrection = 0, humidityCorrection = 0) {
    this.options = opts;
    this.name = name;
    this.rate = rate;
    this.bmeObj = new BME280(this.options);
    this.temperatureCorrection = tempCorrection;
    this.pressureCorrection = pressureCorrection;
    this.humidityCorrection = humidityCorrection;
    this.temperatureOld = 0;
    this.temperature = 0;
    this.pressureOld = 0;
    this.pressure = 0;
    this.humidityOld = 0;
    this.humidity = 0;
    this.bmeObj.init().then(async () => {
        setInterval(async () => {this.read()} ,this.rate);
    }).catch(console.error);
    
}

Bme.prototype.read = async function() {
    try {
        let data = await this.bmeObj.readSensorData();
        this.temperature = data.temperature_C*1.8+32+this.temperatureCorrection;
        this.temperature = this.temperature.toFixed(2);
        this.pressure = data.pressure_hPa + this.pressureCorrection;
        this.pressure = this.pressure.toFixed(3);
        this.humidity = data.humidity + this.humidityCorrection;
        this.humidity = this.humidity.toFixed(1);
    } catch (err) { console.error(err); }
    this.publish();
}

Bme.prototype.publish = function() {
    if ((this.temperature - this.temperatureOld) > 0.2 || (this.temperature - this.temperatureOld) < -0.2 ) {
        client.publish(`home/hvac/${this.name}/temperature`, this.temperature.toString());
        this.temperatureOld = this.temperature;
    }
    if ((this.pressure - this.pressureOld) > 0.2 || (this.pressure - this.pressureOld) < -0.2 ) {
        client.publish(`home/hvac/${this.name}/pressure`, this.pressure.toString());
        this.pressureOld = this.pressure;
    }
    if ((this.humidity - this.humidityOld) > 0.5 || (this.humidity - this.humidityOld) < -0.5 ) {
        client.publish(`home/hvac/${this.name}/humidity`, this.humidity.toString());
        this.humidityOld = this.humidity;
    }
}

Bme.prototype.resend = function() {
    if (this.temperature === 0) return;
    client.publish(`home/hvac/${this.name}/temperature`, this.temperature.toString());
    client.publish(`home/hvac/${this.name}/pressure`, this.pressure.toString());
    client.publish(`home/hvac/${this.name}/humidity`, this.humidity.toString());
}

function DsTs(rate) {
    this.rate = rate;
    this.sense = new DS18B20();
    this.currentSensors = [];
    this.dataStore = {};
}

DsTs.prototype.read = async function() {
    try {
        let data = await this.sense.readTemperatures();
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
    } catch (err) { console.error(err); }
    this.publish();
}

DsTs.prototype.publish = function() {
    for (i = 0; i < this.currentSensors.length; i++) {
        if (this.dataStore?.[this.currentSensors[i]] === undefined) continue;
        let { temperature, temperatureOld} = this.dataStore[this.currentSensors[i]];
        if ((temperature - temperatureOld) > 0.2 || (temperature - temperatureOld) < -0.2 ) {
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

module.exports = Bme, DsTs;
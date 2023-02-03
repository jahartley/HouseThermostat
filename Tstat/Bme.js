const {client} = require("./global.js");
const BME280 = require('bme280-sensor');

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
	console.log(data);
        this.temperature = parseFloat(data.temperature_C)*1.8+32+this.temperatureCorrection;
        this.temperature = this.temperature.toFixed(2);
        this.pressure = parseFloat(data.pressure_hPa) + this.pressureCorrection;
        this.pressure = this.pressure.toFixed(3);
        this.humidity = parseFloat(data.humidity) + this.humidityCorrection;
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

module.exports = Bme;

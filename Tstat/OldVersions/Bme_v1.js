const {client} = require("./global.js");
const BME280 = require('bme280-sensor');

function Bme(opts, name, rate, tempCorrection = 0, pressureCorrection = 0, humidityCorrection = 0) {
    this.options = opts;
    this.name = name;
    this.rate = rate;
    this.lastTime = 0;    
    this.temperatureCorrection = tempCorrection;
    this.pressureCorrection = pressureCorrection;
    this.humidityCorrection = humidityCorrection;
    this.temperatureOld = 0;
    this.temperature = 0;
    this.pressureOld = 0;
    this.pressure = 0;
    this.humidityOld = 0;
    this.humidity = 0;
    this.init();    
}

//try {} catch (err) {}

Bme.prototype.init = async function() {
    try {
        this.bmeObj = new BME280(this.options);
        await this.bmeObj.init();
        this.interval = setInterval(async () => {this.read()} ,this.rate);
    } catch (err) {this.errorHandler(err, "init");}
}

Bme.prototype.close = function() {
    if (this.interval) clearInterval(this.interval);
    console.log(`BME ${this.name} shutdown`);
}

Bme.prototype.errorHandler = async function(err, where = 'unknown') {
    console.log(`Bme Error Handler ${this.name} fault at ${where}`); 
    console.trace(err);
    console.log(`Resetting Bme ${this.name}`);
    try {
        if (this.interval) clearInterval(this.interval);
        await this.bmeObj.reset();
        await this.init();
    } catch (err) {this.errorHandler(err, "ErrorHandler");}


} 

Bme.prototype.read = async function() {
    try {
        let data = await this.bmeObj.readSensorData();
        let now = Date.now();
        let tdiff = now-this.lastTime;
        this.lastTime = now;
	//console.log(data);
        this.temperature = parseFloat(data.temperature_C)*1.8+32+this.temperatureCorrection;
        this.temperature = this.temperature.toFixed(3);
        if (Math.abs(this.temperature-this.temperatureOld) > 100 && tdiff < 30000) this.temperature = this.temperatureOld;
        this.pressure = parseFloat(data.pressure_hPa) + this.pressureCorrection;
        this.pressure = this.pressure.toFixed(3);
        if (Math.abs(this.pressure-this.pressureOld) > 20 && tdiff < 30000) this.pressure = this.pressureOld;
        this.humidity = parseFloat(data.humidity) + this.humidityCorrection;
        this.humidity = this.humidity.toFixed(3);
        if (Math.abs(this.humidity-this.humidityOld) > 20 && tdiff < 30000) this.humidity = this.humidityOld;
    } catch (err) { this.errorHandler(err, "read") }
    this.publish();
}

Bme.prototype.publish = function() {
    if (Math.abs(this.temperature - this.temperatureOld) > 0.2) {
        client.publish(`home/hvac/${this.name}/temperature`, this.temperature.toString());
        this.temperatureOld = this.temperature;
    }
    if (Math.abs(this.pressure - this.pressureOld) > 0.1) {
        client.publish(`home/hvac/${this.name}/pressure`, this.pressure.toString());
        this.pressureOld = this.pressure;
    }
    if (Math.abs(this.humidity - this.humidityOld) > 0.5) {
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

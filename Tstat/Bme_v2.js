const Sensor = require("./Sensor.js");
const BME280 = require('bme280-sensor');

class Bme extends Sensor {
    constructor(name, opts, rate = null) {
        super(name);
        this.options = opts;
        if (rate != null) this.rate = rate;
        this.lastTime = 0;
        this.dataStore = {
            temperature: {
                value: 0,
                valueOld: 0,
                lastTime: 0
            },
            pressure: {
                value: 0,
                valueOld: 0,
                publish: 0.1,
                lastTime: 0
            },
            humidity: {
                value: 0,
                valueOld: 0,
                publish: 0.5,
                lastTime: 0
            }
        };
        this.init();
    }
    async init() {
        try {
            this.bmeObj = new BME280(this.options);
            await this.bmeObj.init();
            this.interval = setInterval(async () => {this.read()} ,this.rate);
        } catch (err) {this.errorHandler(err, "init");}
    }
    close() {
        if (this.interval) clearInterval(this.interval);
        console.log(`BME ${this.name} shutdown`);
    }
    async restart() {
        try {
            this.close();
            await this.bmeObj.reset();
            await this.init();
        } catch (err) {this.errorHandler(err, "restart");}
    }
    async read() {
        try {
            let data = await this.bmeObj.readSensorData();
            let now = Date.now();
            let temperature = parseFloat(data.temperature_C)*1.8+32;
            temperature = temperature.toFixed(3);
            let pressure = parseFloat(data.pressure_hPa);
            pressure = pressure.toFixed(3);
            let humidity = parseFloat(data.humidity);
            humidity = humidity.toFixed(3);
            //out of range check before publish...
            if (Math.abs(temperature-this.dataStore.temperature.value) < 100 || now-this.dataStore.temperature.lastTime > 30000) {
                this.dataStore.temperature.lastTime = now;
                this.save("temperature", temperature);
            }
            if (Math.abs(pressure-this.dataStore.pressure.value) < 20 || now-this.dataStore.pressure.lastTime > 30000) {
                this.dataStore.pressure.lastTime = now;
                this.save("pressure", pressure);
            }
            if (Math.abs(humidity-this.dataStore.humidity.value) < 20 || now-this.dataStore.humidity.lastTime > 30000) {
                this.dataStore.humidity.lastTime = now;
                this.save("humidity", humidity);
            }
        } catch (err) { this.errorHandler(err, "read") }
        this.publish();
    }
}

module.exports = Bme;
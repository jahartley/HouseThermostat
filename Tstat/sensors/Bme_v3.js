
const Sensor = require("./Sensor.js");
const BME280 = require('bme280-sensor');

const bmeDefaults = {
    rangeCheckDiff: 1,
    lastTimeInterval: 30000
};

class Bme extends Sensor {
    constructor(opts) {
        super(opts);
        this.lastTime = 0;
        this.init();
    }
    async init() {
        try {
            this.bmeObj = new BME280(this.data.bmeOptions);
            await this.bmeObj.init();
            this.interval = setInterval(async () => {this.read()} ,this.data.rate);
        } catch (err) {this.errorHandler(err, "init");}
    }
    shutDown() {
        if (this.interval) clearInterval(this.interval);
        console.log(`BME ${this.data.name} shutdown`);
    }
    async restart() {        
        if (super.restart()) return;
        try {
            this.shutDown();
            await this.bmeObj.reset();
            await this.init();
        } catch (err) {this.errorHandler(err, "restart");}
        this.restartComplete();
    }
    dataStoreCheck(property) {
        super.dataStoreCheck(property);
        if (this.data.dataStore[property]?.lastTime === undefined) this.data.dataStore[property].lastTime = 0;
        if (this.data.dataStore[property]?.rangeCheckDiff === undefined) this.data.dataStore[property].rangeCheckDiff = bmeDefaults.rangeCheckDiff;
        if (this.data.dataStore[property]?.lastTimeInterval === undefined) this.data.dataStore[property].lastTimeInterval = bmeDefaults.lastTimeInterval;
    }
    save(property, newValue) {
        this.dataStoreCheck(property);
        let now = Date.now();
        const { value, rangeCheckDiff, lastTime, lastTimeInterval } = this.data.dataStore[property];
        if (Math.abs(newValue-value) < rangeCheckDiff || now-lastTime > lastTimeInterval) {
            this.data.dataStore[property].lastTime = now;
            super.save(property, newValue);
        }
    }
    async read() {
        try {
            let data = await this.bmeObj.readSensorData();            
            let temperature = parseFloat(data.temperature_C)*1.8+32;
            temperature = temperature.toFixed(3);
            let pressure = parseFloat(data.pressure_hPa);
            pressure = pressure.toFixed(3);
            let humidity = parseFloat(data.humidity);
            humidity = humidity.toFixed(3);
            this.save("temperature", temperature);
            this.save("pressure", pressure);
            this.save("humidity", humidity);
        } catch (err) { this.errorHandler(err, "read") }
    }
}

module.exports = Bme;
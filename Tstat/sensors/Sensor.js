
const {client, dataBus} = require("../global.js");
const Ema = require('./Ema.js');
const MedianFilter = require("./MedianFilter.js");

const sensorDefaults = {
    dataRate: 10000,
    ema: 60000,
    publish: 0.2,
    mqttEma: true
};

class Sensor {
    constructor(opts) {
        this.data = opts;
        this.restartInProgress= false;
        this.intervals = {};
        this.intervals.restartInterval = null;
        if (this.data?.name === undefined) throw new Error("Sensor constructor no name");
        if (this.data?.rate === undefined) this.data.rate = sensorDefaults.dataRate;
        if (this.data?.ema === undefined) this.data.ema = sensorDefaults.ema
        if (this.data?.publish === undefined) this.data.publish = sensorDefaults.publish
        if (this.data.dataStore === undefined) this.data.dataStore = {};
    }
    close() {
        console.log(`Closing ${this.data.name}`);
    }
    restart() {
        console.log(`${this.data.name} generic restart`);
        if (this.restartInProgress) {
            this.intervals.restartInterval = setTimeout(() => this.restart(),60000);
            return true;
        }
        this.restartInProgress = true;
        return false;
    }
    restartComplete() {
        clearTimeout(this.intervals.restartInterval);
        this.restartInProgress = false;
    }
    errorHandler(err, where = 'unknown') {
        console.log(`${this.data.name} Error Handler fault at ${where} on ${new Date()}`); 
        console.trace(err);
        this.restart();
    }
    dataStoreCheck(property) {
        if (this.data.dataStore?.[property] === undefined) {
            this.data.dataStore[property] = {
                value: 0,
                valueOld: 0,
                emaPeriod: this.data.ema,
                ema: new Ema(this.data.name, this.data.ema),
                publish: this.data.publish,
                median: new MedianFilter(this.data.name)
            };
            return true;
        }
        if (this.data.dataStore[property]?.value === undefined) this.data.dataStore[property].value = 0;
        if (this.data.dataStore[property]?.valueOld === undefined) this.data.dataStore[property].valueOld = 0;
        if (this.data.dataStore[property]?.emaPeriod === undefined) this.data.dataStore[property].emaPeriod = this.data.ema;
        if (this.data.dataStore[property]?.ema === undefined) this.data.dataStore[property].ema = new Ema(this.data.name, this.data.dataStore[property].emaPeriod);
        if (this.data.dataStore[property]?.publish === undefined) this.data.dataStore[property].publish = this.data.publish;
        if (this.data.dataStore[property]?.median === undefined) this.data.dataStore[property].median = new MedianFilter(this.data.name);
        return true;
    }
    save(property, value) {
        this.dataStoreCheck(property);
        let ema = this.data.dataStore[property].ema.pushValue(value);
        dataBus.emit(`${this.data.name}/${property}/ema`, ema);
        let median = this.data.dataStore[property].median.pushValue(value);
        if (median == null) {
            this.data.dataStore[property].value = value;
        } else {
            this.data.dataStore[property].value = median;
        }
        dataBus.emit(`${this.data.name}/${property}`, this.data.dataStore[property].value);
        this.publish(property);
    }
    publish(property, now=false) {
        this.dataStoreCheck(property);
        let { value, valueOld, publish } = this.data.dataStore[property];
        
        if (sensorDefaults.mqttEma) client.publish(`home/hvac/${this.data.name}/${property}/ema`, JSON.stringify(this.data.dataStore[property].ema.getValue()));
        if (now) {
            client.publish(`home/hvac/${this.data.name}/${property}`, value.toString());
            this.data.dataStore[property].valueOld = value;
            return;
        }
        if (Math.abs(value - valueOld) > publish) {
            client.publish(`home/hvac/${this.data.name}/${property}`, value.toString());
            this.data.dataStore[property].valueOld = value;
        }
    }
    resend() {
        for (let property in this.data.dataStore) {
            this.dataStoreCheck(property);
            let { value } = this.data.dataStore[property];
            if (value === 0) continue;
            client.publish(`home/hvac/${this.data.name}/${property}`, value.toString());
        }
    }
    shutDown(){
        console.log(`${this.data.name} generic shutdown`);
        for (let interval in this.intervals) {
            if (this.intervals[interval]) clearInterval(this.intervals[interval]);
        }
    }
}

module.exports = Sensor
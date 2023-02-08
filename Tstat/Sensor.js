const {client, dataBus} = require("./global.js");

class Sensor {
    constructor(name, rate = 10000) {
        this.name = name;
        this.rate = rate;
        this.dataStore = {};
    }
    close() {
        console.log(`Closing ${this.name}`);
    }
    restart() {
        console.log(`${this.name} generic restart`);
    }
    errorHandler(err, where = 'unknown') {
        console.log(`${this.name} Error Handler fault at ${where}`); 
        console.trace(err);
        this.restart();
    }
    save(name, value) {
        if (this.dataStore?.[name] === undefined) {
            this.dataStore[name] = {
                value: 0,
                valueOld: 0
            };
        }
        this.dataStore[name].value = value;
        dataBus.emit(`${this.name}/${name}`, value);
        this.publish(name);
    }
    publish(name) {
        if (this.dataStore?.[name] === undefined) return;
        if (this.dataStore[name]?.value === undefined) return;
        if (this.dataStore[name]?.valueOld === undefined) return;
        let publishDifference;
        if (this.dataStore[name]?.publish === undefined) publishDifference = 0.2;
        else publishDifference = this.dataStore[name].publish;
        let { value, valueOld} = this.dataStore[name];
        if (Math.abs(value - valueOld) > publishDifference) {
            client.publish(`home/hvac/${this.name}/${name}`, value.toString());
            valueOld = value;
        }
    }
    resend() {
        for (let name in this.dataStore) {
            if (this.dataStore?.[name] === undefined) continue;
            let { value } = this.dataStore[name];
            if (value === 0) continue;
            client.publish(`home/hvac/${this.name}/${name}`, value.toString());
        }
    }
}

module.exports = Sensor
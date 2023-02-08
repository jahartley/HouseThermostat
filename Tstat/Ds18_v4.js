const Sensor = require("./Sensor.js");
const fs = require('fs').promises;
const W1_FILE = '/sys/bus/w1/devices/w1_bus_master1/w1_master_slaves';


class DsTs extends Sensor {
    constructor(name, rate=null) {
        super(name);
        if (rate != null) this.rate = rate;
        this.type = "DS18B20";
        this.init();
    }
    async init() {
        try {
            let data = await fs.readFile(W1_FILE, 'utf8');    
            let parts = data.split('\n');
            parts.pop();
            this.sensors = parts;
            if (this.sensors.length === 0) throw new Error("No sensors found");
            this.interval = setInterval(() => {this.readTemps();}, this.rate);
            console.log(`DsTs found ${this.sensors.length} devices. Init Complete`);
        } catch (err) {this.errorHandler(err, `${this.type} init`);}
    }
    close() {
        if (this.interval) clearInterval(this.interval);
        console.log(`${this.type} ${this.name} shutdown`);
    }
    async readTemps() {
        try {
            for (i = 0; i < this.sensors.length; i++) {
                let rom = this.sensors[i];
                let data = await fs.readFile('/sys/bus/w1/devices/' + rom + '/w1_slave', 'utf8');
                let value = this.parseData(data);
                this.save(rom, (value*1.8+32).toFixed(2));
            }
        } catch (err) {this.errorHandler(err, `${this.type} readTemps`);}
    }
    parseData(data) {
        let arr = data.split('\n');
        if (arr[0].indexOf('YES') > -1) {
          let output = data.match(/t=(-?(\d+))/);
          return output[1] / 1000;
        } else if (arr[0].indexOf('NO') > -1) {
          throw new Error ('CRC check error');
        }
        throw new Error('Can not get temperature');
    }

}

module.exports = DsTs;


const Sensor = require("./Sensor.js");

const { SerialPort } = require('serialport');
const { DelimiterParser } = require('@serialport/parser-delimiter');

class Serial extends Sensor {
    constructor(opts) {
        super(opts);
        this.init();
    }
    init() {
        try {
            this.port = new SerialPort({ path: '/dev/serial0', baudRate: 9600});
            this.parser = this.port.pipe(new DelimiterParser({ delimiter: '\n' }));
            this.parser.on('data', (data) => this.parseData(data));
            console.log("Serial initialized");
        } catch (err) {this.errorHandler(err, `init`);}
    }
    shutDown() {
        try {
            this.parser.removeListener('data', (data) => this.parseData(data));
            this.port.close();
            console.log("Serial shutdown");
        } catch (err) {this.errorHandler(err, `close`);}
    }
    restart() {
        this.shutDown();
        this.init();
    }
    save(property, value) {
        if (isNaN(value)) throw new Error("Property " + property + " is NaN, value: "+ value.toString());
        super.save(property, value);
    }
    parseData(data){
        const newData = data.toString();
        //console.log(newData);
        const header = newData.slice(0,1);
        /* 
            t70.25
            y70.1
            b35.3
            g653643
            p96159
            Time 0:52:36
    
        */
        switch(header) {
            case 't':
                this.save('temperature', parseFloat(newData.slice(1,newData.length-1)));
                break;
            case 'y':
                this.save('BME680temperature', parseFloat(newData.slice(1,newData.length-1)));
                break;
            case 'b':
                this.save('humidity', parseFloat(newData.slice(1,newData.length-1)));
                break;
            case 'g':
                this.save('airQualityOhms', parseFloat(newData.slice(1,newData.length-1)));
                break;
            case 'p':
                this.save('pressure', parseFloat(newData.slice(1,newData.length-1))/100);
                break;
            case 'T':
                let timeString = newData.slice(5, newData.length-1);
                timeString = timeString.split(':');
                if (timeString.length != 3) break;
                let date2 = new Date();
                if (timeString[0] != date2.getHours()) this.port.write(`o${date2.getHours()}\r\n`);
                if (timeString[1] != date2.getMinutes()) this.port.write(`m${date2.getMinutes()}\r\n`);
                if (timeString[2] != date2.getSeconds()) this.port.write(`s${date2.getSeconds()}\r\n`);
        }
    }
}


module.exports = Serial;

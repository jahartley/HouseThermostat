const Sensor = require("./Sensor.js");

const { SerialPort } = require('serialport');
const { DelimiterParser } = require('@serialport/parser-delimiter');

class Serial extends Sensor {
    constructor(name) {
        super(name);
        this.dataStore = {
            remoteBmeAq: {
                value: 0,
                valueOld: 0,
                publish: 100
            },
            remoteBmeHumidity: {
                value: 0,
                valueOld: 0,
                publish: 0.5
            }
        };
        this.init();
    }
    init() {
        try {
            this.port = new SerialPort({ path: '/dev/serial0', baudRate: 9600});
            this.parser = this.port.pipe(new DelimiterParser({ delimiter: '\n' }));
            this.parser.on('data', (data) => {
                let newData = data.toString();
                let header = newData.slice(0,1);
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
                        this.save('remoteTemperature', parseFloat(newData.slice(1,newData.length-1)));
                        break;
                    case 'y':
                        this.save('remoteBmeTemperature', parseFloat(newData.slice(1,newData.length-1)));
                        break;
                    case 'b':
                        this.save('remoteBmeHumidity', parseFloat(newData.slice(1,newData.length-1)));
                        break;
                    case 'g':
                        this.save('remoteBmeAq', parseFloat(newData.slice(1,newData.length-1)));
                        break;
                    case 'p':
                        this.save('remoteBmePressure', parseFloat(newData.slice(1,newData.length-1))/100);
                        break;
                    case 'T':
                        let timeString = newData.slice(5, newData.length-1);
                        let timeString2 = timeString.split(':');
                        if (timeString2.length != 3) break;
                        let date2 = new Date();
                        if (timeString2[0] != date2.getHours()) this.port.write(`o${date2.getHours()}\r\n`);
                        if (timeString2[1] != date2.getMinutes()) this.port.write(`m${date2.getMinutes()}\r\n`);
                        if (timeString2[2] != date2.getSeconds()) this.port.write(`s${date2.getSeconds()}\r\n`);
                }
            });
            console.log("Serial initialized");
        } catch (err) {this.errorHandler(err, `init`);}
    }
    close = function() {
        try {
            this.port.close();
            console.log("Serial shutdown");
        } catch (err) {this.errorHandler(err, `close`);}
    }
    restart() {
        this.close();
        this.init();
    }
}


module.exports = Serial;
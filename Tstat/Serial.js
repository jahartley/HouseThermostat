const {client} = require("./global.js");

const { SerialPort } = require('serialport');
const { DelimiterParser } = require('@serialport/parser-delimiter');

//try {} catch (err) {this.errorHandler(err, 'Init');}


function Serial() {
    this.dataStore = {};
    this.init();
}

Serial.prototype.init = function() {
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
                    let date2 = new Date(Date.now());
                    remoteHour = timeString2[0];
                    if (remoteHour != date2.getHours()) port.write(`o${date2.getHours()}\r\n`);
                    remomteMinute = timeString2[1];
                    if (remomteMinute != date2.getMinutes()) port.write(`m${date2.getMinutes()}\r\n`);
                    remoteSecond = timeString2[2];
                    if (remoteSecond != date2.getSeconds()) port.write(`s${date2.getSeconds()}\r\n`);
            }
        });
    } catch (err) {this.errorHandler(err, 'Init');}
}

Serial.prototype.close = function() {
    try {
        this.port.close();
    } catch (err) {this.errorHandler(err, 'Close');}
}

Serial.prototype.save = function(name, value) {
    if (this.dataStore?.[name] === undefined) {
        this.dataStore[name] = {
            value: 0,
            valueOld: 0
        }
    }
    this.dataStore[name].value = value;
    this.publish(name);
}

Serial.prototype.errorHandler = async function(err, where = 'unknown') {
    console.log(`Serial Error Handler fault at ${where}`); 
    console.trace(err);
    console.log('RESTARTING SERIAL');
    this.close();
    this.init();
}

Serial.prototype.publish = function(rom) {
    if (this.dataStore?.[rom] === undefined) return;
    let { value, valueOld} = this.dataStore[rom];
    if (Math.abs(value - valueOld) > 0.2) {
        client.publish(`home/hvac/Remote/${rom}`, value.toString());
        valueOld = value;
    }
}

Serial.prototype.resend = function() {
    for (let rom in this.dataStore) {
        if (this.dataStore?.[rom] === undefined) continue;
        let { value } = this.dataStore[rom];
        if (value === 0) continue;
        client.publish(`home/hvac/Remote/${rom}`, value.toString());
    }
}

module.exports = Serial;
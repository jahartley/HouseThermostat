const mqtt = require('mqtt');
exports.client = mqtt.connect('mqtt://192.168.77.1')
exports.pigpio = require('pigpio');
const EventEmitter = require('node:events');
exports.dataBus = new EventEmitter();
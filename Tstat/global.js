const mqtt = require('mqtt');
exports.client = mqtt.connect('mqtt://192.168.77.1')
export const pigpio = require('pigpio');
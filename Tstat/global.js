const mqtt = require('mqtt');
exports.client = mqtt.connect('mqtt://192.168.77.1')

export let remoteTemperature = -150;
export let remoteBmeTemperature = -150
export let remoteBmeHumidity = -150;
export let remoteBmePressure = -150;
export let remoteBmeAq = -1;
export let remoteHour = -1;
export let remomteMinute = -1;
export let remoteSecond = -1;
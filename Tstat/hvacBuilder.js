
const SimMachine = require("./machines/simMachine.js");
const GpipMachine = require("./machines/gpioMachine.js");
const Machine = require('./machines/machine_v3.js');

const Bme = require("./sensors/Bme_v3.js");
const DsTs = require("./sensors/Ds18_v5.js");
const Serial = require("./sensors/Serial_v3.js");


class hvacBuilder {
    constructor(options) {
        const hvacClasses = {
            SimMachine, Machine, Bme, DsTs, Serial, GpipMachine,
        };
        console.log(options);
        return new hvacClasses[options.neededClass](options);
    }
}

module.exports = hvacBuilder;
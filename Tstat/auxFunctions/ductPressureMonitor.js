const {client, dataBus} = require("./global.js");
const { Ema } = require("../sensors/Ema.js");

class ductPressureMonitor {
    // listen to pressure from duct, and fan. 
    // when the fan is off, take readings and average to cancel differnece between sensors.
    // when fan is on , take the readings and ema, saving the difference minus the cancel value.
    constructor () {
        this.offDelay = 30000;
        this.onDelay = 30000;
        this.fanState = "init"; //states init, ignore, run, idle
        this.interval = null;

        this.emaP1Off = new Ema("P1Off", 30000);
        this.emaP2Off = new Ema("P2Off", 30000);
        this.emaP1On = new Ema("P1On", 30000);
        this.emaP2On = new Ema("P2On", 30000);
        this.emaOffDiff = new Ema("offDiff", 43200000);
        this.emaOnDiff = new Ema("onDiff", 43200000);

        this.reportDiff = 0.1;
        this.reportInterval = 180000;
        this.reportTimer = Date.now();
        this.reportLast = 0;
        dataBus.on("fan/run", () => this.fanOn());
        dataBus.on("fan/idle", () => this.fanOff());
        dataBus.on("DuctBeforeHVAC/pressure", (value) => {this.p1(value);});
        dataBus.on("DuctAfterHVAC/pressure", (value) => {this.p2(value);});
    }
    fanOn(){
        this.fanState = "ignore";
        clearTimeout(this.interval);
        this.interval = setTimeout(() => {
            this.fanState = "run";
        }, this.onDelay);
    }
    fanOff(){
        this.fanState = "ignore";
        clearTimeout(this.interval);
        this.interval = setTimeout(() => {
            this.fanState = "idle";
        }, this.offDelay);
    }
    p1(value){
        switch (this.fanState) {
            case "run":
                this.emaP1On.pushValue(value);
                this.onDiff();
                break;
            case "idle":
                this.emaP1Off.pushValue(value);
                this.offDiff();
                break;
        }
    }    
    p2(value){
        switch (this.fanState) {
            case "run":
                this.emaP2On.pushValue(value);
                this.onDiff();
                break;
            case "idle":
                this.emaP2Off.pushValue(value);
                this.emaOffDiff();
                break;
        }
    }
    onDiff(){
        let p1 = this.emaP1On.getValue();
        let p2 = this.emaP2On.getValue();
        let offDiff = this.emaOffDiff.getValue();
        if (p1 === null) return;
        if (p2 === null) return;
        if (offDiff === null) return;
        this.emaOnDiff.pushValue(p2-offDiff-p1);
        this.report();
    }
    offDiff(){
        let p1 = this.emaP1Off.getValue();
        let p2 = this.emaP2Off.getValue();
        if (p1 === null) return;
        if (p2 === null) return;
        this.emaOffDiff.pushValue(p2-p1);
    }
    report() {
        let current = this.emaOnDiff.getValue();
        if (current === null) return;
        if (Date.now()-this.reportTimer < this.reportInterval) {
            if (Math.abs(current-this.reportLast) < this.reportDiff) return;
        }
        this.reportLast = current;
        client.publish(`home/hvac/systemPressureDifference`, current.toString());
    }
}

module.exports = ductPressureMonitor;
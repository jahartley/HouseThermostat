const {client, dataBus} = require("../global.js");
const Ema = require("../sensors/Ema.js");

class ductPressureMonitor {
    // listen to pressure from duct, and fan. 
    // when the fan is off, take readings and average to cancel differnece between sensors.
    // when fan is on , take the readings and ema, saving the difference minus the cancel value.
    constructor () {
        this.offDelay = 30000;
        this.onDelay = 30000;
        this.fanState = "init"; //states init, ignore, run, idle
        this.interval = null;

        this.emaP1Off = new Ema("eP1Off", 30000);
        this.emaP2Off = new Ema("eP2Off", 30000);
        this.emaP1On = new Ema("eP1On", 30000);
        this.emaP2On = new Ema("eP2On", 30000);
        this.emaOffDiff = new Ema("eoffDiff", 43200000);
        this.emaOnDiff = new Ema("eonDiff", 43200000);

        this.reportDiff = 0.1;
        this.reportInterval = 180000;
        this.reportTimer = Date.now();
        this.reportLast = 0;
        this.fanOff();
        dataBus.on("fan/run", () => {this.fanOn();});
        dataBus.on("fan/idle", () => {this.fanOff();});
        dataBus.on("DuctBeforeHVAC/pressure", (value) => {this.p1(value);});
        dataBus.on("DuctAfterHVAC/pressure", (value) => {this.p2(value);});
    }
    fanOn(){
        //console.log("duct fan on ignore.");
        this.fanState = "ignore";
        clearTimeout(this.interval);
        this.interval = setTimeout(() => {
            //console.log("duct start using fan");
            this.fanState = "run";
        }, this.onDelay);
    }
    fanOff(){
        //console.log("duct fan off ignore");
        this.fanState = "ignore";
        clearTimeout(this.interval);
        this.interval = setTimeout(() => {
            //console.log("duct fan stop");
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
                this.offDiff();
                break;
        }
    }
    onDiff(){
        let p1 = this.emaP1On.getValue();
        let p2 = this.emaP2On.getValue();
        let EoffDiff = this.emaOffDiff.getValue();
        if (p1 === null) return;
        if (p2 === null) return;
        if (EoffDiff === null) return;
        //console.log("on diff value", (p2-EoffDiff-p1));
        this.emaOnDiff.pushValue(p2-EoffDiff-p1);
        this.report();
    }
    offDiff(){
        let p1 = this.emaP1Off.getValue();
        let p2 = this.emaP2Off.getValue();
        if (p1 === null) return;
        if (p2 === null) return;
        //console.log("off diff value", (p2-p1));
        this.emaOffDiff.pushValue(p2-p1);
    }
    report() {
        let current = this.emaOnDiff.getValue();
        //console.log("duct report current", current);
        if (current === null) return;
        if (Date.now()-this.reportTimer < this.reportInterval) {
            if (Math.abs(current-this.reportLast) < this.reportDiff) return;
        }
        this.reportLast = current;
        current = current * 0.401463;
        client.publish(`home/hvac/systemPressureDifference`, current.toString());
    }
}

module.exports = ductPressureMonitor;

const {client, dataBus, hvac} = require("./global.js");
const hvacBuilder = require("./hvacBuilder.js");

// system run modes specifed in hvac.routines
// fan modes on, auto, circ. circ set to minimum 5 min in 30min period.
const baseTopic = "home/hvac/status/"

class hvacLogic {
    constructor() {
        this.mode = 'Off';
        this.step = 0;
        this.workerInterval = 1000;
        this.fanMode = 'Auto';
        this.userMode = 'init';
        this.userFanMode = 'init';
        this.temperature = -150;
        this.intervals = {};
        this.machines = {};
        this.sensors = {};
        this.listeners = {};
        this.equipmentBuilder("machines");
        this.equipmentBuilder("sensors");
        this.machines["failSafe"].poll('run');
        this.listenerBuilder();
        this.setUserMode(hvac.startup.userMode);
        this.setUserFanMode(hvac.startup.userFanMode);
        this.resend();

    }
    equipmentBuilder(location) {        
        for (const item in hvac[location]) {
            if (hvac[location][item]?.neededClass === undefined) continue;
            this[location][hvac[location][item].name] = new hvacBuilder(hvac[location][item]);
        }
    }
    listenerBuilder() {
        for (const item in hvac.listeners) {
            console.log("listener Builder ", hvac.listeners[item].listen, hvac.listeners[item].func);
            dataBus.on(hvac.listeners[item].listen, (value) => this[hvac.listeners[item].func](value));
        }
    }
    setSetPoints(cool, heat) {
        if (isNaN(cool)) throw new Error('cool is not a number');
        if (isNaN(heat)) throw new Error('heat is not a number');
        if (cool < 35 || cool > 160) throw new Error('cool is out of bounds');
        if (heat < 35 || heat > 100) throw new Error('heat is out of bounds');
        if (cool < heat) throw new Error('Cant set cool less than heat');
        if (cool-hvac.setpoints.minSeperation < heat) throw new Error(`need minimum ${hvac.setpoints.minSeperation} seperation between cool and heat`);
        hvac.setpoints.cool = cool;
        hvac.setpoints.heat = heat;
    }
    setSetPointAuto(value) {
        hvac.setpoints.auto = value;
        client.publish(baseTopic + "setpoint", hvac.setpoints.auto.toString());
        console.log("setSetpoint Auto ", value, hvac.setpoints.auto);
    }
    setUserMode(mode) {
        console.log(`HvacLogic setUserMode ${mode}`);
        if (!hvac.userModes.userModesNames.includes(mode)) throw new Error('Unknown mode');
        if (this.userMode === mode) return;
        this.userMode = mode;
        client.publish(baseTopic + "userMode", this.userMode);
    }
    tempLogicWorker(tempValue) {
        const temp = parseFloat(tempValue);
        if (isNaN(temp)) throw new Error('Temperature value is not a number');
        //throw new Error("TEST ERROR");
        //calls setMode baised on temp and userMode.
        if (this.userMode === 'Off' && this.mode != 'Off') {
            this.setMode('Off');
            return;
        }
        let coolSetpoint = 0;
        let heatSetpoint = 0;
        if (hvac.setpoints?.auto === undefined) {
            coolSetpoint = hvac.setpoints.cool;
            heatSetpoint = hvac.setpoints.heat;
        } else {
            coolSetpoint = hvac.setpoints.auto+(hvac.setpoints.minSeperation/2);
            heatSetpoint = hvac.setpoints.auto-(hvac.setpoints.minSeperation/2);
        }
        let coolOff = temp-coolSetpoint+hvac.setpoints.hysteresis; //if negative cool off
        let heatOff = heatSetpoint+hvac.setpoints.hysteresis-temp; //if negative heat off
        let coolOn = coolSetpoint-temp; //if negative coolOn
        let heatOn = temp-heatSetpoint; //if negative heatOn
        
        //console.log("tempLogic Worker temp, cOff, hOff, cOn, hOn", temp, "\t", coolOff.toFixed(2), "\t", heatOff.toFixed(2), "\t", coolOn.toFixed(2), "\t", heatOn.toFixed(2), "\t", this.mode, (coolOff < 0 ? 'coolOff' : ''), (heatOff < 0 ? 'heatOff' : ''), (coolOn < 0 ? 'coolOn' : ''), (heatOn < 0 ? 'heatOn' : ''));
        
        //console.log("---->>> TempLogic Worker timestamp: ", Math.floor(Date.now() / 1000));
        //console.log("\ttemp,\tcOff,\thOff,\tcOn, \thOn");
        //console.log("\t", temp.toFixed(2), "\t", coolOff.toFixed(2), "\t", heatOff.toFixed(2), "\t", coolOn.toFixed(2), "\t", heatOn.toFixed(2));
        //console.log("\tMode: ", this.mode, " decisions: ", (coolOff < 0 ? 'coolOff' : ''), (heatOff < 0 ? 'heatOff' : ''), (coolOn < 0 ? 'coolOn' : ''), (heatOn < 0 ? 'heatOn' : ''));
        
        if (this.userMode === 'Auto') {
            if (coolOff < 0) {if (this.mode === 'Cool') return this.setMode('Off')};
            if (heatOff < 0) {if (this.mode === 'Heat') return this.setMode('Off')};
            if (coolOn < 0) {if (this.mode === 'Off') return this.setMode('Cool')};
            if (heatOn < 0) {if (this.mode === 'Off') return this.setMode('Heat')};
            return;
        }
        if (this.userMode === 'Cool') {
            if (this.mode === 'Heat') return this.setMode('Off');
            if (coolOff < 0) {if (this.mode === 'Cool') return this.setMode('Off')};
            if (coolOn < 0) {if (this.mode === 'Off') return this.setMode('Cool')};
            return;
        }
        if (this.userMode === 'Heat') {
            if (this.mode === 'Cool') return this.setMode('Off')
            if (heatOff < 0) {if (this.mode === 'Heat') return this.setMode('Off')};
            if (heatOn < 0) {if (this.mode === 'Off') return this.setMode('Heat')};
            return;
        }
    } 
    setMode(mode) {
        console.log(`HvacLogic setMode ${mode}`);
        if (!hvac.systemModes.systemModeNames.includes(mode)) throw new Error('Unknown mode');
        if (this.mode === mode) return;
        if (this.intervals.modeWorkerInterval) clearInterval(this.intervals.modeWorkerInterval);
        this.step = 0;
        this.mode = mode;
        client.publish(baseTopic + "mode", this.mode);
        this.intervals.modeWorkerInterval = setInterval(() => this.modeWorker(), this.workerInterval);
        return;
    }
    async modeWorker() {
        if (hvac.routines?.[this.mode]?.[this.step] === undefined) throw new Error(`Hvac Logic modeWorker mode: ${this.mode} step: ${this.step} unknown`);
        let { func, opt } = hvac.routines[this.mode][this.step];
        if (func === 'complete') {
            console.log(`Hvac modeWorker ${this.mode} is complete.`);
            clearInterval(this.intervals.modeWorkerInterval);
            this.modeWorkerInterval = null;
            return;
        }
        if (func === 'delay') {
            if (this.delay(`${this.mode}/${this.step}`, opt)) {
                this.step++;
                return;
            } else return;
        }
        //take fanMode into account.
        if (func === 'fan') {
            if (this.fanMode !== 'Auto' && this.mode === 'Off') { //prevent fan turn off. during off mode if fan on/circ.
                this.step++;
                return;
            }
        }
        if (await this.machines[func].poll(opt)) this.step++;
        return;
    }
    delay(item, ms) {
        if (this.delayItem != item) {
            this.delayTimer = Date.now();
            this.delayItem = item;
            console.log(`New hvac modeWorker delay ${item} for ${ms/1000} seconds`);
        }
        if (Date.now()-this.delayTimer > ms) return true;
        return false;
    }
    shutDown(){
        console.log(`Hvac Logic shutdown!`);
        for (let interval in this.intervals) {
            if (this.intervals[interval]) clearInterval(this.intervals[interval]);
        }
        for (let item in this.sensors) {
            this.sensors[item].shutDown();
        }
        for (let item in this.machines) {
            this.machines[item].shutDown();
        }
        
        client.publish(baseTopic + "mode", "Off");
        client.publish(baseTopic + "fanMode", "Auto");
        client.publish(baseTopic + "userMode", "Off");
        client.publish(baseTopic + "userFanMode", "Auto");
        return;
    }
    async setFanMode(mode) {
        console.log(`HvacLogic setFanMode ${mode}`);
        if (!hvac.fanModes.fanModeNames.includes(mode)) throw new Error('setFanMode Unknown mode');
        if (this.fanMode === mode) return;
        this.fanMode = mode;
        client.publish(baseTopic + "fanMode", this.fanMode);
        this.intervals.fanModeWorkerInterval = setInterval(() => this.fanModeWorker(), this.workerInterval);
    }
    async fanModeWorker() {
        if (this.fanMode === 'Auto') {
            if (hvac.fanModes.fanRequiredModes.includes(this.mode)) { 
                //fan required in this mode will be turned off automaticlly.
                if (this.intervals.fanModeWorkerInterval) clearInterval(this.intervals.fanModeWorkerInterval);
                return;
            } else {
                //fan not required turn off.
                if (await this.machines['fan'].poll('idle')) {
                    if (this.intervals.fanModeWorkerInterval) clearInterval(this.intervals.fanModeWorkerInterval);
                    return;
                } else return;
            }
        }
        //fanMode is either on or circOn, turn fan on.
        if (await this.machines['fan'].poll('run')) {
            if (this.intervals.fanModeWorkerInterval) clearInterval(this.intervals.fanModeWorkerInterval);
            return;
        } else return;
    }
    fanCircStarter() {
        this.setFanMode('Auto');
        this.fanCircWorkerTime = this.currentMachineRunTime('fan');
        this.intervals.fanCircStarterInterval = setTimeout(() => this.fanCircStarter(), (hvac.fanModes.circMode.inTime));
        this.intervals.fanCircWorkerInterval = setTimeout(() => this.fanCircWorker(), hvac.fanModes.circMode.inTime-hvac.fanModes.circMode.onTime);
    }
    fanCircWorker() {
        //implement fan circ mode here, 
        //go from circOn to auto and back.
        let currentTime = this.currentMachineRunTime('fan');
        let delta = currentTime-this.fanCircWorkerTime;
        let needed = hvac.fanModes.circMode.onTime-delta;
        console.log("fanCircWorker d n", delta, needed);
        if (delta > hvac.fanModes.circMode.onTime) return;
        this.setFanMode('CircOn');
        this.intervals.fanCircWorkerTimeout = setTimeout(() => this.setFanMode('Auto'), needed);
    }
    fanCircCancel() {
        if (this.intervals.fanCircStarterInterval) clearInterval(this.intervals.fanCircStarterInterval);
        if (this.intervals.fanCircWorkerInterval) clearInterval(this.intervals.fanCircWorkerInterval);
        if (this.intervals.fanCircWorkerTimeout) clearInterval(this.intervals.fanCircWorkerTimeout);
    }
    currentMachineRunTime(machine){
        if (this.machines[machine].state === 'idle') {
            return this.machines[machine].data.accumulators.run;
        }
        let time = this.machines[machine].data.accumulators.run;
        let current = Date.now()-this.machines[machine].data.timers.run;
        return time + current;
    }
    setUserFanMode(mode){
        console.log(`HvacLogic setUserFanMode ${mode}`);
        if (!hvac.userModes.userFanModesNames.includes(mode)) throw new Error('setFanMode Unknown mode');
        if (this.userFanMode === mode) return;
        this.userFanMode = mode;
        client.publish(baseTopic + "userFanMode", this.userFanMode);
        if (mode === 'Circulate') {
            this.fanCircStarter();
            return;
        }
        this.fanCircCancel();
        this.setFanMode(mode);
    }
    resend() {
        //send all modes/states
        for (let i in this.sensors) {
            this.sensors[i].resend();
        }
        for (let i in this.machines) {
            this.machines[i].resend();
        }

        client.publish(baseTopic + "mode", this.mode);
        client.publish(baseTopic + "fanMode", this.fanMode);
        client.publish(baseTopic + "userMode", this.userMode);
        client.publish(baseTopic + "userFanMode", this.userFanMode);
        client.publish(baseTopic + "setpoint", hvac.setpoints.auto.toString());
        console.log("--------------------- Resend request sent -----------------");
        client.publish('home/pi64', 'ok');
    }
}

module.exports = hvacLogic;

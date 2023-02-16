const {client, dataBus, hvac} = require("./global.js");
const hvacBuilder = require("./hvacBuilder.js");

// system run modes specifed in hvac.routines
// fan modes on, auto, circ. circ set to minimum 5 min in 30min period.

class hvacLogic {
    constructor() {
        this.tempmode = 'off';
        this.mode = 'init';
        this.step = 0;
        this.workerInterval = 1000;
        this.fanMode = 'auto';
        this.userMode = 'auto';
        this.userFanMode = 'auto';
        this.temperature = -150;
        this.intervals = {};
        this.machines = {};
        this.sensors = {};
        this.equipmentBuilder("machines");
        this.equipmentBuilder("sensors");
        this.setMode('off');
    }
    equipmentBuilder(location) {        
        for (let item in hvac[location]) {
            if (hvac[location][item]?.neededClass === undefined) continue;
            this[location][hvac[location][item].name] = new hvacBuilder(hvac[location][item]);
        }
    }
    setSetPoints(cool, heat) {
        if (isNaN(cool)) return new Error('cool is not a number');
        if (isNaN(heat)) return new Error('heat is not a number');
        if (cool < 35 || cool > 160) return new Error('cool is out of bounds');
        if (heat < 35 || heat > 100) return new Error('heat is out of bounds');
        if (cool < heat) return new Error('Cant set cool less than heat');
        if (cool-hvac.setpoints.minSeperation < heat) return new Error(`need minimum ${hvac.setpoints.minSeperation} seperation between cool and heat`);
        hvac.setpoints.cool = cool;
        hvac.setpoints.heat = heat;
    }
    setUserMode(mode) {
        console.log(`HvacLogic setUserMode ${mode}`);
        if (!hvac.userModes.userModesNames.includes(mode)) throw new Error('Unknown mode');
        if (this.userMode === mode) return;
        this.userMode = mode;
        this.tempLogicWorker(this.temperature);
    }
    tempLogicWorker(temp) {

        //calls setMode baised on temp and userMode.
        if (this.userMode === 'off') {
            this.setMode('off');
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

        
        // let mode = "no";
        // if (coolOff < 0) {if (this.tempmode === 'cool') {this.tempmode = 'off'; mode = "yes";}};
        // if (heatOff < 0) {if (this.tempmode === 'heat') {this.tempmode = 'off'; mode = "yes";}};
        // if (coolOn < 0) {if (this.tempmode === 'off') {this.tempmode = 'cool'; mode = "yes";}};
        // if (heatOn < 0) {if (this.tempmode === 'off') {this.tempmode = 'heat'; mode = "yes";}};
        //console.log("tempLogic Worker temp, cOff, hOff, cOn, hOn", temp, "\t", coolOff, "\t", heatOff, "\t", coolOn, "\t", heatOn, "\t", this.tempmode, "\t", mode, (coolOff < 0 ? 'coolOff' : ''), (heatOff < 0 ? 'heatOff' : ''), (coolOn < 0 ? 'coolOn' : ''), (heatOn < 0 ? 'heatOn' : ''));
        
        if (this.userMode === 'auto') {
            if (coolOff < 0) {if (this.mode === 'cool') return this.setMode('off')};
            if (heatOff < 0) {if (this.mode === 'heat') return this.setMode('off')};
            if (coolOn < 0) {if (this.mode === 'off') return this.setMode('cool')};
            if (heatOn < 0) {if (this.mode === 'off') return this.setMode('heat')};
            return;
        }
        if (this.userMode === 'cool') {
            if (this.mode === 'heat') return this.setMode('off');
            if (coolOff < 0) {if (this.mode === 'cool') return this.setMode('off')};
            if (coolOn < 0) {if (this.mode === 'off') return this.setMode('cool')};
            return;
        }
        if (this.userMode === 'heat') {
            if (this.mode === 'cool') return this.setMode('off')
            if (heatOff < 0) {if (this.mode === 'heat') return this.setMode('off')};
            if (heatOn < 0) {if (this.mode === 'off') return this.setMode('heat')};
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
            if (this.fanMode !== 'auto' && this.mode === 'off') { //prevent fan turn off. during off mode if fan on/circ.
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
        for (let item in this.machines) {
            this.machines[item].shutDown();
        }
        return;
    }
    async setFanMode(mode) {
        console.log(`HvacLogic setFanMode ${mode}`);
        if (!hvac.fanModes.fanModeNames.includes(mode)) throw new Error('setFanMode Unknown mode');
        if (this.fanMode === mode) return;
        this.fanMode = mode;
        this.intervals.fanModeWorkerInterval = setInterval(() => this.fanModeWorker(), this.workerInterval);
    }
    async fanModeWorker() {
        if (this.fanMode === 'auto') {
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
        this.setFanMode('auto');
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
        this.setFanMode('circOn');
        this.intervals.fanCircWorkerTimeout = setTimeout(() => this.setFanMode('auto'), needed);
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
        if (mode === 'circ') {
            this.fanCircStarter();
            return;
        }
        this.fanCircCancel();
        this.setFanMode(mode);
    }
}

module.exports = hvacLogic;
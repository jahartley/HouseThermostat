const {client, dataBus} = require("../global.js");

const c1 = -5674.5359;         //constants for vapor pressure over water/ice per
const c2 = -0.51523058;        //ASHRAE HOF 1993 and ANSI/ASHRAE 41.6-1994
const c3 = -0.0096778430;
const c4 = 0.00000062215701;
const c5 = 0.0000000020747825;
const c6 = -0.00000000000094840240;
const c7 = 4.1635019;
const c8 = -5800.2206;
const c9 = -5.5162560;
const c10 = -0.048640239;
const c11 = 0.000041764768;
const c12 = -0.000000014452093;
const c13 = 6.5459673;
const c14 = 6.54;              //constants to determine dew point
const c15 = 14.526;
const c16 = 0.7389;
const c17 = 0.09486;
const c18 = 0.4569;
const dryAira = 3.653;
const dryAirb = -1.337e-3;
const dryAirc = 3.294e-6;
const dryAird = -1.913e-9;
const dryAire = 0.2763e-12;
const waterVapora = 4.070;
const waterVaporb = -1.108e-3;
const waterVaporc = 4.152e-6;
const waterVapord = -2.964e-9;
const waterVapore = 0.807e-12;

class PsychroCalc {
    constructor(name) {
        this.name = name;
    }
    buildValue(name, unit, symbol, hassUnit, decimals){
        if (this?.[name]== undefined) {
            this[name] = new Value(name,unit,symbol,hassUnit,decimals);
        }
    }
    setTempF(value){
        const temp = parseFloat(value);
        this.buildValue("dryBulbTemperature_C","°C","T","°C",2);
        this.dryBulbTemperature_C.setValue((temp - 32)/1.8);
        this.calcResult();
    }
    setPressuremBar(value){
        const press = parseFloat(value);
        this.buildValue("pressure_kPa","kPa","p","kPa",3);
        this.pressure_kPa.setValue(press*0.1);
        this.calcResult();
    }
    setHumidityRH(value){
        const h = parseFloat(value);
        this.buildValue("relativeHumidity","%","φ","%",4);
        this.relativeHumidity.setValue(h/100);
        this.calcResult();
    }
    calcResult(){
        if (this?.dryBulbTemperature_C?.value == undefined) return;
        this.buildValue("dryBulbTemperature_K","°K","T", "°K",2);
        this.dryBulbTemperature_K.setValue((273.15 + this.dryBulbTemperature_C.value));
        //bp
        if (this?.pressure_kPa?.value == undefined) return;
        if (this?.relativeHumidity?.value == undefined) return;
        if (this.dryBulbTemperature_C.value < 0) {
            this.calcSaturationVaporPressureWaterSolid();
        } else {
            this.calcSaturationVaporPressureWaterLiquid();
        }
        if (this?.saturationVaporPressureWater_Pa?.value == undefined) return;
        //pw = pws * rh
        this.buildValue("vaporPressureWater_Pa","Pa","p_w", "Pa",0);
        this.vaporPressureWater_Pa.setValue(this.saturationVaporPressureWater_Pa.value*(this.relativeHumidity.value));
        //pda
        this.buildValue("partialPressureDryAir_Pa","Pa","p_da", "Pa",0);
        this.partialPressureDryAir_Pa.setValue((this.pressure_kPa.value * 1000) - this.vaporPressureWater_Pa.value);
        //w
        this.buildValue("humidityRatio","kg_(water vapor)/kg_(dry air)","W", "ratio",5);
        this.humidityRatio.setValue(0.62198*(this.vaporPressureWater_Pa.value/this.partialPressureDryAir_Pa.value));
        //ws saturated humidity ratio
        this.buildValue("humidityRatioSaturated","kg_(water vapor)/kg_(dry air)","Wₛ", "ratio",5);
        this.humidityRatioSaturated.setValue(0.62198*(this.saturationVaporPressureWater_Pa.value/this.partialPressureDryAir_Pa.value));
        //saturation (mu) w/ws
        this.buildValue("degreeOfSaturation","none","µ", "ratio",5);
        this.degreeOfSaturation.setValue(this.humidityRatio.value/this.humidityRatioSaturated.value);
        //sph (kg(water Vapor)/kg(moist air))
        this.buildValue("specificHumidity","kg_(water vapor)/kg_(moist air)","γ", "ratio",5);
        this.specificHumidity.setValue(this.humidityRatio.value/(1+this.humidityRatio.value));
        //
        this.buildValue("moleFractionWater","mol/mol","X_w", "ratio",5);
        this.moleFractionWater.setValue(this.humidityRatio.value/(this.humidityRatio.value+0.62198));
        //mw
        this.buildValue("molecularWeightMoistAir","g/mol","M_(moist air)", "g/mol",3);
        this.molecularWeightMoistAir.setValue(this.moleFractionWater.value * 18.01528 + (1-this.moleFractionWater.value)*28.96443);
        //
        this.buildValue("gasConstant","kJ/(kg*K)","R_(moist air)","kJ/(kg*K)",5);
        this.gasConstant.setValue(8.314472/this.molecularWeightMoistAir.value); //(kJ/mol K)
        //cpa(db)
        this.buildValue("specificHeatDryAir","kJ/(kg*K)","c_(dry air)","kJ/(kg*K)",5);
        this.specificHeatDryAir.setValue((dryAira*1 + dryAirb*this.dryBulbTemperature_K.value + dryAirc*Math.pow(this.dryBulbTemperature_K.value,2) + dryAird*Math.pow(this.dryBulbTemperature_K.value,3) + dryAire*Math.pow(this.dryBulbTemperature_K.value,4) ) * 0.287055);
        //cpw(db)
        this.buildValue("specificHeatWaterVapor","kJ/(kg*K)","c_(water vapor)","kJ/(kg*K)",5);
        this.specificHeatWaterVapor.setValue((waterVapora*1 + waterVaporb*this.dryBulbTemperature_K.value + waterVaporc*Math.pow(this.dryBulbTemperature_K.value,2) + waterVapord*Math.pow(this.dryBulbTemperature_K.value,3) + waterVapore*Math.pow(this.dryBulbTemperature_K.value,4) ) * 0.461520);
        //cp (kJ/kg K)
        this.buildValue("isobaricSpecificHeat","kJ/(kg*K)","c_p(moist air)","kJ/(kg*K)",5);
        this.isobaricSpecificHeat.setValue(this.specificHeatDryAir.value * (1-this.moleFractionWater.value) + this.specificHeatWaterVapor.value * this.moleFractionWater.value);
        //cv (kJ/kg K)
        this.buildValue("isometricSpecificHeat","kJ/(kg*K)","c_v(moist air)","kJ/(kg*K)",5);
        this.isometricSpecificHeat.setValue(this.isobaricSpecificHeat.value - this.gasConstant.value);
        //k
        this.buildValue("specificHeatRatio","none","k", "ratio",5);
        this.specificHeatRatio.setValue(this.isobaricSpecificHeat.value/this.isometricSpecificHeat.value);
        //
        this.buildValue("entropyDryAir","kJ/kg_(dry air)*K","s_(dry air)","kJ/kg*K",5);
        this.entropyDryAir.setValue(this.specificHeatDryAir.value * Math.log(this.dryBulbTemperature_K.value/273.15));
        //
        this.buildValue("entropyWaterVapor","kJ/kg_(water vapor)*K","s_(water vapor)","kJ/kg*K",5);
        this.entropyWaterVapor.setValue(9.75441 - this.specificHeatWaterVapor.value * Math.log(this.dryBulbTemperature_K.value/273.15));
        //entropy (kJ/kg K)
        this.buildValue("entropyMoistAir","kJ/kg_(moist air)*K","s_(moist air)","kJ/kg*K",5);
        this.entropyMoistAir.setValue(this.entropyDryAir.value + this.entropyWaterVapor.value * this.humidityRatio.value);
        //speed (m/s)
        this.buildValue("speedOfSound","m/s","c","m/s",3);
        this.speedOfSound.setValue(Math.sqrt(this.specificHeatRatio.value*this.gasConstant.value*this.dryBulbTemperature_K.value*9.80665));
        //vol Moist Air Specific Volume (m^3/kg(dry air))
        this.buildValue("specificVolumeMoistAir","m³/kg_(dry air)","v","m³/kg",5);
        this.specificVolumeMoistAir.setValue(0.287055*this.dryBulbTemperature_K.value*(1+1.60776874*this.humidityRatio.value)/this.pressure_kPa.value);
        //density (kg/m^3)
        this.buildValue("density","kg/m³", "ρ","kg/m³",5);
        this.density.setValue((1/this.specificVolumeMoistAir.value)*(1+this.humidityRatio.value));
        //enthalpy (kJ/kg(dry air))
        this.buildValue("enthalpy","kJ/kg_(moist air)","h_(moist air)", "kJ/kg",3);
        this.enthalpy.setValue(1.006*this.dryBulbTemperature_C.value + this.humidityRatio.value*(2501 + 1.805*this.dryBulbTemperature_C.value));
        //u internal energy (kJ/kg(dry air))
        this.buildValue("internalEnergy","kJ/kg","U", "kJ/kg",3);
        this.internalEnergy.setValue(this.enthalpy.value - this.gasConstant.value * this.dryBulbTemperature_K.value);
        //enthalpys Sensible enthalpy (kJ/kg(dry air))
        this.buildValue("enthalpySensible","kJ/kg_(dry air)","h_(dry air)", "kJ/kg",3);
        this.enthalpySensible.setValue(this.dryBulbTemperature_C.value * this.specificHeatDryAir.value);
        //enthalpyl latent enthalpy (kJ/kg(dry air))
        this.buildValue("enthalpyLatent","kJ/kg_(dry air)","h_(water vapor)", "kJ/kg",3);
        this.enthalpyLatent.setValue(this.enthalpy.value-this.enthalpySensible.value);
        //tv virtual temperature
        this.buildValue("virtualTemperature_C","°C","T_(virtual)","°C",2);
        this.virtualTemperature_C.setValue((1 + 0.608*this.humidityRatio.value)*(this.dryBulbTemperature_K.value)-273.15);
        //wb wet bulb temp.
        this.buildValue("wetBulbTemperature_C","°C","T_(wb)","°C",2);
        this.wetBulbTemperature_C.setValue(this.dryBulbTemperature_C.value*Math.atan(0.151977*Math.pow((this.relativeHumidity.value*100+8.313659), (1/2)))+Math.atan(this.dryBulbTemperature_C.value+this.relativeHumidity.value*100)-Math.atan(this.relativeHumidity.value*100-1.676331)+0.00391838*Math.pow(this.relativeHumidity.value*100,(3/2))*Math.atan(0.023101*this.relativeHumidity.value*100)-4.686035);
        //dp
        let alpha = Math.log(this.relativeHumidity.value)+ (17.625*this.dryBulbTemperature_C.value)/(243.05 + this.dryBulbTemperature_C.value);
        this.buildValue("dewPoint_C","°C","T_(dp)","°C",2);
        this.dewPoint_C.setValue((243.04 * alpha)/(17.625 - alpha));
        //absolute humidity (kg(water vapor)/m^3)
        this.buildValue("absoluteHumidity","kg_(water vapor)/m³","ρ_(water vapor)","kg/m³",6);
        this.absoluteHumidity.setValue(this.density.value - (1/this.specificVolumeMoistAir.value));
        // specific volume (m^3/kg)
        this.buildValue("specificVolume","m³/kg", "ν","m³/kg",5);
        this.specificVolume.setValue(1/this.density.value);
        this.publish();
    }
    publish(){
        let propsArray = Object.getOwnPropertyNames(this);
        //console.log(propsArray);
        for (let i = 0; i < propsArray.length; i++){
            //console.log(propsArray[i]);
            //console.log(this[propsArray[i]]);
            if (propsArray[i] == 'name') continue;
            client.publish(`home/hvac/${"psychrometric_"+this.name}/${propsArray[i]}`, JSON.stringify(this[propsArray[i]]));
        }
        
    }
    calcSaturationVaporPressureWaterLiquid(){ 
        //calculate saturation pressure over liquid water
        //pws
        this.buildValue("saturationVaporPressureWater_Pa","Pa","p_ws", "Pa",0);
        this.saturationVaporPressureWater_Pa.setValue(Math.exp(c8/this.dryBulbTemperature_K.value + c9 + c10*this.dryBulbTemperature_K.value + c11*Math.pow(this.dryBulbTemperature_K.value,2) + c12*Math.pow(this.dryBulbTemperature_K.value,3) + c13*Math.log(this.dryBulbTemperature_K.value))*1000);
    }
    calcSaturationVaporPressureWaterSolid(){
        //calculate saturation pressure over ice
        //pws
        this.buildValue("saturationVaporPressureWater_Pa","Pa","p_ws", "Pa",0);
        this.saturationVaporPressureWater_Pa.setValue(Math.exp(c1/this.dryBulbTemperature_K.value + c2 + c3*this.dryBulbTemperature_K.value + c4*Math.pow(this.dryBulbTemperature_K.value,2) + c5*Math.pow(this.dryBulbTemperature_K.value,3) + c6*Math.pow(this.dryBulbTemperature_K.value,4) + c7*Math.log(this.dryBulbTemperature_K.value))*1000);
    }
}

class Value {
    constructor(name, unit, symbol, hassUnit, decimals){
        this.name = name;
        this.unit = unit;
        this.symbol = symbol;
        this.hassUnit = hassUnit;
        this.decimals = decimals;
        this.value = undefined;
        this.round = undefined;
    }
    setValue(value) {
        this.value = value;
        this.round = this.value.toFixed(this.decimals);
    }
}

module.exports = PsychroCalc;
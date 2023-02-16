

class Ema {
    constructor(name, timePeriod) {
        this.name = name;
        this.timePeriod = timePeriod;
        this.timer = 0;
        this.ema = 0;
    }
    getValue () {
        if (Date.now()-this.timer > this.timePeriod) {
            return null;
        } else {
            return this.ema;
        }
    }
    pushValue(value) {
        let float = parseFloat(value);
        if (Date.now()-this.timer > this.timePeriod) {
            //ema stale. reset.
            this.ema = float.toFixed(3);
        } else {
            let emaLast = parseFloat(this.ema);
            let timeDiff = Date.now-this.timer;
            //weight = 2/(no of observations+1)
            let k = 2/(this.timePeriod-timeDiff+1);
            //console.log(emaLast, float, (float-emaLast), this.weight, (float-emaLast)*this.weight, (float-emaLast)*this.weight+emaLast );
            let emaValue = parseFloat((float * k)+(emaLast*(1-k)));
            this.ema = emaValue.toFixed(3);
            console.log(`${this.name} value ${value} ema: ${this.ema} emaValue: ${emaValue} emaLast: ${emaLast} k: ${k} tDiff: ${timeDiff}`);
        }
        
        this.timer = Date.now();
        return this.ema;
    }
}

module.exports = Ema;
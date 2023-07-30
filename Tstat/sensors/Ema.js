


class Ema {
    constructor(name, timePeriod) {
        this.name = name;
        this.timePeriod = timePeriod;
        this.timer = 0;
        this.ema = null;
    }
    getValue () {
            return this.ema;
    }
    pushValue(value) {
        let float = parseFloat(value);
        if (Date.now()-this.timer > this.timePeriod) {
            //ema stale. reset.
            this.ema = float.toFixed(3);
        } else {
            let emaLast = parseFloat(this.ema);
            let timeDiff = Date.now() - +this.timer;
            //weight = 2/(no of observations+1)
            //weight = 2/(timePeriod/interval + 1)
            let k = 2/((this.timePeriod / timeDiff) + 1);
            let emaValue = parseFloat((float * k)+(emaLast*(1-k)));
            this.ema = emaValue.toFixed(3);
        }
        
        this.timer = Date.now();
        return this.ema;
    }
}

module.exports = Ema;
class MedianFilter {
    constructor(name, length = 4) {
        this.name = name;
        this.length = length;
        this.values = [];
    }
    getValue () {
        if (this.values.length < this.length) return null;
        let copy = [...this.values];
        copy.sort((a, b) => a - b);
        if (copy.length % 2 == 0) {
            return (copy[(Math.trunc(copy.length/2)-1)] + copy[(Math.trunc(copy.length/2))])/2;
        } else {
            return copy[(Math.trunc(copy.length/2))];
        }
    }
    pushValue(value) {
        let float = parseFloat(value);
        while (this.values.length >= this.length) {
            this.values.shift();
        }
        this.values.push(float);
        return this.getValue();
    }
}

module.exports = MedianFilter;
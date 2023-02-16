const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://192.168.77.1')
const pigpio = require('pigpio');
const EventEmitter = require('node:events');
const dataBus = new EventEmitter();


const hvac = {};

// Hvac routines. Baised of my ac and furnace system. Furnce controls fan so set fan idle before heat prevents
// fan from rapid cycling.

hvac.routines = {
    heat: {
        0: {func: 'cool', opt: 'idle'},
        1: {func: 'fan', opt: 'idle'}, //set fan idle and delay to prevent fan motor fast cycling.
        2: {func: 'delay', opt: 30000},
        3: {func: 'heat', opt: 'run'},
        4: {func: 'delay', opt: 30000},
        5: {func: 'fan', opt: 'run'}, //set fan run so that it has a longer cool down controlled by off routine.
        6: {func: 'complete', opt: ''}
    },
    cool: {
        0: {func: 'heat', opt: 'idle'},
        1: {func: 'fan', opt: 'run'},
        2: {func: 'delay', opt: 15000},
        3: {func: 'cool', opt: 'run'},
        4: {func: 'complete', opt: ''}
    },
    off: {
        0: {func: 'heat', opt: 'idle'},
        1: {func: 'cool', opt: 'idle'},
        2: {func: 'delay', opt: 15000}, //fan off delay change value baised on duct work cool down.
        3: {func: 'fan', opt: 'idle'},
        4: {func: 'complete', opt: ''}
    }
};

hvac.setpoints = {
    cool: 77,
    heat: 75,
    auto: 70,
    minSeperation: 2,
    hysteresis: 1.0
}

hvac.systemModes = {
    systemModeNames: ['off', 'cool', 'heat']
};

hvac.userModes = {
    userModesNames: ['off', 'cool', 'heat', 'auto'],
    userFanModesNames: ['auto', 'on', 'circ']
};

hvac.fanModes = {
    fanModeNames: ['auto', 'on', 'circOn'],
    fanRequiredModes: ['cool', 'heat'],
    circMode: {onTime: 10000, inTime: 30000} //circ setting 1 min on every 5min.
};

hvac.machines = {
    0: {
        name: 'fan',
        neededClass: 'GpioMachine',
        pin: 5,
        deviceOn: 0,
        deviceOff: 1,
        initialState: 'idle',
        initialFunc: 'stop',
        states: {
            idle: {
                run: {
                    actions: {
                        0: { //sets minimum off time
                            func: 'delay',
                            options: {
                                timer: 'idle',
                                minTime: 10000
                            }
                        },
                        1: {
                            func: 'start'
                        }
                    },
                    success: 'run',
                    fail: 'idle'
                }
            },
            run: {
                idle: {
                    actions: {
                        0: {
                            func: 'stop'
                        }
                    },
                    success: 'idle',
                    fail: 'run'
                }
            }
        },
        timers: {
            idle: 0,
            run: 0,
        },
        accumulators: {
            idle: 0,
            run: 0,
        }
    },
    1: {
        name: 'heat',
        neededClass: 'SimMachine',
        pin: 6,
        deviceOn: 0,
        deviceOff: 1,
        initialState: 'idle',
        initialFunc: 'stop',
        states: {
            idle: {
                run: {
                    actions: {
                        0: {
                            func: 'start'
                        }
                    },
                    success: 'run',
                    fail: 'idle'
                }
            },
            run: {
                idle: {
                    actions: {
                        0: { //sets minimum run time
                            func: 'delay',
                            options: {
                                timer: 'run',
                                minTime: 30000
                            }
                        },
                        1: {
                            func: 'stop'
                        }
                    },
                    success: 'idle',
                    fail: 'run'
                }
            }
        },
        timers: {
            idle: 0,
            run: 0,
        },
        accumulators: {
            idle: 0,
            run: 0,
        }
    },
    2: {        
        name: 'cool',
        neededClass: 'SimMachine',
        pin: 13,
        deviceOn: 0,
        deviceOff: 1,
        initialState: 'idle',
        initialFunc: 'stop',
        states: {
            idle: {
                run: {
                    actions: {
                        0: { //sets minimum off time
                            func: 'delay',
                            options: {
                                timer: 'idle',
                                minTime: 30000
                            }
                        },
                        1: {
                            func: 'start'
                        }
                    },
                    success: 'run',
                    fail: 'idle'
                }
            },
            run: {
                idle: {
                    actions: {
                        0: { //sets minimum run time
                            func: 'delay',
                            options: {
                                timer: 'run',
                                minTime: 30000
                            }
                        },
                        0: {
                            func: 'stop'
                        }
                    },
                    success: 'idle',
                    fail: 'run'
                }
            }
        },
        timers: {
            idle: 0,
            run: 0,
        },
        accumulators: {
            idle: 0,
            run: 0,
        }
    },
};

hvac.fanOptions = {
    name: 'fan',
    neededClass: 'SimMachine',
    pin: 5,
    initialState: 'idle',
    initialFunc: 'stop',
    states: {
        idle: {
            run: {
                actions: {
                    0: { //sets minimum off time
                        func: 'delay',
                        options: {
                            timer: 'idle',
                            minTime: 10000
                        }
                    },
                    1: {
                        func: 'start'
                    }
                },
                success: 'run',
                fail: 'idle'
            }
        },
        run: {
            idle: {
                actions: {
                    0: {
                        func: 'stop'
                    }
                },
                success: 'idle',
                fail: 'run'
            }
        }
    },
    timers: {
        idle: 0,
        run: 0,
    },
    accumulators: {
        idle: 0,
        run: 0,
    }
};

hvac.heatOptions = {
    name: 'heat',
    neededClass: 'SimMachine',
    pin: 6,
    initialState: 'idle',
    initialFunc: 'stop',
    states: {
        idle: {
            run: {
                actions: {
                    0: {
                        func: 'start'
                    }
                },
                success: 'run',
                fail: 'idle'
            }
        },
        run: {
            idle: {
                actions: {
                    0: { //sets minimum run time
                        func: 'delay',
                        options: {
                            timer: 'run',
                            minTime: 30000
                        }
                    },
                    1: {
                        func: 'stop'
                    }
                },
                success: 'idle',
                fail: 'run'
            }
        }
    },
    timers: {
        idle: 0,
        run: 0,
    },
    accumulators: {
        idle: 0,
        run: 0,
    }
};

hvac.coolOptions = {
    name: 'cool',
    neededClass: 'SimMachine',
    pin: 13,
    initialState: 'idle',
    initialFunc: 'stop',
    states: {
        idle: {
            run: {
                actions: {
                    0: { //sets minimum off time
                        func: 'delay',
                        options: {
                            timer: 'idle',
                            minTime: 30000
                        }
                    },
                    1: {
                        func: 'start'
                    }
                },
                success: 'run',
                fail: 'idle'
            }
        },
        run: {
            idle: {
                actions: {
                    0: { //sets minimum run time
                        func: 'delay',
                        options: {
                            timer: 'run',
                            minTime: 30000
                        }
                    },
                    0: {
                        func: 'stop'
                    }
                },
                success: 'idle',
                fail: 'run'
            }
        }
    },
    timers: {
        idle: 0,
        run: 0,
    },
    accumulators: {
        idle: 0,
        run: 0,
    }
};

hvac.sensors = {
    0: {
        name: "DuctBeforeHVAC",
        neededClass: "Bme",
        bmeOptions: {
            i2cBusNo: 1,
            i2cAddress: 0x77
        },
        dataStore: {
            temperature: {
                rangeCheckDiff: 100,
                lastTimeInterval: 30000
            },
            pressure: {
                publish: 0.1,
                rangeCheckDiff: 20
            },
            humidity: {
                publish: 0.5,
                rangeCheckDiff: 20
            }
        }
        
    },
    1: {
        name: "DuctAfterHVAC",
        neededClass: "Bme",
        bmeOptions: {
            i2cBusNo: 1,
            i2cAddress: 0x76
        },
        dataStore: {
            temperature: {
                rangeCheckDiff: 100,
                lastTimeInterval: 30000
            },
            pressure: {
                publish: 0.1,
                rangeCheckDiff: 20
            },
            humidity: {
                publish: 0.5,
                rangeCheckDiff: 20
            }
        }
    },
    2: {
        name: "Line Temps",
        neededClass: "DsTs",
    },
    3: {
        name: "Hallway",
        neededClass: "Serial",        
        dataStore: {
            airQualityOhms: {
                publish: 100
            },
            humidity: {
                publish: 0.5
            }
        }
    }
};

module.exports = { client, dataBus, pigpio, hvac };
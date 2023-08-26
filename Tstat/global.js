
const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://192.168.77.1')
const pigpio = require('pigpio');
const EventEmitter = require('node:events');
const dataBus = new EventEmitter();

const globalStatus = {
    system: 'startup',
    set(value) {
        if (globalStatus.system === 'ok' && value === 'ok'){
            return client.publish('home/pi64', this.system);
        }
        this.system = value;
        console.log("+++++++++++++++++ GLOBAL STATUS ++++++++++++++++++++++");
        console.log("+++++++++++++++++ ", value ," ++++++++++++++++++++++");
        client.publish('home/pi64', this.system);
        return;
    },
    send() {
        client.publish('home/pi64', this.system);
        return;
    }
};

const hvac = {};

// Hvac routines. Baised of my ac and furnace system. Furnce controls fan so set fan idle before heat prevents
// fan from rapid cycling.
// delay: mandatory delay

hvac.startup = {
    userMode: 'Cool',
    userFanMode: 'Auto'
};

hvac.routines = {
    Heat: {
        0: {func: 'cool', opt: 'idle'},
        1: {func: 'fan', opt: 'idle'}, //set fan idle and delay to prevent fan motor fast cycling.
        2: {func: 'delay', opt: 20000},
        3: {func: 'heat', opt: 'run'},
        4: {func: 'delay', opt: 80000},
        5: {func: 'fan', opt: 'run'}, //set fan run so that it has a longer cool down controlled by off routine.
        6: {func: 'complete', opt: ''}
    },
    Cool: {
        0: {func: 'heat', opt: 'idle'},
        1: {func: 'fan', opt: 'run'},
        2: {func: 'delay', opt: 15000},
        3: {func: 'cool', opt: 'run'},
        4: {func: 'complete', opt: ''}
    },
    Off: {
        0: {func: 'heat', opt: 'idle'},
        1: {func: 'cool', opt: 'idle'},
        2: {func: 'delay', opt: 180000}, //fan off delay change value baised on duct work cool down.
        3: {func: 'fan', opt: 'idle'},
        4: {func: 'complete', opt: ''}
    }
};

hvac.setpoints = {
    cool: 77,
    heat: 73,
    auto: 72,
    minSeperation: 2,
    hysteresis: 1.0
}

hvac.systemModes = {
    systemModeNames: ['Off', 'Cool', 'Heat']
};

hvac.userModes = {
    userModesNames: ['Off', 'Cool', 'Heat', 'Auto'],
    userFanModesNames: ['Auto', 'On', 'Circulate']
};

hvac.fanModes = {
    fanModeNames: ['Auto', 'On', 'CircOn'],
    fanRequiredModes: ['Cool', 'Heat'],
    circMode: {onTime: 300000, inTime: 2400000} //circ setting 5min every 30min
};

hvac.listeners = {
    tempWorker: {
        listen: "Hallway/temperature/ema",
        func: "tempLogicWorker",
        name: "Hallway"
    }
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
        neededClass: 'GpioMachine',
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
        neededClass: 'GpioMachine',
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
                                minTime: 120000
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
                                minTime: 120000
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
    99: {
        name: 'failSafe',
        neededClass: 'GpioMachine',
        pin: 21,
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
    // 2: {
    //     name: "Line Temps",
    //     neededClass: "DsTs",
    // },
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

module.exports = { client, dataBus, pigpio, hvac, globalStatus };

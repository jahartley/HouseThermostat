Thermostat system

Arduino nano baised head unit.
Raspberry pi baised control unit

Goals.
    Head Unit.
        Measure temp and humidity, and reliably send to pi
        4 wire connection, 12v, Gnd, Tx, Rx
        Extra Goals
            Pir sensor and screen
    
    At air handler.
        Control Fan, Heat, Cool, Humidifier with relays.
        12Vdc power source
        Extra Goals
            Extra temp/humidity sensors in duct work
            MQTT logging to home assistant
            Scheduled setpoints
            Save setpoints and schedule
            NTP time setting
            Web interface for setpoints and modes.

uart protocol
t send temp
b send bme humidity
g send bme gas resistance
y send bme temp
h setpoint heat 'h'
c setpoint cold 'c'
u setpoint humidty 'u'
o m s time 'o' 'm' 's'
x system status letters.
d delay time.

send letter, numbers, then newline.
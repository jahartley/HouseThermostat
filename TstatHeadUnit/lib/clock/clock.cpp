#include <Arduino.h>
#include "clock.h"
//#include "globals.h"

Clock::Clock() : 
  hour(0),
  minute(0),
  second(0),
  lastHour(0),
  lastMinute(0),
  lastSecond(0),
  lastMillis(0) {}

void Clock::poll() {
    if (lastHour != setHour) {
        hour = setHour;
        lastHour = setHour;
        screenRefresh = 1;
    }
    if (lastMinute != setMinute) {
        minute = setMinute;
        lastMinute = setMinute;
        screenRefresh = 1;
    }
    if (lastSecond != setSecond) {
        second = setSecond;
        lastSecond = setSecond;
        //screenRefresh = 1;
    }
    unsigned long currentMillis = millis();
    if((unsigned long)(currentMillis - lastMillis) > 1000){
        lastMillis = currentMillis;
        second++;
        if (second >= 60) {
            second = 0;
            minute++;
        }
        if (minute >= 60) {
            minute = 0;
            hour++;
        }
        if (hour >= 24) {
            hour = 0;
        }
        //screenRefresh = 1;
    }

}

int Clock::getHour() {
    return hour;
}

int Clock::getMinute() {
    return minute;
}

int Clock::getSecond() {
    return second;
}
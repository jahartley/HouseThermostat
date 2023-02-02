#ifndef CLOCK_H
#define CLOCK_H
#include <Arduino.h>
#include "globals.h"

class Clock {
  public:
    Clock();
    void poll();
    int getHour();
    int getMinute();
    int getSecond();
  private:
    int hour;
    int minute;
    int second;
    int lastHour;
    int lastMinute;
    int lastSecond;
    unsigned long lastMillis;
};


#endif
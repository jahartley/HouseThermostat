#include <Arduino.h>
#include "globals.h"
#include "clock.h"
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME680.h>

#define ONE_WIRE_BUS 4

int heatSetpoint = 0;
int coolSetpoint = 0;
int humiditySetpoint = 0;
int setHour = 0;
int setMinute = 0;
int setSecond = 0;
int screenRefresh = 0;
int tempInt = -150;
int tempDec = 0;
int bmeTempInt = -150;
int bmeTempDec = 0;
int humidInt = -150;
int humidDec = 0;
unsigned long tempP = 0;
unsigned long pressInt = 0;
int pressDec = 0;
unsigned long gas = 0;

OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);
Adafruit_BME680 bme;

Clock clock1;

unsigned long sensorLastMillis = 0;

void handleScreenRefresh();
void handleSerial();

void setup() {
  // put your setup code here, to run once:
  Serial.begin(9600);
  sensors.begin();
  bme.begin();
  bme.setTemperatureOversampling(BME680_OS_8X);
  bme.setHumidityOversampling(BME680_OS_2X);
  bme.setPressureOversampling(BME680_OS_4X);
  bme.setIIRFilterSize(BME680_FILTER_SIZE_3);
  bme.setGasHeater(320, 150); // 320*C for 150 ms
}

void loop() {
  // put your main code here, to run repeatedly:
  handleSerial();
  clock1.poll();
  unsigned long currentMillis = millis();
  if((unsigned long)(currentMillis - sensorLastMillis) > 5000) {
    sensorLastMillis = currentMillis;
    if (bme.endReading()) {
      float tempC = bme.temperature;
      float tempH = bme.humidity;
      tempP = bme.pressure;
      gas = bme.gas_resistance;
      float tempF = tempC*1.8+32;
      bmeTempInt = tempF;
      bmeTempDec = tempF*10-bmeTempInt*10;
      humidInt = tempH;
      humidDec = tempH*10-humidInt*10;
      screenRefresh = 1;    
    }
    bme.beginReading();
    sensors.requestTemperatures();
    float value = sensors.getTempFByIndex(0);
    if (value > -50) {
      tempInt = value;
      tempDec = value*100-tempInt*100;
      screenRefresh = 1;
    }
  }
  
  handleScreenRefresh();
}

void handleScreenRefresh() {
  if (screenRefresh != 1) return;
  Serial.print('t');
  Serial.print(tempInt);
  Serial.print('.');
  Serial.println(tempDec);
  Serial.print('y');
  Serial.print(bmeTempInt);
  Serial.print('.');
  Serial.println(bmeTempDec);
  Serial.print('b');
  Serial.print(humidInt);
  Serial.print('.');
  Serial.println(humidDec);
  Serial.print('g');
  Serial.println(gas);
  Serial.print("p");
  Serial.println(tempP);
  Serial.print("Time ");
  Serial.print(clock1.getHour());
  Serial.print(':');
  Serial.print(clock1.getMinute());
  Serial.print(':');
  Serial.println(clock1.getSecond());
  Serial.println("");
  screenRefresh = 0;
}

void handleSerial() {
  static int serialValue = 0;
  static int serialMode = 0;
  while (Serial.available() > 0) {
    char ch = Serial.read();
    if (ch >= '0' && ch <= '9' && serialMode != 0) { //new digit accumilate
      serialValue = (serialValue * 10) + (ch - '0'); 
    }
    else if (ch == 10) { //newline end mode and save, reset mode and value
      if (serialMode == 0) {
        serialValue = 0;
      } else if (serialMode == 1) {
        heatSetpoint = serialValue;
        Serial.print('h');
        Serial.println(serialValue);
        serialValue = 0;
        serialMode = 0;
      } else if (serialMode == 2) {
        coolSetpoint = serialValue;
        Serial.print('c');
        Serial.println(serialValue);
        serialValue = 0;
        serialMode = 0;
      } else if (serialMode == 3) {
        humiditySetpoint = serialValue;
        Serial.print('u');
        Serial.println(serialValue);
        serialValue = 0;
        serialMode = 0;
      } else if (serialMode == 4) {
        setHour = serialValue;
        Serial.print('o');
        Serial.println(serialValue);
        serialValue = 0;
        serialMode = 0;
      } else if (serialMode == 5) {
        setMinute = serialValue;
        Serial.print('m');
        Serial.println(serialValue);
        serialValue = 0;
        serialMode = 0;
      } else if (serialMode == 6) {
        setSecond = serialValue;
        Serial.print('s');
        Serial.println(serialValue);
        serialValue = 0;
        serialMode = 0;
      }
    }
    else if (ch == 'h') {
      serialMode = 1;
    }
    else if (ch == 'c') {
      serialMode = 2;
    }
    else if (ch == 'u') {
      serialMode = 3;
    }
    else if (ch == 'o') {
      serialMode = 4;
    }
    else if (ch == 'm') {
      serialMode = 5;
    }
    else if (ch == 's') {
      serialMode = 6;
    }
  }
}
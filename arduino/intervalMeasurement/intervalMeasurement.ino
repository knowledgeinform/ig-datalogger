#ifndef __SAM3X8E__
#define __SAM3X8E__
#endif

#define NUM_PARTS 48

volatile uint32_t ra_array[NUM_PARTS];
volatile int ra_pos = 0;

#include <sam.h>

volatile uint32_t ra = 0;

void TC0_Handler() {
    long dummy=REG_TC0_SR0; // vital - reading this clears some flag
                            // otherwise you get infinite interrupts
    ra_array[ra_pos++] = TC0->TC_CHANNEL[0].TC_RA;
    ra_pos %= NUM_PARTS; // wraps the position index if it exceeds NUM_PARTS
}

void setup() {
  Serial.begin(115200);
  Serial.println("Starting");
  Serial.println(VARIANT_MCK);
  delay(100);
  pinMode(3,OUTPUT);
  // digitalWrite(3, LOW);
  // analogWrite(3,16);
  
  Serial.println("analog set");
  delay(100);

  pmc_set_writeprotect(0); // removing write protect
  pmc_enable_periph_clk(TC0_IRQn); // enabling the peripheral clock

  Serial.println("pmc set");
  delay(100);

  // TC0->TC_CHANNEL[0].TC_CCR = TC_CCR_CLKEN; // enable the Clock Counter
  TC_Configure(TC0, 0, TC_CMR_TCCLKS_TIMER_CLOCK1 | // uses the highest resolution of time (MCK/2)
                              // TC_CMR_CPCTRG | // timer reset on RC match
                              TC_CMR_LDRA_RISING | // capture to RA on rising edge
                              // TC_CMR_LDRB_FALLING | // capture to RB on falling edge
                              TC_CMR_ETRGEDG_RISING| // external trigger on rising edge
                              TC_CMR_ABETRG); // external trigger on TIOA

  Serial.println("configured");
  delay(100);

  TC_SetRC(TC0, 0, 2^32); // set RC register to 2^16 for channel 0
  Serial.println("rc set");
  delay(100);

  TC0->TC_CHANNEL[0].TC_IER = TC_IER_LDRAS; // enable LDRA interrupt
  // TC_IER_CPCS | // enable rc interrupt
  //                             TC_IER_LOVRS | // enable LOVR interrupt
  //                             TC_IER_LDRAS | // enable LDRA interrupt
  //                             TC_IER_LDRBS; // enable LDRB interrupt

  Serial.println("interrupts enabled");
  delay(100);

  NVIC_SetPriority(TC0_IRQn,0); // set interrupt priority
  Serial.println("interrupt priority set");
  delay(100);

  // start the interrupts
  NVIC_ClearPendingIRQ(TC0_IRQn);
  Serial.println("cleared irq");
  delay(100);

  NVIC_EnableIRQ(TC0_IRQn);
  Serial.println("enabled irq");
  delay(100);

  TC_Start(TC0, 0);
  Serial.println("started timer");
  delay(100);
}

uint32_t testVal = 2<<16;

int start = 600; // microseconds
int range = 100; // microseconds
int lastOne = start + range; // microseconds
int numParts = NUM_PARTS; // simulates encoder
int dtdPart = range/NUM_PARTS;
int microDelay = start;
bool increment = false;

void loop() {
  digitalWrite(3, !digitalRead(3));
  // Serial.println(ra);
  // put your main code here, to run repeatedly:
  // Serial.write((char *) &(TC0->TC_CHANNEL[0].TC_CV), 4); // counter register value
  // Serial.println(TC0->TC_CHANNEL[0].TC_RA);
  if (ra_pos > 0) {
    Serial.write((char *) &ra_array[--ra_pos],4);
    Serial.write((char *) &ra_pos, 1); // if this gets above 0, that would indicate the things are falling behind
    // Serial.write((byte *) &testVal, 4);
    Serial.write(13); // probably unncessary
  }
  
  if (increment) {
    microDelay += dtdPart;
    if (microDelay > lastOne) microDelay = start;
  } else {
    increment = !increment;
  }
  delayMicroseconds(microDelay >> 2);
  
  // TC0->TC_CHANNEL[0].TC_CCR = TC_CCR_SWTRG; // software trigger for testing the timer 
  // delayMicroseconds(400);
  // delay(2);
}

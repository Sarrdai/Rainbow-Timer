#pragma once

#include <pebble.h>
#include "timer.h"

#define DIAL_RADIUS 100
#define LABEL_RADIUS 116
#define HUB_RADIUS 34

typedef enum {
  HUB_EMPTY,    // no time set: shows the selected unit
  HUB_SET,      // winding the dial
  HUB_RUNNING,
  HUB_PAUSED,
  HUB_DONE,
} HubMode;

typedef struct {
  TimeUnit unit;     // scale of the dial face
  int32_t angle;     // rainbow edge, 0..TRIG_MAX_ANGLE clockwise from 12 o'clock
  bool elapsed;      // draw the elapsed part instead of the remaining part
  bool knob;
  HubMode hub;
  int64_t value_ms;  // time shown in the hub
} DialModel;

void dial_draw(GContext *ctx, GRect bounds, const DialModel *model);

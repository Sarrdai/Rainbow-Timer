#pragma once

#include <pebble.h>
#include "timer.h"

typedef enum {
  MENU_ACTION_TOGGLE,  // start / pause / resume
  MENU_ACTION_STOP,
  MENU_ACTION_UNIT,
} MenuAction;

typedef void (*MenuActionHandler)(MenuAction action, TimeUnit unit);

/** Opens the timer menu; `can_start` tells whether a set time is waiting to be started. */
void menu_window_push(MenuActionHandler handler, bool can_start);

#pragma once

#include <pebble.h>

typedef enum {
  UNIT_HR = 0,   // full dial = 12 hours
  UNIT_MIN = 1,  // full dial = 60 minutes
  UNIT_SEC = 2,  // full dial = 60 seconds
} TimeUnit;

typedef enum {
  TIMER_IDLE = 0,
  TIMER_RUNNING = 1,
  TIMER_PAUSED = 2,
  TIMER_DONE = 3,
} TimerState;

#define SEC_MS ((int64_t)1000)
#define MIN_MS (60 * SEC_MS)
#define HOUR_MS (60 * MIN_MS)

/** What the dial should show right now, already quantized to the unit's update step. */
typedef struct {
  TimeUnit unit;     // scale the dial is drawn in (may differ from the selected unit)
  bool elapsed;      // auto-second view: rainbow covers the elapsed part
  int64_t shown_ms;  // remaining time rounded up to the current step
  int32_t angle;     // 0..TRIG_MAX_ANGLE, position of the rainbow edge
} TimerView;

int64_t timer_now_ms(void);
int64_t timer_max_ms(TimeUnit unit);
int64_t timer_snap_ms(TimeUnit unit);
int64_t timer_ms_from_angle(int32_t angle, TimeUnit unit);
int32_t timer_angle_from_ms(int64_t ms, TimeUnit unit);

void timer_load(void);
void timer_save(void);

TimerState timer_state(void);
TimeUnit timer_unit(void);
int64_t timer_remaining_ms(void);

/** Switches the selected unit and resets the timer. */
void timer_set_unit(TimeUnit unit);
void timer_start(int64_t duration_ms);
void timer_pause(void);
void timer_resume(void);
void timer_reset(void);
/** Marks a running timer as finished. */
void timer_finish(void);

TimerView timer_view(void);
/** Delay until the dial needs its next redraw, or -1 when nothing changes over time. */
int64_t timer_next_update_ms(void);

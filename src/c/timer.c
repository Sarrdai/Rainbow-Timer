#include "timer.h"

#define PERSIST_KEY_TIMER 1
#define PERSIST_VERSION 1
// Fire a little after a step boundary so the new step is already active
#define UPDATE_MARGIN_MS 10

typedef struct {
  uint8_t version;
  uint8_t state;
  uint8_t unit;
  int64_t end_ms;        // TIMER_RUNNING: absolute end time
  int64_t remaining_ms;  // TIMER_PAUSED: time left
  int64_t hr_phase_ms;   // hour mode: offset that keeps steps aligned to the set duration
} StoredTimer;

static StoredTimer s_timer = {
  .version = PERSIST_VERSION,
  .state = TIMER_IDLE,
  .unit = UNIT_MIN,
};

int64_t timer_now_ms(void) {
  time_t sec;
  uint16_t ms;
  time_ms(&sec, &ms);
  return (int64_t)sec * 1000 + ms;
}

int64_t timer_max_ms(TimeUnit unit) {
  switch (unit) {
    case UNIT_HR: return 12 * HOUR_MS;
    case UNIT_SEC: return MIN_MS;
    default: return HOUR_MS;
  }
}

/** Step used for winding the dial */
int64_t timer_snap_ms(TimeUnit unit) {
  switch (unit) {
    case UNIT_HR: return 5 * MIN_MS;
    case UNIT_SEC: return SEC_MS;
    default: return MIN_MS;
  }
}

/** Redraw step while running: one minute's angle (6°) on every scale. */
static int64_t prv_update_step_ms(TimeUnit unit) {
  switch (unit) {
    case UNIT_HR: return 12 * MIN_MS;
    case UNIT_SEC: return SEC_MS;
    default: return MIN_MS;
  }
}

int64_t timer_ms_from_angle(int32_t angle, TimeUnit unit) {
  return (int64_t)angle * timer_max_ms(unit) / TRIG_MAX_ANGLE;
}

int32_t timer_angle_from_ms(int64_t ms, TimeUnit unit) {
  const int64_t max = timer_max_ms(unit);
  if (ms <= 0) return 0;
  if (ms >= max) return TRIG_MAX_ANGLE;
  return (int32_t)(ms * TRIG_MAX_ANGLE / max);
}

static void prv_schedule_wakeup(void) {
  wakeup_cancel_all();
  const time_t end_sec = (time_t)((s_timer.end_ms + 999) / 1000);
  // Fails for very short timers or when another app holds the slot; the open app still alarms.
  wakeup_schedule(end_sec, 0, true);
}

void timer_load(void) {
  StoredTimer stored;
  if (persist_read_data(PERSIST_KEY_TIMER, &stored, sizeof(stored)) != (int)sizeof(stored) ||
      stored.version != PERSIST_VERSION || stored.unit > UNIT_SEC) {
    return;
  }
  s_timer = stored;
  if (s_timer.state == TIMER_RUNNING && timer_remaining_ms() <= 0) {
    s_timer.state = TIMER_DONE;
  } else if (s_timer.state == TIMER_IDLE) {
    s_timer.unit = UNIT_MIN;  // the selected unit only survives with an active timer
  }
}

void timer_save(void) {
  StoredTimer stored = s_timer;
  if (stored.state == TIMER_DONE) stored.state = TIMER_IDLE;
  persist_write_data(PERSIST_KEY_TIMER, &stored, sizeof(stored));
}

TimerState timer_state(void) { return (TimerState)s_timer.state; }

TimeUnit timer_unit(void) { return (TimeUnit)s_timer.unit; }

int64_t timer_remaining_ms(void) {
  switch (s_timer.state) {
    case TIMER_RUNNING: {
      const int64_t remaining = s_timer.end_ms - timer_now_ms();
      return remaining > 0 ? remaining : 0;
    }
    case TIMER_PAUSED: return s_timer.remaining_ms;
    default: return 0;
  }
}

void timer_set_unit(TimeUnit unit) {
  timer_reset();
  s_timer.unit = unit;
}

void timer_start(int64_t duration_ms) {
  if (duration_ms <= 0) {
    timer_reset();
    return;
  }
  s_timer.state = TIMER_RUNNING;
  s_timer.end_ms = timer_now_ms() + duration_ms;
  s_timer.hr_phase_ms = duration_ms % prv_update_step_ms(UNIT_HR);
  prv_schedule_wakeup();
}

void timer_pause(void) {
  if (s_timer.state != TIMER_RUNNING) return;
  s_timer.remaining_ms = timer_remaining_ms();
  s_timer.state = TIMER_PAUSED;
  wakeup_cancel_all();
}

void timer_resume(void) {
  if (s_timer.state == TIMER_PAUSED) timer_start(s_timer.remaining_ms);
}

void timer_reset(void) {
  s_timer.state = TIMER_IDLE;
  s_timer.remaining_ms = 0;
  wakeup_cancel_all();
}

void timer_finish(void) {
  s_timer.state = TIMER_DONE;
  wakeup_cancel_all();
}

/** Scale used while a timer is active: hr → min in the last hour, → sec in the last minute. */
static TimeUnit prv_display_unit(int64_t remaining, bool *elapsed) {
  *elapsed = false;
  if (s_timer.unit != UNIT_SEC && remaining <= MIN_MS) {
    *elapsed = true;
    return UNIT_SEC;
  }
  if (s_timer.unit == UNIT_HR && remaining <= HOUR_MS) return UNIT_MIN;
  return (TimeUnit)s_timer.unit;
}

/** Rounds up to the next step boundary; hour steps stay aligned to the set duration. */
static int64_t prv_shown_ms(int64_t remaining, TimeUnit unit) {
  const int64_t step = prv_update_step_ms(unit);
  const int64_t phase = unit == UNIT_HR ? s_timer.hr_phase_ms : 0;
  if (remaining <= phase) return remaining;
  return phase + (remaining - phase + step - 1) / step * step;
}

TimerView timer_view(void) {
  TimerView view = { .unit = (TimeUnit)s_timer.unit };
  if (s_timer.state != TIMER_RUNNING && s_timer.state != TIMER_PAUSED) return view;

  const int64_t remaining = timer_remaining_ms();
  view.unit = prv_display_unit(remaining, &view.elapsed);
  view.shown_ms = prv_shown_ms(remaining, view.unit);
  view.angle = timer_angle_from_ms(view.shown_ms, view.unit);
  return view;
}

int64_t timer_next_update_ms(void) {
  if (s_timer.state != TIMER_RUNNING) return -1;
  const int64_t remaining = timer_remaining_ms();
  if (remaining <= 0) return 0;

  bool elapsed;
  const TimeUnit unit = prv_display_unit(remaining, &elapsed);
  const int64_t shown = prv_shown_ms(remaining, unit);
  int64_t delay = remaining - (shown - prv_update_step_ms(unit));
  // The switch to the minute scale is not necessarily on an hour-mode step
  if (unit == UNIT_HR && remaining - HOUR_MS < delay) delay = remaining - HOUR_MS;
  return delay + UPDATE_MARGIN_MS;
}

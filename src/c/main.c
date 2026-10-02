#include <pebble.h>
#include "dial.h"
#include "menu.h"
#include "timer.h"

#define AUTOSTART_DELAY_MS 1500
#define WIND_REPEAT_MS 100
#define WIND_FAST_AFTER 10        // repeats before winding speeds up
#define WIND_REPEAT_GAP_MS 250    // presses closer than this count as one hold
#define DRAG_THRESHOLD_PX 8
#define QUICK_SET_RING_PX 14      // taps this close to the dial edge pick a number
#define ALARM_REPEATS 3
#define ALARM_INTERVAL_MS 8000

static Window *s_window;
static Layer *s_dial_layer;

static AppTimer *s_update_timer;
static AppTimer *s_autostart_timer;
static AppTimer *s_alarm_timer;
static int s_alarm_count;

// Winding: the dial is being set but the timer is not running yet
static bool s_setting;
static int32_t s_set_angle;
static int64_t s_last_wind_ms;
static int s_wind_repeats;

static bool s_touch_subscribed;
static bool s_touch_active;
static bool s_dragging;
static GPoint s_touch_start;
static int32_t s_touch_angle;

static void prv_refresh(void);

// --- Helpers -----------------------------------------------------------------------------

static GPoint prv_center(void) {
  const GRect bounds = layer_get_bounds(s_dial_layer);
  return grect_center_point(&bounds);
}

static int32_t prv_dist2(GPoint a, GPoint b) {
  const int32_t dx = a.x - b.x;
  const int32_t dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** Clockwise angle from 12 o'clock */
static int32_t prv_angle_of(GPoint p) {
  const GPoint c = prv_center();
  int32_t angle = atan2_lookup(p.x - c.x, c.y - p.y);
  if (angle < 0) angle += TRIG_MAX_ANGLE;
  return angle % TRIG_MAX_ANGLE;
}

static int64_t prv_clamp_ms(int64_t ms) {
  const int64_t max = timer_max_ms(timer_unit());
  return ms < 0 ? 0 : (ms > max ? max : ms);
}

/** Set value snapped to the unit's step (5 min / 1 min / 1 s) */
static int64_t prv_set_ms(void) {
  const TimeUnit unit = timer_unit();
  const int64_t step = timer_snap_ms(unit);
  const int64_t ms = timer_ms_from_angle(s_set_angle, unit);
  return prv_clamp_ms((ms + step / 2) / step * step);
}

static void prv_cancel_timer(AppTimer **timer) {
  if (*timer) {
    app_timer_cancel(*timer);
    *timer = NULL;
  }
}

// --- Alarm -------------------------------------------------------------------------------

static void prv_vibrate_alarm(void) {
  static const uint32_t segments[] = { 300, 150, 300, 150, 600 };
  vibes_enqueue_custom_pattern((VibePattern){ .durations = segments,
                                              .num_segments = ARRAY_LENGTH(segments) });
  light_enable_interaction();
}

static void prv_alarm_tick(void *data) {
  s_alarm_timer = NULL;
  if (timer_state() != TIMER_DONE || ++s_alarm_count >= ALARM_REPEATS) return;
  prv_vibrate_alarm();
  s_alarm_timer = app_timer_register(ALARM_INTERVAL_MS, prv_alarm_tick, NULL);
}

static void prv_finish(bool alarm) {
  timer_finish();
  prv_cancel_timer(&s_update_timer);
  if (alarm) {
    s_alarm_count = 0;
    prv_vibrate_alarm();
    s_alarm_timer = app_timer_register(ALARM_INTERVAL_MS, prv_alarm_tick, NULL);
  }
  layer_mark_dirty(s_dial_layer);
}

static void prv_dismiss_done(void) {
  prv_cancel_timer(&s_alarm_timer);
  vibes_cancel();
  timer_reset();
  prv_refresh();
}

// --- Timer control -----------------------------------------------------------------------

static void prv_update_tick(void *data) {
  s_update_timer = NULL;
  prv_refresh();
}

/** Redraws and schedules the next redraw at the next visible step. */
static void prv_refresh(void) {
  prv_cancel_timer(&s_update_timer);
  if (timer_state() == TIMER_RUNNING && !s_setting) {
    const int64_t delay = timer_next_update_ms();
    if (delay <= 0) {
      prv_finish(true);
      return;
    }
    s_update_timer = app_timer_register((uint32_t)delay, prv_update_tick, NULL);
  }
  layer_mark_dirty(s_dial_layer);
}

/** Stops a running/paused timer and lets the user wind from its remaining time. */
static void prv_begin_setting(void) {
  if (s_setting) return;
  const TimerState state = timer_state();
  const int64_t remaining = (state == TIMER_RUNNING || state == TIMER_PAUSED) ? timer_remaining_ms() : 0;
  timer_reset();
  prv_cancel_timer(&s_update_timer);
  s_setting = true;
  s_set_angle = timer_angle_from_ms(prv_clamp_ms(remaining), timer_unit());
}

static void prv_commit_setting(void) {
  if (!s_setting) return;
  s_setting = false;
  prv_cancel_timer(&s_autostart_timer);
  timer_start(prv_set_ms());
  prv_refresh();
}

static void prv_autostart(void *data) {
  s_autostart_timer = NULL;
  prv_commit_setting();
}

static void prv_toggle(void) {
  if (s_setting) {
    prv_commit_setting();
    return;
  }
  switch (timer_state()) {
    case TIMER_RUNNING: timer_pause(); break;
    case TIMER_PAUSED: timer_resume(); break;
    case TIMER_DONE: prv_dismiss_done(); return;
    default: return;
  }
  prv_refresh();
}

static void prv_quick_set(int32_t angle) {
  // Nearest of the 12 numbers; the top one is 60 min / 60 sec / 12 h
  int index = (angle + TRIG_MAX_ANGLE / 24) * 12 / TRIG_MAX_ANGLE;
  if (index == 0) index = 12;
  s_setting = false;
  prv_cancel_timer(&s_autostart_timer);
  timer_start(timer_max_ms(timer_unit()) * index / 12);
  prv_refresh();
}

static void prv_menu_action(MenuAction action, TimeUnit unit) {
  switch (action) {
    case MENU_ACTION_TOGGLE:
      prv_toggle();
      break;
    case MENU_ACTION_STOP:
      s_setting = false;
      prv_cancel_timer(&s_autostart_timer);
      prv_cancel_timer(&s_alarm_timer);
      timer_reset();
      prv_refresh();
      break;
    case MENU_ACTION_UNIT:
      s_setting = false;
      prv_cancel_timer(&s_autostart_timer);
      prv_cancel_timer(&s_alarm_timer);
      timer_set_unit(unit);
      prv_refresh();
      break;
  }
}

// --- Buttons -----------------------------------------------------------------------------

static void prv_wind(int direction) {
  if (timer_state() == TIMER_DONE) {
    prv_dismiss_done();
    return;
  }
  prv_begin_setting();

  // Holding the button winds faster after a while
  const int64_t now = timer_now_ms();
  s_wind_repeats = (now - s_last_wind_ms < WIND_REPEAT_GAP_MS) ? s_wind_repeats + 1 : 0;
  s_last_wind_ms = now;

  const TimeUnit unit = timer_unit();
  const int64_t factor = s_wind_repeats >= WIND_FAST_AFTER ? (unit == UNIT_HR ? 6 : 5) : 1;
  const int64_t ms = prv_clamp_ms(prv_set_ms() + direction * factor * timer_snap_ms(unit));
  s_set_angle = timer_angle_from_ms(ms, unit);

  prv_cancel_timer(&s_autostart_timer);
  s_autostart_timer = app_timer_register(AUTOSTART_DELAY_MS, prv_autostart, NULL);
  layer_mark_dirty(s_dial_layer);
}

static void prv_up_click(ClickRecognizerRef recognizer, void *context) { prv_wind(1); }

static void prv_down_click(ClickRecognizerRef recognizer, void *context) { prv_wind(-1); }

static void prv_select_click(ClickRecognizerRef recognizer, void *context) { prv_toggle(); }

static void prv_select_long_click(ClickRecognizerRef recognizer, void *context) {
  if (timer_state() == TIMER_DONE) prv_dismiss_done();
  prv_cancel_timer(&s_autostart_timer);
  menu_window_push(prv_menu_action, s_setting && prv_set_ms() > 0);
}

static void prv_click_config(void *context) {
  window_single_repeating_click_subscribe(BUTTON_ID_UP, WIND_REPEAT_MS, prv_up_click);
  window_single_repeating_click_subscribe(BUTTON_ID_DOWN, WIND_REPEAT_MS, prv_down_click);
  window_single_click_subscribe(BUTTON_ID_SELECT, prv_select_click);
  window_long_click_subscribe(BUTTON_ID_SELECT, 500, prv_select_long_click, NULL);
}

// --- Touch -------------------------------------------------------------------------------

static void prv_touch_handler(const TouchEvent *event, void *context) {
  const GPoint p = GPoint(event->x, event->y);
  switch (event->type) {
    case TouchEvent_Touchdown:
      if (timer_state() == TIMER_DONE) {
        prv_dismiss_done();
        s_touch_active = false;
        return;
      }
      s_touch_active = true;
      s_dragging = false;
      s_touch_start = p;
      s_touch_angle = prv_angle_of(p);
      break;

    case TouchEvent_PositionUpdate: {
      if (!s_touch_active) return;
      if (!s_dragging) {
        if (prv_dist2(p, s_touch_start) < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
        s_dragging = true;
        prv_begin_setting();
        prv_cancel_timer(&s_autostart_timer);
      }
      // Accumulate the rotation so the rainbow follows the finger and stops at 0 and full
      const int32_t angle = prv_angle_of(p);
      int32_t delta = angle - s_touch_angle;
      if (delta > TRIG_MAX_ANGLE / 2) delta -= TRIG_MAX_ANGLE;
      else if (delta < -TRIG_MAX_ANGLE / 2) delta += TRIG_MAX_ANGLE;
      s_touch_angle = angle;
      s_set_angle += delta;
      if (s_set_angle < 0) s_set_angle = 0;
      if (s_set_angle > TRIG_MAX_ANGLE) s_set_angle = TRIG_MAX_ANGLE;
      layer_mark_dirty(s_dial_layer);
      break;
    }

    case TouchEvent_Liftoff: {
      if (!s_touch_active) return;
      s_touch_active = false;
      if (s_dragging) {
        s_dragging = false;
        prv_commit_setting();
        return;
      }
      const int32_t dist2 = prv_dist2(s_touch_start, prv_center());
      if (dist2 <= HUB_RADIUS * HUB_RADIUS) {
        prv_toggle();
      } else if (dist2 >= (DIAL_RADIUS - QUICK_SET_RING_PX) * (DIAL_RADIUS - QUICK_SET_RING_PX)) {
        prv_quick_set(prv_angle_of(s_touch_start));
      }
      break;
    }
  }
}

// --- Window ------------------------------------------------------------------------------

static void prv_dial_update(Layer *layer, GContext *ctx) {
  DialModel model = { .unit = timer_unit() };

  if (s_setting) {
    model.angle = s_set_angle;
    model.knob = true;
    model.value_ms = prv_set_ms();
    model.hub = (model.value_ms > 0 || s_dragging) ? HUB_SET : HUB_EMPTY;
  } else {
    switch (timer_state()) {
      case TIMER_RUNNING:
      case TIMER_PAUSED: {
        const TimerView view = timer_view();
        model.unit = view.unit;
        model.angle = view.angle;
        model.elapsed = view.elapsed;
        model.knob = true;
        model.value_ms = view.shown_ms;
        model.hub = timer_state() == TIMER_RUNNING ? HUB_RUNNING : HUB_PAUSED;
        break;
      }
      case TIMER_DONE: model.hub = HUB_DONE; break;
      default: model.hub = HUB_EMPTY; break;
    }
  }
  dial_draw(ctx, layer_get_bounds(layer), &model);
}

static void prv_window_load(Window *window) {
  Layer *root = window_get_root_layer(window);
  s_dial_layer = layer_create(layer_get_bounds(root));
  layer_set_update_proc(s_dial_layer, prv_dial_update);
  layer_add_child(root, s_dial_layer);
}

static void prv_window_unload(Window *window) {
  layer_destroy(s_dial_layer);
}

// Touch only while the dial is visible: the sensor costs battery
static void prv_window_appear(Window *window) {
  if (!s_touch_subscribed && touch_service_is_enabled()) {
    touch_service_subscribe(prv_touch_handler, NULL);
    s_touch_subscribed = true;
  }
  prv_refresh();
}

static void prv_window_disappear(Window *window) {
  if (s_touch_subscribed) {
    touch_service_unsubscribe();
    s_touch_subscribed = false;
  }
  s_touch_active = false;
  s_dragging = false;
}

static void prv_wakeup_handler(WakeupId id, int32_t cookie) {
  if (timer_state() == TIMER_RUNNING && timer_remaining_ms() <= 0) prv_finish(true);
}

static void prv_init(void) {
  timer_load();
  wakeup_service_subscribe(prv_wakeup_handler);

  s_window = window_create();
  window_set_background_color(s_window, GColorBlack);
  window_set_click_config_provider(s_window, prv_click_config);
  window_set_window_handlers(s_window, (WindowHandlers){
    .load = prv_window_load,
    .unload = prv_window_unload,
    .appear = prv_window_appear,
    .disappear = prv_window_disappear,
  });
  window_stack_push(s_window, true);

  // Launched by the end-of-timer wakeup: ring. Opened later by hand: just show "done".
  if (timer_state() == TIMER_DONE && launch_reason() == APP_LAUNCH_WAKEUP) prv_finish(true);
}

static void prv_deinit(void) {
  // Leaving while winding starts the wound time, like the autostart would
  if (s_setting) timer_start(prv_set_ms());
  timer_save();
  window_destroy(s_window);
}

int main(void) {
  prv_init();
  app_event_loop();
  prv_deinit();
}

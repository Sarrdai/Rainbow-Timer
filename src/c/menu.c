#include "menu.h"

enum {
  ROW_TOGGLE,
  ROW_STOP,
  ROW_HR,
  ROW_MIN,
  ROW_SEC,
  ROW_COUNT,
};

static Window *s_window;
static MenuLayer *s_menu_layer;
static MenuActionHandler s_handler;
static bool s_can_start;

static const char *prv_toggle_title(void) {
  switch (timer_state()) {
    case TIMER_RUNNING: return "Pause";
    case TIMER_PAUSED: return "Fortsetzen";
    default: return "Start";
  }
}

static uint16_t prv_get_num_rows(MenuLayer *menu_layer, uint16_t section_index, void *context) {
  return ROW_COUNT;
}

static void prv_draw_row(GContext *ctx, const Layer *cell_layer, MenuIndex *cell_index, void *context) {
  static const char *UNIT_TITLES[] = { "Stunden", "Minuten", "Sekunden" };
  static const char *UNIT_RANGES[] = { "12 h", "60 min", "60 sec" };
  static char subtitle[24];

  switch (cell_index->row) {
    case ROW_TOGGLE:
      menu_cell_basic_draw(ctx, cell_layer, prv_toggle_title(), NULL, NULL);
      break;
    case ROW_STOP:
      menu_cell_basic_draw(ctx, cell_layer, "Stopp", "Zurücksetzen", NULL);
      break;
    default: {
      const TimeUnit unit = (TimeUnit)(cell_index->row - ROW_HR);
      snprintf(subtitle, sizeof(subtitle), "%s%s", unit == timer_unit() ? "aktiv - " : "",
               UNIT_RANGES[unit]);
      menu_cell_basic_draw(ctx, cell_layer, UNIT_TITLES[unit], subtitle, NULL);
      break;
    }
  }
}

static void prv_select(MenuLayer *menu_layer, MenuIndex *cell_index, void *context) {
  const uint16_t row = cell_index->row;
  if (row == ROW_TOGGLE && timer_state() != TIMER_RUNNING && timer_state() != TIMER_PAUSED &&
      !s_can_start) {
    vibes_short_pulse();  // nothing to start: wind the dial first
    return;
  }
  window_stack_remove(s_window, true);
  if (row == ROW_TOGGLE) s_handler(MENU_ACTION_TOGGLE, timer_unit());
  else if (row == ROW_STOP) s_handler(MENU_ACTION_STOP, timer_unit());
  else s_handler(MENU_ACTION_UNIT, (TimeUnit)(row - ROW_HR));
}

static void prv_window_load(Window *window) {
  Layer *root = window_get_root_layer(window);
  s_menu_layer = menu_layer_create(layer_get_bounds(root));
  menu_layer_set_callbacks(s_menu_layer, NULL, (MenuLayerCallbacks){
    .get_num_rows = prv_get_num_rows,
    .draw_row = prv_draw_row,
    .select_click = prv_select,
  });
  menu_layer_set_normal_colors(s_menu_layer, GColorBlack, GColorWhite);
  menu_layer_set_highlight_colors(s_menu_layer, GColorChromeYellow, GColorBlack);
  menu_layer_set_click_config_onto_window(s_menu_layer, window);
  layer_add_child(root, menu_layer_get_layer(s_menu_layer));
}

static void prv_window_unload(Window *window) {
  menu_layer_destroy(s_menu_layer);
  window_destroy(s_window);
  s_window = NULL;
}

void menu_window_push(MenuActionHandler handler, bool can_start) {
  if (s_window) return;
  s_handler = handler;
  s_can_start = can_start;
  s_window = window_create();
  window_set_background_color(s_window, GColorBlack);
  window_set_window_handlers(s_window, (WindowHandlers){
    .load = prv_window_load,
    .unload = prv_window_unload,
  });
  window_stack_push(s_window, true);
}

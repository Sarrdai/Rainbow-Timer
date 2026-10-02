#include "dial.h"

#define RING_COUNT 7
#define RAINBOW_INNER_RADIUS (DIAL_RADIUS * 47 / 100)
#define KNOB_RADIUS 7

// Rainbow bands from inside out: violet → red
static const uint8_t RING_COLORS[RING_COUNT] = {
  GColorPurpleARGB8, GColorIndigoARGB8, GColorBlueMoonARGB8, GColorKellyGreenARGB8,
  GColorYellowARGB8, GColorChromeYellowARGB8, GColorRedARGB8,
};

// Dial numbers cycle red, orange, yellow, green, blue, indigo, violet
static const uint8_t LABEL_COLORS[RING_COUNT] = {
  GColorRedARGB8, GColorChromeYellowARGB8, GColorYellowARGB8, GColorBrightGreenARGB8,
  GColorPictonBlueARGB8, GColorLavenderIndigoARGB8, GColorVividVioletARGB8,
};

static GPoint prv_polar(GPoint center, int32_t radius, int32_t angle) {
  return GPoint(center.x + sin_lookup(angle) * radius / TRIG_MAX_RATIO,
                center.y - cos_lookup(angle) * radius / TRIG_MAX_RATIO);
}

static GRect prv_circle_rect(GPoint center, int16_t radius) {
  return GRect(center.x - radius, center.y - radius, 2 * radius, 2 * radius);
}

static void prv_draw_tick(GContext *ctx, GPoint center, int32_t angle, int32_t inner, uint8_t width) {
  graphics_context_set_stroke_width(ctx, width);
  graphics_draw_line(ctx, prv_polar(center, inner, angle), prv_polar(center, DIAL_RADIUS, angle));
}

static void prv_draw_ticks(GContext *ctx, GPoint center, TimeUnit unit) {
  graphics_context_set_stroke_color(ctx, GColorBlack);
  if (unit == UNIT_HR) {
    // Quarter hours (the 12 hour ticks are drawn with the labels)
    for (int i = 1; i <= 48; i++) {
      if (i % 4 == 0) continue;
      prv_draw_tick(ctx, center, TRIG_MAX_ANGLE * i / 48, DIAL_RADIUS - 5, 1);
    }
    // 5-minute marks
    graphics_context_set_stroke_color(ctx, GColorLightGray);
    for (int i = 1; i <= 144; i++) {
      if (i % 3 == 0) continue;
      prv_draw_tick(ctx, center, TRIG_MAX_ANGLE * i / 144, DIAL_RADIUS - 3, 1);
    }
    return;
  }
  for (int i = 1; i <= 60; i++) {
    if (i % 5 == 0) continue;
    prv_draw_tick(ctx, center, TRIG_MAX_ANGLE * i / 60, DIAL_RADIUS - 5, 1);
  }
}

static void prv_draw_labels(GContext *ctx, GPoint center, TimeUnit unit) {
  const GFont font = fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD);
  char text[4];
  for (int i = 0; i < 12; i++) {
    const int32_t angle = TRIG_MAX_ANGLE * (i + 1) / 12;
    graphics_context_set_stroke_color(ctx, GColorBlack);
    prv_draw_tick(ctx, center, angle, DIAL_RADIUS - 8, unit == UNIT_HR ? 3 : 2);

    const bool hours = unit == UNIT_HR;
    snprintf(text, sizeof(text), "%d", hours ? i + 1 : (i + 1) * 5);
    const uint8_t color = LABEL_COLORS[(hours ? i : i + 1) % RING_COUNT];
    graphics_context_set_text_color(ctx, (GColor){ .argb = color });

    const GPoint pos = prv_polar(center, LABEL_RADIUS, angle);
    // Gothic glyphs sit low in their box; shift up to center them visually
    const GRect box = GRect(pos.x - 15, pos.y - 13, 30, 22);
    graphics_draw_text(ctx, text, font, box, GTextOverflowModeFill, GTextAlignmentCenter, NULL);
  }
}

static void prv_draw_rainbow(GContext *ctx, GPoint center, int32_t angle, bool elapsed) {
  const int32_t start = elapsed ? angle : 0;
  const int32_t end = elapsed ? TRIG_MAX_ANGLE : angle;
  if (end - start <= 0) return;

  const int32_t band_span = DIAL_RADIUS - RAINBOW_INNER_RADIUS;
  for (int i = 0; i < RING_COUNT; i++) {
    const int16_t inner = RAINBOW_INNER_RADIUS + band_span * i / RING_COUNT;
    const int16_t outer = RAINBOW_INNER_RADIUS + band_span * (i + 1) / RING_COUNT;
    graphics_context_set_fill_color(ctx, (GColor){ .argb = RING_COLORS[i] });
    // One pixel of overlap avoids hairline gaps between bands
    graphics_fill_radial(ctx, prv_circle_rect(center, outer), GOvalScaleModeFitCircle,
                         outer - inner + 1, start, end);
  }
}

static void prv_draw_knob(GContext *ctx, GPoint center, int32_t angle) {
  const GPoint pos = prv_polar(center, DIAL_RADIUS, angle);
  graphics_context_set_fill_color(ctx, GColorWhite);
  graphics_fill_circle(ctx, pos, KNOB_RADIUS);
  graphics_context_set_stroke_color(ctx, GColorDarkGray);
  graphics_context_set_stroke_width(ctx, 2);
  graphics_draw_circle(ctx, pos, KNOB_RADIUS);
}

static void prv_format_value(char *value, size_t value_size, const char **unit_text,
                             int64_t ms, TimeUnit unit) {
  switch (unit) {
    case UNIT_HR: {
      const int total_min = (int)((ms + MIN_MS - 1) / MIN_MS);
      snprintf(value, value_size, "%d:%02d", total_min / 60, total_min % 60);
      *unit_text = "h";
      break;
    }
    case UNIT_SEC:
      snprintf(value, value_size, "%d", (int)((ms + SEC_MS - 1) / SEC_MS));
      *unit_text = "sec";
      break;
    default:
      snprintf(value, value_size, "%d", (int)((ms + MIN_MS - 1) / MIN_MS));
      *unit_text = "min";
      break;
  }
}

static void prv_draw_play_icon(GContext *ctx, GPoint at) {
  static const GPoint points[] = { { -4, -5 }, { 5, 0 }, { -4, 5 } };
  static const GPathInfo info = { .num_points = 3, .points = (GPoint *)points };
  GPath *path = gpath_create(&info);
  if (!path) return;
  gpath_move_to(path, at);
  graphics_context_set_fill_color(ctx, GColorLightGray);
  gpath_draw_filled(ctx, path);
  gpath_destroy(path);
}

static void prv_draw_hub(GContext *ctx, GPoint center, const DialModel *model) {
  graphics_context_set_fill_color(ctx, GColorBlack);
  graphics_fill_circle(ctx, center, HUB_RADIUS);

  char value[8];
  const char *unit_text;
  prv_format_value(value, sizeof(value), &unit_text, model->value_ms, model->unit);

  const GRect value_box = GRect(center.x - HUB_RADIUS, center.y - 22, 2 * HUB_RADIUS, 30);
  const GRect unit_box = GRect(center.x - HUB_RADIUS, center.y + 6, 2 * HUB_RADIUS, 16);
  const GFont value_font = fonts_get_system_font(strlen(value) > 3 ? FONT_KEY_GOTHIC_24_BOLD
                                                                   : FONT_KEY_GOTHIC_28_BOLD);
  const GFont unit_font = fonts_get_system_font(FONT_KEY_GOTHIC_14);

  switch (model->hub) {
    case HUB_EMPTY:
      graphics_context_set_text_color(ctx, GColorLightGray);
      graphics_draw_text(ctx, unit_text, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD),
                         GRect(center.x - HUB_RADIUS, center.y - 13, 2 * HUB_RADIUS, 22),
                         GTextOverflowModeFill, GTextAlignmentCenter, NULL);
      break;
    case HUB_DONE:
      graphics_context_set_text_color(ctx, GColorWhite);
      graphics_draw_text(ctx, "Fertig!", fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD),
                         GRect(center.x - HUB_RADIUS, center.y - 13, 2 * HUB_RADIUS, 22),
                         GTextOverflowModeFill, GTextAlignmentCenter, NULL);
      break;
    default:
      graphics_context_set_text_color(ctx, GColorWhite);
      graphics_draw_text(ctx, value, value_font, value_box, GTextOverflowModeFill,
                         GTextAlignmentCenter, NULL);
      if (model->hub == HUB_PAUSED) {
        prv_draw_play_icon(ctx, GPoint(center.x, center.y + 15));
      } else {
        graphics_context_set_text_color(ctx, GColorLightGray);
        graphics_draw_text(ctx, unit_text, unit_font, unit_box, GTextOverflowModeFill,
                           GTextAlignmentCenter, NULL);
      }
      break;
  }
}

void dial_draw(GContext *ctx, GRect bounds, const DialModel *model) {
  const GPoint center = grect_center_point(&bounds);
  graphics_context_set_antialiased(ctx, true);

  graphics_context_set_fill_color(ctx, GColorBlack);
  graphics_fill_rect(ctx, bounds, 0, GCornerNone);
  graphics_context_set_fill_color(ctx, GColorWhite);
  graphics_fill_circle(ctx, center, DIAL_RADIUS);

  prv_draw_ticks(ctx, center, model->unit);
  prv_draw_labels(ctx, center, model->unit);
  prv_draw_rainbow(ctx, center, model->angle, model->elapsed);
  if (model->knob) prv_draw_knob(ctx, center, model->angle);
  prv_draw_hub(ctx, center, model);
}

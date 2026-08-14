#include <LVGL_CYD.h>

extern "C" lv_obj_t * new_screen(lv_obj_t * base, bool use_gradient) {
  lv_obj_t * obj = lv_obj_create(base);

  if (use_gradient) {
    lv_obj_set_style_bg_opa(obj, LV_OPA_COVER, LV_PART_MAIN);
    lv_obj_set_style_bg_color(obj, lv_color_hex(0x1A3D6B), 0);
    lv_obj_set_style_bg_grad_color(obj, lv_color_hex(0xEA824D), 0);
    lv_obj_set_style_bg_grad_dir(obj, LV_GRAD_DIR_VER, 0);
  } else {
    lv_obj_set_style_bg_grad_color(obj, lv_color_hex(0xFFFFFF), 0);
  }

  lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_style_border_width(obj, 0, 0);
  lv_obj_set_layout(obj, LV_LAYOUT_FLEX);
  lv_obj_set_flex_flow(obj, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_flex_align(obj, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
  lv_obj_set_style_pad_top(obj, 5, LV_PART_MAIN);
  lv_obj_set_style_pad_bottom(obj, 5, LV_PART_MAIN);
  lv_obj_set_style_pad_row(obj, 10, LV_PART_MAIN);
  return obj;
}

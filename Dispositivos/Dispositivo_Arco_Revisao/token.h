#ifndef TOKEN_H
#define TOKEN_H

#include <Arduino.h>
#include <LVGL_CYD.h>

extern String deviceToken;
extern lv_obj_t * btn_exit;

#ifdef __cplusplus
extern "C" {
#endif
extern lv_obj_t * new_screen(lv_obj_t * base, bool use_gradient);
#ifdef __cplusplus
}
#endif

void go_token();

#endif

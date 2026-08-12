// Permite exibir erro de login a partir do .ino
#ifdef __cplusplus
extern "C" {
#endif
void show_login_error(const char* msg);
#ifdef __cplusplus
}
#endif
#ifndef LOGIN_H
#define LOGIN_H

#include <LVGL_CYD.h>

#ifdef __cplusplus
extern "C" {
#endif
extern lv_obj_t * scr_login;
extern lv_obj_t * error_label;
extern lv_obj_t * ta;
extern lv_obj_t * btn_exit;
extern lv_obj_t * new_screen(lv_obj_t * base, bool use_gradient);

void go_login();
void go_dashboard();

#ifdef __cplusplus
}
#endif

#endif

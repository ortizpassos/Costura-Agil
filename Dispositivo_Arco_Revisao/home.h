#ifndef HOME_H
#define HOME_H

#include <LVGL_CYD.h>

#ifdef __cplusplus
extern "C" {
#endif
extern lv_obj_t * btn_exit;
extern lv_obj_t * new_screen(lv_obj_t * base, bool use_gradient);

void go_home();


#ifdef __cplusplus
}
#endif

#endif

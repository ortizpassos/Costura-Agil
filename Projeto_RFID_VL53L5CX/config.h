#ifndef CONFIG_H
#define CONFIG_H

#include <lvgl.h>

// Declaração da tela de configuração
extern lv_obj_t * scr_config;

// Funções públicas
void go_config();
void update_config_info(const char* wifi, const char* ip, const char* backend, bool connected);

#endif

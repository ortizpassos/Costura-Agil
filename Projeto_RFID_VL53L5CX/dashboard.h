#ifndef DASHBOARD_H
#define DASHBOARD_H

#include <LVGL_CYD.h>

#ifdef __cplusplus
extern "C" {
#endif

extern lv_obj_t * scr_dashboard;
extern lv_obj_t * btn_exit;  // <-- ADICIONE ESTA LINHA
extern lv_obj_t * obj;


extern lv_obj_t * scr_touch;

// These need to be global as they are used in the callback.
extern lv_obj_t * horizontal;
extern lv_obj_t * vertical;



// Função da tela principal
void go_dashboard();
void update_dashboard(const char* operacao, const char* funcionario, int meta, int qtd);
void go_touch();



// Função definida no arquivo .ino (para poder ser chamada no .cpp)


// Declaração da função utilitária de tela
extern lv_obj_t * new_screen(lv_obj_t * base, bool use_gradient);

#ifdef __cplusplus
}
#endif

#endif

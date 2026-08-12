#ifndef CALIBRACAO_H
#define CALIBRACAO_H

#include <LVGL_CYD.h>

#ifdef __cplusplus
extern "C" {
#endif

extern lv_obj_t * scr_calibracao;
extern lv_obj_t * scr_calibracao_processo;

void go_calibracao();
void atualizar_calibracao_status(const char* mensagem, bool sucesso);

#ifdef __cplusplus
}
#endif

#endif

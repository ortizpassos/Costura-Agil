#ifndef OPERACAO_H
#define OPERACAO_H

#include <LVGL_CYD.h>

#ifdef __cplusplus
extern "C" {
#endif

void go_operacao();
void clear_operacao_list();
void add_operacao_to_list(const char* id, const char* nome, int meta);
void show_operacao_message(const char* mensagem);
void update_operacao_quantities(const char* artigoId, int quantidadeAtual, int meta);
void update_operacao_artigo(const char* artigoId, const char* nome, int quantidadeAtual, int meta);
extern lv_obj_t * new_screen(lv_obj_t * base, bool use_gradient);
extern lv_obj_t * btn_exit;

#ifdef __cplusplus
}
#endif

#endif

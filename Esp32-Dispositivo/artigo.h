#ifndef ARTIGO_H
#define ARTIGO_H

#include <LVGL_CYD.h>

#ifdef __cplusplus
extern "C" {
#endif

void go_artigo();
void clear_artigo_list();
void add_artigo_to_list(const char* id, const char* nome, int meta);
void show_artigo_message(const char* mensagem);
void update_artigo_quantities(const char* artigoId, int quantidadeAtual, int meta);
void update_artigo_item(const char* artigoId, const char* nome, int quantidadeAtual, int meta);
extern lv_obj_t * new_screen(lv_obj_t * base, bool use_gradient);
extern lv_obj_t * btn_exit;

#ifdef __cplusplus
}
#endif

#endif

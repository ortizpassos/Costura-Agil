#include "revisao_ui.h"
#include <LVGL_CYD.h>

extern lv_obj_t* btn_exit;
extern String currentScreen;
extern "C" lv_obj_t* new_screen(lv_obj_t* base, bool use_gradient);

namespace {
lv_obj_t* scr = nullptr;
lv_obj_t* titulo = nullptr;
lv_obj_t* detalhe = nullptr;
lv_obj_t* progresso = nullptr;

void garantirTela() {
  if (scr) return;
  scr = new_screen(nullptr, true);
  lv_obj_set_size(scr, 320, 240);
  lv_obj_set_scroll_dir(scr, LV_DIR_NONE);

  lv_obj_t* card = lv_obj_create(scr);
  lv_obj_set_size(card, 304, 224);
  lv_obj_center(card);
  lv_obj_set_style_radius(card, 18, 0);
  lv_obj_set_style_bg_opa(card, LV_OPA_30, 0);
  lv_obj_set_style_pad_all(card, 12, 0);
  lv_obj_set_style_pad_row(card, 14, 0);
  lv_obj_set_flex_flow(card, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_flex_align(card, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);

  titulo = lv_label_create(card);
  lv_obj_set_width(titulo, 280);
  lv_obj_set_style_text_font(titulo, &lv_font_montserrat_24, 0);
  lv_obj_set_style_text_align(titulo, LV_TEXT_ALIGN_CENTER, 0);

  detalhe = lv_label_create(card);
  lv_obj_set_width(detalhe, 280);
  lv_label_set_long_mode(detalhe, LV_LABEL_LONG_WRAP);
  lv_obj_set_style_text_font(detalhe, &lv_font_montserrat_16, 0);
  lv_obj_set_style_text_align(detalhe, LV_TEXT_ALIGN_CENTER, 0);

  progresso = lv_label_create(card);
  lv_obj_set_style_text_font(progresso, &lv_font_montserrat_18, 0);
}

void carregar() {
  garantirTela();
  currentScreen = "revisao_rfid";
  lv_scr_load(scr);
  if (btn_exit) lv_obj_add_flag(btn_exit, LV_OBJ_FLAG_HIDDEN);
}

void cor(lv_color_t c) {
  lv_obj_set_style_text_color(titulo, c, 0);
}
}

void revisaoUI_pronto(const String& codigo, const String& nome, int revisadas, int total) {
  carregar();
  lv_label_set_text(titulo, "PRONTO PARA REVISAO");
  cor(lv_palette_main(LV_PALETTE_BLUE));
  String texto = "Artigo: " + codigo + "\n" + nome + "\n\nAguardando peca no arco";
  lv_label_set_text(detalhe, texto.c_str());
  lv_label_set_text_fmt(progresso, "%d / %d revisadas", revisadas, total);
}

void revisaoUI_lendo() {
  carregar();
  lv_label_set_text(titulo, "LENDO PECA...");
  cor(lv_palette_main(LV_PALETTE_YELLOW));
  lv_label_set_text(detalhe, "Mantenha a peca dentro do arco.\nO resultado sera mostrado somente\ndepois que ela sair.");
  lv_label_set_text(progresso, "Etiquetas detectadas: 0");
}

void revisaoUI_atualizarLeitura(int n) {
  if (progresso) lv_label_set_text_fmt(progresso, "Etiquetas detectadas: %d", n);
}

void revisaoUI_validando(const char* msg) {
  carregar();
  lv_label_set_text(titulo, "VALIDANDO...");
  cor(lv_palette_main(LV_PALETTE_YELLOW));
  lv_label_set_text(detalhe, msg ? msg : "Consultando a API...");
}

void revisaoUI_aprovada(int revisadas, int total) {
  carregar();
  lv_label_set_text(titulo, LV_SYMBOL_OK "  PECA APROVADA");
  cor(lv_palette_main(LV_PALETTE_GREEN));
  lv_label_set_text(detalhe, "Etiqueta valida.\nRevisao registrada com sucesso.");
  lv_label_set_text_fmt(progresso, "%d / %d revisadas", revisadas, total);
}

void revisaoUI_reprovada(const String& motivo) {
  carregar();
  lv_label_set_text(titulo, LV_SYMBOL_CLOSE "  PECA REPROVADA");
  cor(lv_palette_main(LV_PALETTE_RED));
  lv_label_set_text(detalhe, motivo.c_str());
  lv_label_set_text(progresso, "Aguardando proxima peca");
}

void revisaoUI_semEtiqueta() {
  carregar();
  lv_label_set_text(titulo, "SEM ETIQUETA");
  cor(lv_palette_main(LV_PALETTE_RED));
  lv_label_set_text(detalhe, "Nenhuma etiqueta RFID foi\ndetectada nesta peca.");
  lv_label_set_text(progresso, "0 etiquetas");
}

void revisaoUI_multiplas(int n) {
  carregar();
  lv_label_set_text(titulo, "MULTIPLAS ETIQUETAS");
  cor(lv_palette_main(LV_PALETTE_RED));
  lv_label_set_text_fmt(detalhe, "Foram detectadas %d etiquetas\nRFID diferentes na mesma peca.", n);
  lv_label_set_text(progresso, "Peca reprovada");
}

void revisaoUI_semConexao() {
  carregar();
  lv_label_set_text(titulo, "ERRO DE CONEXAO");
  cor(lv_palette_main(LV_PALETTE_RED));
  lv_label_set_text(detalhe, "Nao foi possivel validar a etiqueta\ncom a API. A peca nao foi aprovada.");
  lv_label_set_text(progresso, "Verifique a internet");
}

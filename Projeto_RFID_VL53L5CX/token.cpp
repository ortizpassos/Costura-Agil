#include "font/lv_font.h"
#include "token.h"

extern const char* deviceToken;

lv_obj_t * scr_token = nullptr;

void go_token() {
    if (!scr_token) {
        scr_token = new_screen(NULL, true); // degrade de fundo
        lv_scr_load(scr_token);
        lv_obj_set_size(scr_token, 320, 240);
        lv_obj_set_scroll_dir(scr_token, LV_DIR_NONE);

        // CARD PRINCIPAL
        lv_obj_t * card = lv_obj_create(scr_token);
        lv_obj_set_size(card, lv_pct(98), lv_pct(98));
        lv_obj_center(card);
        lv_obj_set_style_radius(card, 16, 0);
        lv_obj_set_style_pad_all(card, 10, 0);
        lv_obj_set_style_pad_row(card, 5, 0);
        lv_obj_set_style_bg_opa(card, LV_OPA_20, 0);
        lv_obj_set_style_bg_color(card, lv_color_hex(0xFFFFFF), 0);
        lv_obj_set_flex_flow(card, LV_FLEX_FLOW_COLUMN);
        lv_obj_set_flex_align(card,
            LV_FLEX_ALIGN_CENTER,
            LV_FLEX_ALIGN_CENTER,
            LV_FLEX_ALIGN_CENTER
        );

        // Título
        lv_obj_t * lbl_titulo = lv_label_create(card);
        lv_obj_set_style_text_font(lbl_titulo, &lv_font_montserrat_34, 0);
        lv_label_set_text(lbl_titulo, "Costura Agil");
        lv_obj_set_style_text_align(lbl_titulo, LV_TEXT_ALIGN_CENTER, 0);
        lv_obj_set_width(lbl_titulo, lv_pct(90));
        lv_label_set_long_mode(lbl_titulo, LV_LABEL_LONG_WRAP);

        // Subtítulo (Token)
        lv_obj_t * lbl_token_prefix = lv_label_create(card);
        lv_obj_set_style_text_font(lbl_token_prefix, &lv_font_montserrat_22, 0);
        lv_label_set_text(lbl_token_prefix, "Seu Token:");
        lv_obj_set_style_text_align(lbl_token_prefix, LV_TEXT_ALIGN_CENTER, 0);
        lv_obj_set_width(lbl_token_prefix, lv_pct(90));
        lv_label_set_long_mode(lbl_token_prefix, LV_LABEL_LONG_WRAP);
        lv_obj_set_style_pad_top(lbl_token_prefix, 6, 0);

        lv_obj_t * lbl_token_value = lv_label_create(card);
        lv_obj_set_style_text_font(lbl_token_value, &lv_font_montserrat_20, 0);
        lv_label_set_text(lbl_token_value, deviceToken);
        lv_obj_set_style_text_color(lbl_token_value, lv_color_hex(0x008000), 0); // verde
        lv_obj_set_style_text_align(lbl_token_value, LV_TEXT_ALIGN_CENTER, 0);
        lv_obj_set_width(lbl_token_value, lv_pct(90));
        lv_label_set_long_mode(lbl_token_value, LV_LABEL_LONG_WRAP);
        lv_obj_set_style_pad_bottom(lbl_token_value, 6, 0);

        // Instruções
        lv_obj_t * lbl_instr = lv_label_create(card);
        lv_obj_set_style_text_font(lbl_instr, &lv_font_montserrat_12, 0);
        lv_label_set_text(lbl_instr,
            "1. Acesse o sistema web, va ate a pagina de dispositivos \n"
            "2. cadastre este token para vincular o dispositivo a sua conta \n"
            "3. Se precisar de ajuda, peca ao suporte!");
        lv_obj_set_style_text_align(lbl_instr, LV_TEXT_ALIGN_LEFT, 0);
        lv_obj_set_style_pad_top(lbl_instr, 5, 0);
        lv_obj_set_width(lbl_instr, lv_pct(90));
        lv_label_set_long_mode(lbl_instr, LV_LABEL_LONG_WRAP);
    }
    lv_screen_load(scr_token);
    lv_obj_add_flag(btn_exit, LV_OBJ_FLAG_HIDDEN);
}

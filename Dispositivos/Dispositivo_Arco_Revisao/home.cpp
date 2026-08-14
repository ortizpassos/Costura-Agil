#include "home.h"

lv_obj_t * scr_home = nullptr;

void go_home() {
    if (!scr_home) {
        scr_home = new_screen(NULL, true); // degrade de fundo
        lv_scr_load(scr_home);
        lv_obj_set_size(scr_home, 320, 240);
        lv_obj_set_scroll_dir(scr_home, LV_DIR_NONE);   

        // CARD PRINCIPAL
        lv_obj_t * card = lv_obj_create(scr_home);
        lv_obj_set_size(card, lv_pct(98), lv_pct(98));
        lv_obj_center(card);
        lv_obj_set_style_radius(card, 16, 0);
        lv_obj_set_style_pad_all(card, 8, 0);
        lv_obj_set_style_pad_row(card, 8, 0);
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
        lv_obj_set_style_text_font(lbl_titulo, &lv_font_montserrat_30, 0);
        lv_label_set_text(lbl_titulo, "Costura Agil");
        lv_obj_set_style_text_align(lbl_titulo, LV_TEXT_ALIGN_CENTER, 0);
        lv_obj_set_width(lbl_titulo, lv_pct(90));
        lv_label_set_long_mode(lbl_titulo, LV_LABEL_LONG_WRAP);

        // Subtítulo
        lv_obj_t * lbl_sub = lv_label_create(card);
        lv_obj_set_style_text_font(lbl_sub, &lv_font_montserrat_14, 0);
        lv_label_set_text(lbl_sub, "Vamos conectar seu dispositivo e aumentar sua produtividade!");
        lv_obj_set_style_text_align(lbl_sub, LV_TEXT_ALIGN_CENTER, 0);
        
        lv_obj_set_width(lbl_sub, lv_pct(90));
        lv_label_set_long_mode(lbl_sub, LV_LABEL_LONG_WRAP);

        // Instruções
        lv_obj_t * lbl_instr = lv_label_create(card);
        lv_obj_set_style_text_font(lbl_instr, &lv_font_montserrat_12, 0);
        lv_label_set_text(lbl_instr,
            "1. No seu celular ou computador, abra as configuracoes de Wi-Fi.\n"
            "2. Procure e conecte-se a rede: Costura Agil\n"
            "3. Apos conectar, volte ao aplicativo para continuar.\n"
            "\nSe precisar de ajuda, peca ao suporte!");
        lv_obj_set_style_text_align(lbl_instr, LV_TEXT_ALIGN_LEFT, 0);
        
        lv_obj_set_width(lbl_instr, lv_pct(90));
        lv_label_set_long_mode(lbl_instr, LV_LABEL_LONG_WRAP);
    }
    lv_screen_load(scr_home);
    lv_obj_add_flag(btn_exit, LV_OBJ_FLAG_HIDDEN);
}

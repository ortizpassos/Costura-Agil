
#include "dashboard.h"

lv_obj_t * scr_dashboard = nullptr;
lv_obj_t * lbl_titulo = nullptr;
lv_obj_t * lbl_func = nullptr;
lv_obj_t * barra = nullptr;
lv_obj_t * lbl_valor = nullptr;
lv_obj_t * lbl_percent = nullptr;

void update_dashboard(const char* operacao, const char* funcionario, int meta, int qtd) {
    if (lbl_titulo) lv_label_set_text_fmt(lbl_titulo, "Operacao: %s", operacao);
    if (lbl_func) lv_label_set_text_fmt(lbl_func, "Funcionario: %s", funcionario);
    
    if (barra) {
        lv_bar_set_range(barra, 0, meta);
        lv_bar_set_value(barra, qtd, LV_ANIM_ON);
    }
    
    if (lbl_valor) lv_label_set_text_fmt(lbl_valor, "%d/%d", qtd, meta);
    
    if (lbl_percent && meta > 0) {
        int pct = (qtd * 100) / meta;
        lv_label_set_text_fmt(lbl_percent, "%d%%", pct);
    }
}

void go_dashboard() {
    if(!scr_dashboard) {
        scr_dashboard = new_screen(NULL, true);
        lv_scr_load(scr_dashboard);
        lv_obj_set_size(scr_dashboard, 320, 240);
        lv_obj_set_scroll_dir(scr_dashboard, LV_DIR_NONE);        
        // CARD PRINCIPAL
        lv_obj_t * card = lv_obj_create(scr_dashboard);
        lv_obj_set_size(card, lv_pct(98), lv_pct(98));
        lv_obj_center(card);
        lv_obj_set_style_radius(card, 16, 0);
        lv_obj_set_style_pad_all(card, 6, 0);
        lv_obj_set_style_pad_row(card, 9, 0);
        lv_obj_set_style_bg_opa(card, LV_OPA_20, 0);
        lv_obj_set_style_bg_color(card, lv_color_hex(0xFFFFFF), 0);
        lv_obj_set_flex_flow(card, LV_FLEX_FLOW_COLUMN);
        lv_obj_set_flex_align(card,
            LV_FLEX_ALIGN_START,
            LV_FLEX_ALIGN_CENTER,
            LV_FLEX_ALIGN_CENTER
        );
        // TÍTULO
        lbl_titulo = lv_label_create(card);
        lv_obj_set_style_text_font(lbl_titulo, &lv_font_montserrat_20, 0);
        lv_label_set_text(lbl_titulo, "Carregando...");

        // SUBTÍTULO
        lbl_func = lv_label_create(card);
        lv_obj_set_style_text_font(lbl_func, &lv_font_montserrat_16, 0);
        lv_label_set_text(lbl_func, "Funcionario: ...");

        // BARRA DE PROGRESSO
        barra = lv_bar_create(card);
        lv_obj_set_size(barra, lv_pct(100), 15);
        lv_bar_set_range(barra, 0, 100);
        lv_bar_set_value(barra, 0, LV_ANIM_OFF);

        lv_obj_set_style_bg_color(barra, lv_color_hex(0x008000), LV_PART_INDICATOR);
        //lv_obj_set_style_bg_grad_color(barra, lv_color_hex(0x008000), LV_PART_INDICATOR);
        //lv_obj_set_style_bg_grad_dir(barra, LV_GRAD_DIR_HOR, LV_PART_INDICATOR);
        lv_obj_set_style_radius(barra, 999, 0);
        lv_obj_set_style_radius(barra, 999, LV_PART_INDICATOR);

        // Linha com valores
        lv_obj_t * linha = lv_obj_create(card);
        lv_obj_remove_style_all(linha);
        lv_obj_set_size(linha, lv_pct(100), LV_SIZE_CONTENT);

        lv_obj_set_flex_flow(linha, LV_FLEX_FLOW_ROW);
        lv_obj_set_flex_align(linha,
            LV_FLEX_ALIGN_SPACE_BETWEEN,
            LV_FLEX_ALIGN_CENTER,
            LV_FLEX_ALIGN_CENTER
        );

        lbl_valor = lv_label_create(linha);
        lv_label_set_text(lbl_valor, "0/0");

        lbl_percent = lv_label_create(linha);
        lv_label_set_text(lbl_percent, "0%");

        // BOTÃO PAUSAR
        lv_obj_t * btn_pausar = lv_button_create(card);
        lv_obj_set_width(btn_pausar, lv_pct(100));
        lv_obj_set_style_radius(btn_pausar, 10, 0);
        lv_obj_set_style_bg_color(btn_pausar, lv_palette_main(LV_PALETTE_YELLOW), 0);      
        lv_obj_set_style_pad_all(btn_pausar, 8, 0);   
        

        lv_obj_t * lbl_pausar = lv_label_create(btn_pausar);
        lv_label_set_text(lbl_pausar, LV_SYMBOL_PAUSE "  Pausar");
        lv_obj_center(lbl_pausar);
        lv_obj_add_event_cb(btn_pausar, [](lv_event_t * e) -> void {
        
        }, LV_EVENT_CLICKED, NULL);    
       

        // LINHA DOS BOTÕES
        lv_obj_t * linha_btn = lv_obj_create(card);
        lv_obj_remove_style_all(linha_btn);
        lv_obj_set_size(linha_btn, lv_pct(100), LV_SIZE_CONTENT);
        lv_obj_set_flex_flow(linha_btn, LV_FLEX_FLOW_ROW);

        lv_obj_set_style_pad_column(linha_btn, 10, 0);
        lv_obj_set_style_pad_top(linha_btn, 2, 0);
        lv_obj_set_style_pad_bottom(linha_btn, 2, 0);

        lv_obj_set_flex_align(linha_btn,
            LV_FLEX_ALIGN_SPACE_BETWEEN,
            LV_FLEX_ALIGN_CENTER,
            LV_FLEX_ALIGN_CENTER
        );

        // BOTÃO FINALIZAR
        lv_obj_t * btn_final = lv_btn_create(linha_btn);
        lv_obj_set_width(btn_final, lv_pct(48));
        lv_obj_set_style_radius(btn_final, 10, 0);
        lv_obj_set_style_pad_all(btn_final, 8, 0);
        lv_obj_set_style_bg_color(btn_final, lv_palette_main(LV_PALETTE_GREEN), 0);

        lv_obj_t * lbl_final = lv_label_create(btn_final);
        lv_label_set_text(lbl_final, LV_SYMBOL_OK "  Finalizar");
        lv_obj_center(lbl_final);

        // BOTÃO CONFIG
        lv_obj_t * btn_cfg = lv_btn_create(linha_btn);
        lv_obj_set_width(btn_cfg, lv_pct(48));
        lv_obj_set_style_radius(btn_cfg, 10, 0);
        lv_obj_set_style_pad_all(btn_cfg, 8, 0);
        lv_obj_t * lbl_cfg = lv_label_create(btn_cfg);
        lv_label_set_text(lbl_cfg, LV_SYMBOL_SETTINGS "  Config.");
        lv_obj_center(lbl_cfg);
        lv_obj_add_event_cb(btn_cfg, [](lv_event_t * e) -> void {
        //go_touch();
        }, LV_EVENT_CLICKED, NULL);    

        // RODAPÉ
        lv_obj_t * footer = lv_obj_create(card);
        lv_obj_remove_style_all(footer);
        lv_obj_set_size(footer, lv_pct(100), LV_SIZE_CONTENT);
        lv_obj_set_flex_flow(footer, LV_FLEX_FLOW_ROW);
        lv_obj_set_flex_align(footer,
            LV_FLEX_ALIGN_SPACE_BETWEEN,
            LV_FLEX_ALIGN_CENTER,
            LV_FLEX_ALIGN_CENTER
        );

        lv_obj_t * lbl_hora = lv_label_create(footer);
        lv_label_set_text(lbl_hora, "14:35");

        lv_obj_t * lbl_timer = lv_label_create(footer);
        lv_label_set_text(lbl_timer, "1:45:23");
    }
    lv_scr_load(scr_dashboard); 
    lv_obj_add_flag(btn_exit, LV_OBJ_FLAG_HIDDEN);    // desabilita saída, já na tela principal
    
}


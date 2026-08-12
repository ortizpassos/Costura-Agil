#include "font/lv_font.h"
#include "misc/lv_event.h"
#include "core/lv_obj_event.h"
#include "widgets/textarea/lv_textarea.h"
#include "login.h"

lv_obj_t * scr_login = nullptr;
lv_obj_t * error_label = nullptr;
lv_obj_t * ta = nullptr;

// Função para exibir erro na tela de login (chamada pelo backend via Tela.ino)
extern "C" void show_login_error(const char* msg) {
    if (error_label && msg) {
        lv_label_set_text(error_label, msg);
        if (ta) lv_textarea_set_text(ta, "");
    }
}

// Função definida em Tela.ino para enviar login via WebSocket
extern void loginFuncionario(const char* senha);

static void textarea_event_handler(lv_event_t * e){
    lv_obj_t * ta_evt = lv_event_get_target_obj(e);
    const char *text = lv_textarea_get_text(ta_evt);
    if (text && strlen(text) > 0) {
        if (error_label) lv_label_set_text(error_label, "");
        loginFuncionario(text);
    } else {
        if (error_label) lv_label_set_text(error_label, "Digite a senha!");
    }
}

static void btnm_event_handler(lv_event_t * e)
{
    lv_obj_t * obj = lv_event_get_target_obj(e);
    lv_obj_t * ta_evt = (lv_obj_t *)lv_event_get_user_data(e);
    const char * txt = lv_buttonmatrix_get_button_text(obj, lv_buttonmatrix_get_selected_button(obj));

    // Se houver mensagem de erro, limpe ao digitar qualquer número
    if (error_label && strlen(txt) == 1 && txt[0] >= '0' && txt[0] <= '9') {
        lv_label_set_text(error_label, "");
        if (strcmp(lv_textarea_get_text(ta_evt), "") == 0) {
            lv_textarea_set_text(ta_evt, "");
        }
    }

    if(lv_strcmp(txt, LV_SYMBOL_BACKSPACE) == 0) lv_textarea_delete_char(ta_evt);
    else if(lv_strcmp(txt, LV_SYMBOL_PLAY) == 0) lv_obj_send_event(ta_evt, LV_EVENT_READY, NULL);
    else lv_textarea_add_text(ta_evt, txt);
}
void go_login() {
    if (!scr_login) {
        scr_login = new_screen(NULL, true);
        lv_scr_load(scr_login);
        lv_obj_set_size(scr_login, 320, 240);     
        lv_obj_set_scroll_dir(scr_login, LV_DIR_NONE); 

        // Adiciona o card da dashboard na tela de login
        lv_obj_t * card = lv_obj_create(scr_login);
        lv_obj_set_size(card, lv_pct(98), lv_pct(98));
        lv_obj_center(card);
        lv_obj_set_style_radius(card, 16, 0);
        lv_obj_set_style_pad_all(card, 4, 0);
        lv_obj_set_style_pad_row(card, 2, 0);
        lv_obj_set_style_bg_opa(card, LV_OPA_20, 0);
        lv_obj_set_style_bg_color(card, lv_color_hex(0xFFFFFF), 0);
        lv_obj_set_flex_flow(card, LV_FLEX_FLOW_COLUMN);
        lv_obj_set_flex_align(card,
            LV_FLEX_ALIGN_START,
            LV_FLEX_ALIGN_CENTER,
            LV_FLEX_ALIGN_CENTER
        );

         // TÍTULO
        lv_obj_t * lbl_titulo = lv_label_create(card);
        lv_obj_set_style_text_font(lbl_titulo, &lv_font_montserrat_20, 0);
        lv_label_set_text(lbl_titulo, "Login Colaborador");

        ta = lv_textarea_create(card);
        lv_obj_set_size(ta, 200, 10);
        lv_textarea_set_one_line(ta, true);
        lv_obj_align(ta, LV_ALIGN_TOP_MID, 0, 10);        
        lv_obj_add_event_cb(ta, textarea_event_handler, LV_EVENT_READY, ta);
        lv_obj_add_state(ta, LV_STATE_FOCUSED);
        lv_obj_set_style_bg_color(ta, lv_color_hex(0x1A3D6B), 0);
        lv_obj_set_style_bg_grad_color(ta, lv_color_hex(0xEA824D), 0);
        lv_obj_set_style_bg_grad_dir(ta, LV_GRAD_DIR_VER, 0);

        // Label de erro
        error_label = lv_label_create(ta);
        lv_label_set_text(error_label, "");
        lv_obj_set_style_text_font(error_label, &lv_font_montserrat_14, 0);
        lv_obj_set_style_text_color(error_label, lv_color_hex(0xFF0000), 0);
   

        static const char * btnm_map[] = {"1", "2", "3", "\n",
                                          "4", "5", "6", "\n",
                                          "7", "8", "9", "\n",
                                          LV_SYMBOL_BACKSPACE, "0", LV_SYMBOL_PLAY, ""
                                         };

        lv_obj_t * btnm = lv_buttonmatrix_create(card);
        lv_obj_set_size(btnm, 200, 150);
        lv_obj_align(btnm, LV_ALIGN_BOTTOM_MID, 0, -10);
        lv_obj_add_event_cb(btnm, btnm_event_handler, LV_EVENT_VALUE_CHANGED, ta);
        lv_obj_remove_flag(btnm, LV_OBJ_FLAG_CLICK_FOCUSABLE);
        lv_buttonmatrix_set_map(btnm, btnm_map);  
        lv_obj_set_style_bg_color(btnm, lv_color_hex(0x1A3D6B), 0);
        lv_obj_set_style_bg_grad_color(btnm, lv_color_hex(0xEA824D), 0);
        lv_obj_set_style_bg_grad_dir(btnm, LV_GRAD_DIR_VER, 0);
    }
    lv_screen_load(scr_login);
    lv_obj_add_flag(btn_exit, LV_OBJ_FLAG_HIDDEN);
}


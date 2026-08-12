#include "artigo.h"
#include "font/lv_font.h"
#include <cstring>
#include <map>


extern void enviarSelecaoArtigo(const char* id);
extern String currentScreen; // Variável global para rastrear tela atual


lv_obj_t * scr_artigo = nullptr;
lv_obj_t * list_artigos = nullptr;

// Mapa para armazenar quantidades de cada artigo em tempo real
std::map<String, int> artigoQuantidades;

static void event_handler_btn(lv_event_t * e) {
    lv_event_code_t code = lv_event_get_code(e);
    char * id = (char *)lv_event_get_user_data(e);
    
    if(code == LV_EVENT_CLICKED) {
        if (id) {
            enviarSelecaoArtigo(id);
        }
    }
    else if(code == LV_EVENT_DELETE) {
        if (id) {
            free(id);
        }
    }
}

void go_artigo() {
    currentScreen = "artigo"; // Marca que estamos na tela de artigo
    if (!scr_artigo) {
        scr_artigo = new_screen(NULL, true);
        
        lv_obj_t * lbl_titulo = lv_label_create(scr_artigo);
        lv_obj_set_style_text_font(lbl_titulo, &lv_font_montserrat_26, 0);
        lv_label_set_text(lbl_titulo, "Selecione o Artigo");
        lv_obj_align(lbl_titulo, LV_ALIGN_TOP_MID, 0, 10);
        lv_obj_set_style_text_color(lbl_titulo, lv_color_white(), 0);

        list_artigos = lv_list_create(scr_artigo);
        lv_obj_set_size(list_artigos, 280, 170);
        lv_obj_align(list_artigos, LV_ALIGN_BOTTOM_MID, 0, -10);
        lv_obj_set_style_bg_color(list_artigos, lv_color_white(), 0);
    }
    lv_scr_load(scr_artigo);   
    lv_obj_add_flag(btn_exit, LV_OBJ_FLAG_HIDDEN);
}


void clear_artigo_list() {
    if (list_artigos) {
        lv_obj_clean(list_artigos);
    }
}

void add_artigo_to_list(const char* id, const char* nome, int meta) {
    if (!list_artigos) return;
    
    String id_str(id);
    int quantidade = artigoQuantidades[id_str]; // Pega quantidade armazenada ou 0
    
    // Formata com quantidade em tempo real (como na dashboard)
    String labelText = String(nome) + " • " + String(quantidade) + "/" + String(meta);
    lv_obj_t * btn = lv_list_add_btn(list_artigos, NULL, labelText.c_str());
    
    char * id_copy = strdup(id);
    lv_obj_add_event_cb(btn, event_handler_btn, LV_EVENT_ALL, id_copy);
    
    // Armazenar a meta para futuras atualizações
    artigoQuantidades[id_str] = quantidade; // Manter quantidade já registrada
}

void show_artigo_message(const char* mensagem) {
    if (!list_artigos) return;
    const char * texto = mensagem && strlen(mensagem) > 0 ? mensagem : "Carregando artigos...";
    lv_list_add_text(list_artigos, texto);
}

// Atualiza a lista com quantidades atualizadas (tempo real como na dashboard)
void update_artigo_quantities(const char* artigoId, int quantidadeAtual, int meta) {
    if (!list_artigos) return;
    
    String id(artigoId);
    artigoQuantidades[id] = quantidadeAtual;
    
    // Atualizar visual da lista (re-renderizar)
    // Próxima vez que a lista for atualizada, usará as novas quantidades
    int percentual = (meta > 0) ? (quantidadeAtual * 100) / meta : 0;
    Serial.printf("📊 Atualização em tempo real: Artigo %s → %d/%d (%d%%)\n", artigoId, quantidadeAtual, meta, percentual);
}

// Atualiza artigo específico na lista com barra de progresso
void update_artigo_item(const char* artigoId, const char* nome, int quantidadeAtual, int meta) {
    if (!list_artigos) return;
    
    String id(artigoId);
    artigoQuantidades[id] = quantidadeAtual;
    
    // Limpar e reconstruir a lista com dados atualizados
    clear_artigo_list();
    
    // Re-adicionar todos os artigos com quantidades atualizadas
    // Esta função seria chamada quando dados forem atualizados
    Serial.printf("🔄 Atualização de artigo: %s (%d/%d)\n", nome, quantidadeAtual, meta);
}

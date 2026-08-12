#include "config.h"
#include "dashboard.h"   // para go_dashboard
#include "home.h"        // para new_screen
#include <Arduino.h>
#include <WiFi.h>

extern String currentScreen;
extern void resetWiFiConfig();

lv_obj_t * scr_config = nullptr;
lv_obj_t * lbl_wifi_ssid = nullptr;
lv_obj_t * lbl_wifi_ip = nullptr;
lv_obj_t * lbl_backend_url = nullptr;
lv_obj_t * lbl_connection_status = nullptr;
lv_obj_t * lbl_device_token = nullptr;
lv_obj_t * lbl_uptime = nullptr;

void update_config_info(const char* wifi, const char* ip, const char* backend, bool connected) {
    if (lbl_wifi_ssid) lv_label_set_text_fmt(lbl_wifi_ssid, "WiFi: %s", wifi);
    if (lbl_wifi_ip) lv_label_set_text_fmt(lbl_wifi_ip, "IP: %s", ip);
    if (lbl_backend_url) lv_label_set_text_fmt(lbl_backend_url, "Backend: %s", backend);
    if (lbl_connection_status) {
        lv_label_set_text_fmt(lbl_connection_status, "Status: %s", connected ? "✓ Conectado" : "✗ Desconectado");
        lv_obj_set_style_text_color(lbl_connection_status, 
            connected ? lv_palette_main(LV_PALETTE_GREEN) : lv_palette_main(LV_PALETTE_RED), 0);
    }
}

void go_config() {
    currentScreen = "config";
    
    if (!scr_config) {
        scr_config = new_screen(NULL, true);
        lv_scr_load(scr_config);
        lv_obj_set_size(scr_config, 320, 240);
        lv_obj_set_scroll_dir(scr_config, LV_DIR_VER);
        
        // CARD PRINCIPAL
        lv_obj_t * card = lv_obj_create(scr_config);
        lv_obj_set_size(card, lv_pct(98), LV_SIZE_CONTENT);
        lv_obj_align(card, LV_ALIGN_TOP_MID, 0, 5);
        lv_obj_set_style_radius(card, 16, 0);
        lv_obj_set_style_pad_all(card, 12, 0);
        lv_obj_set_style_pad_row(card, 8, 0);
        lv_obj_set_style_bg_opa(card, LV_OPA_20, 0);
        lv_obj_set_style_bg_color(card, lv_color_hex(0xFFFFFF), 0);
        lv_obj_set_flex_flow(card, LV_FLEX_FLOW_COLUMN);
        lv_obj_set_flex_align(card, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
        
        // TÍTULO
        lv_obj_t * lbl_titulo = lv_label_create(card);
        lv_obj_set_style_text_font(lbl_titulo, &lv_font_montserrat_20, 0);
        lv_label_set_text(lbl_titulo, LV_SYMBOL_SETTINGS " Configurações");
        
        // SEPARADOR
        lv_obj_t * linha1 = lv_obj_create(card);
        lv_obj_set_size(linha1, lv_pct(100), 2);
        lv_obj_set_style_bg_color(linha1, lv_palette_main(LV_PALETTE_GREY), 0);
        lv_obj_set_style_bg_opa(linha1, LV_OPA_50, 0);
        lv_obj_set_style_border_width(linha1, 0, 0);
        
        // INFORMAÇÕES DO DISPOSITIVO
        lbl_device_token = lv_label_create(card);
        lv_obj_set_style_text_font(lbl_device_token, &lv_font_montserrat_14, 0);
        lv_label_set_text(lbl_device_token, "Token: -");
        lv_obj_set_width(lbl_device_token, lv_pct(100));
        
        // INFORMAÇÕES DE REDE
        lbl_wifi_ssid = lv_label_create(card);
        lv_obj_set_style_text_font(lbl_wifi_ssid, &lv_font_montserrat_14, 0);
        lv_label_set_text(lbl_wifi_ssid, "WiFi: -");
        lv_obj_set_width(lbl_wifi_ssid, lv_pct(100));
        
        lbl_wifi_ip = lv_label_create(card);
        lv_obj_set_style_text_font(lbl_wifi_ip, &lv_font_montserrat_14, 0);
        lv_label_set_text(lbl_wifi_ip, "IP: -");
        lv_obj_set_width(lbl_wifi_ip, lv_pct(100));
        
        lbl_backend_url = lv_label_create(card);
        lv_obj_set_style_text_font(lbl_backend_url, &lv_font_montserrat_14, 0);
        lv_label_set_text(lbl_backend_url, "Backend: ");
        lv_obj_set_width(lbl_backend_url, lv_pct(100));
        
        lbl_connection_status = lv_label_create(card);
        lv_obj_set_style_text_font(lbl_connection_status, &lv_font_montserrat_14, 0);
        lv_label_set_text(lbl_connection_status, "Status:");
        lv_obj_set_width(lbl_connection_status, lv_pct(100));
        
        // SEPARADOR
        lv_obj_t * linha2 = lv_obj_create(card);
        lv_obj_set_size(linha2, lv_pct(100), 2);
        lv_obj_set_style_bg_color(linha2, lv_palette_main(LV_PALETTE_GREY), 0);
        lv_obj_set_style_bg_opa(linha2, LV_OPA_50, 0);
        lv_obj_set_style_border_width(linha2, 0, 0);
        
        // UPTIME
        lbl_uptime = lv_label_create(card);
        lv_obj_set_style_text_font(lbl_uptime, &lv_font_montserrat_14, 0);
        lv_label_set_text(lbl_uptime, "Tempo ativo: -");
        lv_obj_set_width(lbl_uptime, lv_pct(100));
        
        // BOTÕES DE AÇÃO
        lv_obj_t * btn_reconfig_wifi = lv_btn_create(card);
        lv_obj_set_width(btn_reconfig_wifi, lv_pct(100));
        lv_obj_set_style_radius(btn_reconfig_wifi, 10, 0);
        lv_obj_set_style_bg_color(btn_reconfig_wifi, lv_palette_main(LV_PALETTE_BLUE), 0);
        lv_obj_set_style_pad_all(btn_reconfig_wifi, 10, 0);
        
        lv_obj_t * lbl_reconfig = lv_label_create(btn_reconfig_wifi);
        lv_label_set_text(lbl_reconfig, LV_SYMBOL_WIFI " Reconfigurar WiFi");
        lv_obj_center(lbl_reconfig);
        
        lv_obj_add_event_cb(btn_reconfig_wifi, [](lv_event_t * e) -> void {
            resetWiFiConfig();
        }, LV_EVENT_CLICKED, NULL);
        
        // BOTÃO REINICIAR
        lv_obj_t * btn_restart = lv_btn_create(card);
        lv_obj_set_width(btn_restart, lv_pct(100));
        lv_obj_set_style_radius(btn_restart, 10, 0);
        lv_obj_set_style_bg_color(btn_restart, lv_palette_main(LV_PALETTE_ORANGE), 0);
        lv_obj_set_style_pad_all(btn_restart, 10, 0);
        
        lv_obj_t * lbl_restart = lv_label_create(btn_restart);
        lv_label_set_text(lbl_restart, LV_SYMBOL_REFRESH " Reiniciar Dispositivo");
        lv_obj_center(lbl_restart);
        
        lv_obj_add_event_cb(btn_restart, [](lv_event_t * e) -> void {
            ESP.restart();
        }, LV_EVENT_CLICKED, NULL);
        
        // BOTÃO VOLTAR
        lv_obj_t * btn_voltar = lv_btn_create(card);
        lv_obj_set_width(btn_voltar, lv_pct(100));
        lv_obj_set_style_radius(btn_voltar, 10, 0);
        lv_obj_set_style_bg_color(btn_voltar, lv_palette_main(LV_PALETTE_GREY), 0);
        lv_obj_set_style_pad_all(btn_voltar, 10, 0);
        
        lv_obj_t * lbl_voltar = lv_label_create(btn_voltar);
        lv_label_set_text(lbl_voltar, LV_SYMBOL_LEFT " Voltar");
        lv_obj_center(lbl_voltar);
        
        lv_obj_add_event_cb(btn_voltar, [](lv_event_t * e) -> void {
            go_dashboard();
        }, LV_EVENT_CLICKED, NULL);
    }
    
    lv_scr_load(scr_config);
}

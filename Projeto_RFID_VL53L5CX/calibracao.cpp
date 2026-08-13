#include "calibracao.h"
#include "home.h"
#include "IntegracaoSensorRFID.h"
#include <Arduino.h>

extern lv_obj_t * btn_exit;
extern String currentScreen;
extern bool calibracaoConcluida;
extern bool sensorToFInicializado;
extern void continuarFluxoAposCalibracao();

lv_obj_t * scr_calibracao = nullptr;
lv_obj_t * scr_calibracao_processo = nullptr;

static lv_obj_t * lbl_status_calibracao = nullptr;
static lv_obj_t * btn_calibrar = nullptr;
static lv_obj_t * lbl_btn_calibrar = nullptr;

static lv_obj_t * lbl_processo_titulo = nullptr;
static lv_obj_t * lbl_processo_status = nullptr;
static lv_obj_t * lbl_processo_percentual = nullptr;
static lv_obj_t * barra_progresso = nullptr;
static lv_obj_t * btn_processo_acao = nullptr;
static lv_obj_t * lbl_processo_acao = nullptr;
static lv_obj_t * icone_resultado = nullptr;

static bool calibrando = false;
static bool ultimoResultadoSucesso = false;

static void executar_calibracao();

void atualizar_calibracao_status(const char* mensagem, bool sucesso) {
    if (!lbl_status_calibracao) return;
    lv_label_set_text(lbl_status_calibracao, mensagem);
    lv_obj_set_style_text_color(
        lbl_status_calibracao,
        sucesso ? lv_palette_main(LV_PALETTE_GREEN) : lv_palette_main(LV_PALETTE_RED),
        0
    );
}

static void atualizar_progresso_calibracao(uint8_t percentual, const char* mensagem) {
    if (!scr_calibracao_processo) return;

    if (percentual > 100) percentual = 100;

    lv_bar_set_value(barra_progresso, percentual, LV_ANIM_ON);
    lv_label_set_text_fmt(lbl_processo_percentual, "%u%%", percentual);
    lv_label_set_text(lbl_processo_status, mensagem ? mensagem : "Calibrando...");

    // A calibração é bloqueante; força o LVGL a desenhar cada amostra real.
    lv_timer_handler();
}

static void mostrar_resultado(bool sucesso) {
    ultimoResultadoSucesso = sucesso;

    lv_obj_clear_flag(icone_resultado, LV_OBJ_FLAG_HIDDEN);
    lv_obj_clear_flag(btn_processo_acao, LV_OBJ_FLAG_HIDDEN);

    if (sucesso) {
        lv_label_set_text(icone_resultado, LV_SYMBOL_OK);
        lv_obj_set_style_text_color(icone_resultado, lv_palette_main(LV_PALETTE_GREEN), 0);
        lv_label_set_text(lbl_processo_titulo, "Calibracao concluida");
        lv_label_set_text(lbl_processo_status,
            "O arco vazio foi aprendido corretamente.\nO equipamento esta pronto para continuar.");
        lv_obj_set_style_text_color(lbl_processo_status, lv_palette_main(LV_PALETTE_GREEN), 0);
        lv_bar_set_value(barra_progresso, 100, LV_ANIM_OFF);
        lv_label_set_text(lbl_processo_percentual, "100%");
        lv_label_set_text(lbl_processo_acao, "CONTINUAR");
        lv_obj_set_style_bg_color(btn_processo_acao, lv_palette_main(LV_PALETTE_GREEN), 0);
    } else {
        lv_label_set_text(icone_resultado, LV_SYMBOL_CLOSE);
        lv_obj_set_style_text_color(icone_resultado, lv_palette_main(LV_PALETTE_RED), 0);
        lv_label_set_text(lbl_processo_titulo, "Falha na calibracao");
        lv_label_set_text(lbl_processo_status,
            "Nao foi possivel criar uma referencia valida.\nMantenha o arco vazio e tente novamente.");
        lv_obj_set_style_text_color(lbl_processo_status, lv_palette_main(LV_PALETTE_RED), 0);
        lv_label_set_text(lbl_processo_acao, LV_SYMBOL_REFRESH "  TENTAR NOVAMENTE");
        lv_obj_set_style_bg_color(btn_processo_acao, lv_palette_main(LV_PALETTE_RED), 0);
    }

    lv_timer_handler();
}

static void evento_acao_processo(lv_event_t * e) {
    (void)e;
    if (calibrando) return;

    if (ultimoResultadoSucesso) {
        continuarFluxoAposCalibracao();
    } else {
        executar_calibracao();
    }
}

static void preparar_tela_processo() {
    currentScreen = "calibracao_processo";

    if (!scr_calibracao_processo) {
        scr_calibracao_processo = new_screen(NULL, true);
        lv_obj_set_size(scr_calibracao_processo, 320, 240);
        lv_obj_set_scroll_dir(scr_calibracao_processo, LV_DIR_NONE);

        lv_obj_t * card = lv_obj_create(scr_calibracao_processo);
        lv_obj_set_size(card, lv_pct(96), lv_pct(96));
        lv_obj_center(card);
        lv_obj_set_style_radius(card, 16, 0);
        lv_obj_set_style_pad_all(card, 10, 0);
        lv_obj_set_style_pad_row(card, 7, 0);
        lv_obj_set_style_bg_opa(card, LV_OPA_20, 0);
        lv_obj_set_style_bg_color(card, lv_color_hex(0xFFFFFF), 0);
        lv_obj_set_flex_flow(card, LV_FLEX_FLOW_COLUMN);
        lv_obj_set_flex_align(card,
            LV_FLEX_ALIGN_CENTER,
            LV_FLEX_ALIGN_CENTER,
            LV_FLEX_ALIGN_CENTER);

        lbl_processo_titulo = lv_label_create(card);
        lv_obj_set_style_text_font(lbl_processo_titulo, &lv_font_montserrat_22, 0);
        lv_label_set_text(lbl_processo_titulo, "Calibrando sensor");
        lv_obj_set_style_text_align(lbl_processo_titulo, LV_TEXT_ALIGN_CENTER, 0);

        icone_resultado = lv_label_create(card);
        lv_obj_set_style_text_font(icone_resultado, &lv_font_montserrat_24, 0);
        lv_label_set_text(icone_resultado, LV_SYMBOL_REFRESH);
        lv_obj_add_flag(icone_resultado, LV_OBJ_FLAG_HIDDEN);

        lbl_processo_status = lv_label_create(card);
        lv_obj_set_width(lbl_processo_status, lv_pct(94));
        lv_label_set_long_mode(lbl_processo_status, LV_LABEL_LONG_WRAP);
        lv_obj_set_style_text_font(lbl_processo_status, &lv_font_montserrat_14, 0);
        lv_obj_set_style_text_align(lbl_processo_status, LV_TEXT_ALIGN_CENTER, 0);
        lv_label_set_text(lbl_processo_status, "Preparando calibracao...");

        barra_progresso = lv_bar_create(card);
        lv_obj_set_size(barra_progresso, lv_pct(86), 18);
        lv_bar_set_range(barra_progresso, 0, 100);
        lv_bar_set_value(barra_progresso, 0, LV_ANIM_OFF);

        lbl_processo_percentual = lv_label_create(card);
        lv_obj_set_style_text_font(lbl_processo_percentual, &lv_font_montserrat_14, 0);
        lv_label_set_text(lbl_processo_percentual, "0%");

        btn_processo_acao = lv_btn_create(card);
        lv_obj_set_width(btn_processo_acao, lv_pct(85));
        lv_obj_set_style_radius(btn_processo_acao, 10, 0);
        lv_obj_set_style_pad_all(btn_processo_acao, 10, 0);
        lv_obj_add_event_cb(btn_processo_acao, evento_acao_processo, LV_EVENT_CLICKED, NULL);
        lv_obj_add_flag(btn_processo_acao, LV_OBJ_FLAG_HIDDEN);

        lbl_processo_acao = lv_label_create(btn_processo_acao);
        lv_label_set_text(lbl_processo_acao, "CONTINUAR");
        lv_obj_center(lbl_processo_acao);
    }

    lv_label_set_text(lbl_processo_titulo, "Calibrando sensor");
    lv_label_set_text(lbl_processo_status,
        "Mantenha o arco VAZIO e PARADO\ndurante todo o processo.");
    lv_obj_set_style_text_color(lbl_processo_status, lv_color_hex(0xFFFFFF), 0);
    lv_bar_set_value(barra_progresso, 0, LV_ANIM_OFF);
    lv_label_set_text(lbl_processo_percentual, "0%");
    lv_obj_add_flag(icone_resultado, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(btn_processo_acao, LV_OBJ_FLAG_HIDDEN);

    lv_scr_load(scr_calibracao_processo);
    lv_obj_add_flag(btn_exit, LV_OBJ_FLAG_HIDDEN);
    lv_timer_handler();
}

static void executar_calibracao() {
    if (calibrando) return;

    if (!sensorToFInicializado) {
        mostrar_resultado(false);
        lv_label_set_text(lbl_processo_status,
            "Sensor VL53L5CX nao encontrado.\nVerifique SDA=27 e SCL=22.");
        return;
    }

    calibrando = true;
    calibracaoConcluida = false;
    ultimoResultadoSucesso = false;

    preparar_tela_processo();

    bool ok = IntegracaoSensorRFID::calibrarArcoVazio(atualizar_progresso_calibracao);

    calibracaoConcluida = ok;
    calibrando = false;
    mostrar_resultado(ok);
}

static void evento_calibrar(lv_event_t * e) {
    (void)e;
    if (calibrando) return;

    if (!sensorToFInicializado) {
        atualizar_calibracao_status(
            "Sensor VL53L5CX nao inicializado.\nVerifique SDA=27 e SCL=22.", false);
        return;
    }

    executar_calibracao();
}

void go_calibracao() {
    currentScreen = "calibracao";

    if (!scr_calibracao) {
        scr_calibracao = new_screen(NULL, true);
        lv_obj_set_size(scr_calibracao, 320, 240);
        lv_obj_set_scroll_dir(scr_calibracao, LV_DIR_NONE);

        lv_obj_t * card = lv_obj_create(scr_calibracao);
        lv_obj_set_size(card, lv_pct(96), lv_pct(96));
        lv_obj_center(card);
        lv_obj_set_style_radius(card, 16, 0);
        lv_obj_set_style_pad_all(card, 10, 0);
        lv_obj_set_style_pad_row(card, 8, 0);
        lv_obj_set_style_bg_opa(card, LV_OPA_20, 0);
        lv_obj_set_style_bg_color(card, lv_color_hex(0xFFFFFF), 0);
        lv_obj_set_flex_flow(card, LV_FLEX_FLOW_COLUMN);
        lv_obj_set_flex_align(card,
            LV_FLEX_ALIGN_CENTER,
            LV_FLEX_ALIGN_CENTER,
            LV_FLEX_ALIGN_CENTER);

        lv_obj_t * titulo = lv_label_create(card);
        lv_obj_set_style_text_font(titulo, &lv_font_montserrat_24, 0);
        lv_label_set_text(titulo, "Calibracao do Sensor");
        lv_obj_set_style_text_align(titulo, LV_TEXT_ALIGN_CENTER, 0);

        lv_obj_t * instrucao = lv_label_create(card);
        lv_obj_set_width(instrucao, lv_pct(92));
        lv_label_set_long_mode(instrucao, LV_LABEL_LONG_WRAP);
        lv_obj_set_style_text_font(instrucao, &lv_font_montserrat_14, 0);
        lv_obj_set_style_text_align(instrucao, LV_TEXT_ALIGN_CENTER, 0);
        lv_label_set_text(instrucao,
            "Deixe o arco vazio e parado.\n"
            "Pressione CALIBRAR para iniciar a leitura em tempo real.");

        lbl_status_calibracao = lv_label_create(card);
        lv_obj_set_width(lbl_status_calibracao, lv_pct(92));
        lv_label_set_long_mode(lbl_status_calibracao, LV_LABEL_LONG_WRAP);
        lv_obj_set_style_text_align(lbl_status_calibracao, LV_TEXT_ALIGN_CENTER, 0);
        lv_obj_set_style_text_font(lbl_status_calibracao, &lv_font_montserrat_12, 0);
        lv_label_set_text(lbl_status_calibracao, "Sensor pronto para calibracao.");

        btn_calibrar = lv_btn_create(card);
        lv_obj_set_width(btn_calibrar, lv_pct(85));
        lv_obj_set_style_radius(btn_calibrar, 10, 0);
        lv_obj_set_style_pad_all(btn_calibrar, 10, 0);
        lv_obj_set_style_bg_color(btn_calibrar, lv_palette_main(LV_PALETTE_GREEN), 0);
        lv_obj_add_event_cb(btn_calibrar, evento_calibrar, LV_EVENT_CLICKED, NULL);

        lbl_btn_calibrar = lv_label_create(btn_calibrar);
        lv_label_set_text(lbl_btn_calibrar, LV_SYMBOL_REFRESH "  CALIBRAR");
        lv_obj_center(lbl_btn_calibrar);
    }

    calibracaoConcluida = IntegracaoSensorRFID::estaCalibrado();

    if (calibracaoConcluida) {
        atualizar_calibracao_status("Sensor ja calibrado nesta inicializacao.", true);
    } else {
        lv_label_set_text(lbl_status_calibracao, "Sensor pronto para calibracao.");
        lv_obj_set_style_text_color(lbl_status_calibracao, lv_color_hex(0xFFFFFF), 0);
    }

    lv_label_set_text(lbl_btn_calibrar, LV_SYMBOL_REFRESH "  CALIBRAR");
    lv_obj_clear_state(btn_calibrar, LV_STATE_DISABLED);

    lv_scr_load(scr_calibracao);
    lv_obj_add_flag(btn_exit, LV_OBJ_FLAG_HIDDEN);
}

#include "ativacao.h"
#include "home.h"
#include "token.h"
#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <qrcode.h>

extern lv_obj_t * btn_exit;
extern String currentScreen;
extern String deviceToken;
extern const char* host;
extern uint16_t port;
extern bool useSSL;
extern bool wsConnected;
extern void registerDevice();

static float activationPrice = 1.00f; // valor real carregado do backend
static bool activationConfigLoaded = false;
static constexpr unsigned long STATUS_INTERVAL_MS = 3000;

static lv_obj_t* scr_ativacao = nullptr;
static lv_obj_t* scr_pix = nullptr;
static lv_obj_t* lbl_ativacao_status = nullptr;
static lv_obj_t* lbl_ativacao_valor = nullptr;
static lv_obj_t* btn_ativar = nullptr;
static lv_obj_t* lbl_pix_status = nullptr;
static lv_obj_t* lbl_pix_valor = nullptr;
static lv_obj_t* img_qr = nullptr;
static lv_image_dsc_t qrImageDsc = {};
static lv_obj_t* btn_pix_tentar = nullptr;

static String paymentId;
static String pixCode;
static String deviceId;
static bool aguardandoPagamento = false;
static bool criandoPagamento = false;
static unsigned long ultimoStatus = 0;
static Preferences activationPrefs;

#define QR_MAX_DISPLAY_SIZE 174
static uint16_t* qrCanvasBuf = nullptr;
static int qrBufferSide = 0;

static void freeQrBuffer() {
    if (qrCanvasBuf) {
        lv_free(qrCanvasBuf);
        qrCanvasBuf = nullptr;
    }
    qrBufferSide = 0;
}

static bool allocateQrBuffer(int side) {
    if (side <= 0) return false;

    if (qrCanvasBuf && qrBufferSide == side) return true;

    freeQrBuffer();

    const size_t bytes = (size_t)side * side * sizeof(uint16_t);
    Serial.printf("[PIX][QR] Tentando alocar bitmap %dx%d = %u bytes. Heap livre=%u, maior bloco=%u.\n",
                  side, side, (unsigned)bytes,
                  (unsigned)ESP.getFreeHeap(),
                  (unsigned)ESP.getMaxAllocHeap());

    qrCanvasBuf = static_cast<uint16_t*>(lv_malloc(bytes));
    if (!qrCanvasBuf) {
        Serial.printf("[PIX][QR] Sem memoria para bitmap %dx%d (%u bytes).\n",
                      side, side, (unsigned)bytes);
        return false;
    }

    qrBufferSide = side;
    Serial.printf("[PIX][QR] Bitmap alocado: %dx%d (%u bytes).\n",
                  side, side, (unsigned)bytes);
    return true;
}

static String backendBaseUrl() {
    // Porta 443 nao precisa aparecer explicitamente na URL HTTPS, mas mante-la
    // funciona e deixa a configuracao alinhada ao Socket.IO.
    return String(useSSL ? "https://" : "http://") + host + ":" + String(port);
}

static bool httpBeginBackend(HTTPClient& http, WiFiClientSecure& secureClient, const String& url) {
    if (useSSL) {
        // Mesmo servidor HTTPS do Socket.IO. setInsecure evita depender do bundle
        // de CAs do firmware; em uma versao futura pode ser substituido por setCACert.
        secureClient.setInsecure();
        return http.begin(secureClient, url);
    }
    return http.begin(url);
}

static void carregarConfiguracaoAtivacao() {
    if (WiFi.status() != WL_CONNECTED) return;

    HTTPClient http;
    WiFiClientSecure secureClient;
    String url = backendBaseUrl() + "/api/device/activation/config";
    if (!httpBeginBackend(http, secureClient, url)) {
        Serial.println("[ATIVACAO] Falha ao iniciar HTTPS para config.");
        return;
    }
    http.setTimeout(12000);
    int code = http.GET();
    String response = code > 0 ? http.getString() : "";
    http.end();

    if (code >= 200 && code < 300) {
        DynamicJsonDocument doc(512);
        if (!deserializeJson(doc, response)) {
            float amount = doc["amount"] | 0.0f;
            if (amount > 0.0f) {
                activationPrice = amount;
                activationConfigLoaded = true;
                if (lbl_ativacao_valor) lv_label_set_text_fmt(lbl_ativacao_valor, "R$ %.2f", activationPrice);
                Serial.printf("[ATIVACAO] Valor carregado do backend: R$ %.2f\n", activationPrice);
            }
        }
    } else {
        Serial.printf("[ATIVACAO] Config HTTP %d: %s\n", code, response.c_str());
    }
}

static String getDeviceId() {
    if (deviceId.length()) return deviceId;
    uint64_t chip = ESP.getEfuseMac();
    char id[20];
    snprintf(id, sizeof(id), "%04X%08X", (uint16_t)(chip >> 32), (uint32_t)chip);
    deviceId = String(id);
    deviceId.toUpperCase();
    return deviceId;
}

bool ativacao_token_salvo() {
    activationPrefs.begin("activation", true);
    String t = activationPrefs.getString("deviceToken", "");
    bool ok = activationPrefs.getBool("activated", false) && t.length() == 15;
    activationPrefs.end();
    return ok;
}

void ativacao_carregar_token() {
    activationPrefs.begin("activation", true);
    deviceToken = activationPrefs.getString("deviceToken", "");
    activationPrefs.end();
}

static void salvarTokenPermanente(const String& token) {
    activationPrefs.begin("activation", false);
    activationPrefs.putString("deviceToken", token);
    activationPrefs.putBool("activated", true);
    activationPrefs.putString("deviceId", getDeviceId());
    activationPrefs.end();
    deviceToken = token;
}

void ativacao_limpar() {
    activationPrefs.begin("activation", false);
    activationPrefs.clear();
    activationPrefs.end();
    deviceToken = "";
}

static void renderQrNoCanvas(esp_qrcode_handle_t qrcode) {
    Serial.println("[PIX][QR] Callback do gerador chamado.");

    if (!img_qr || !qrcode) {
        Serial.println("[PIX][QR] ERRO: img_qr ou qrcode nulo.");
        return;
    }

    const int qrSize = esp_qrcode_get_size(qrcode);
    Serial.printf("[PIX][QR] Matriz QR: %dx%d modulos.\n", qrSize, qrSize);

    if (qrSize <= 0) {
        Serial.println("[PIX][QR] ERRO: tamanho da matriz invalido.");
        return;
    }

    // Zona silenciosa de 4 modulos de cada lado.
    const int quiet = 4;
    const int totalModules = qrSize + quiet * 2;

    // Usa a MAIOR escala inteira que caiba na area reservada do display.
    // Se nao houver RAM contigua suficiente, reduz uma escala por vez.
    int maxScale = QR_MAX_DISPLAY_SIZE / totalModules;
    if (maxScale < 1) maxScale = 1;

    int scale = 0;
    int side = 0;

    Serial.printf("[PIX][QR] Area max=%d px, total com margem=%d modulos, escala maxima=%d.\n",
                  QR_MAX_DISPLAY_SIZE, totalModules, maxScale);

    for (int candidate = maxScale; candidate >= 1; --candidate) {
        const int candidateSide = totalModules * candidate;
        const size_t bytes = (size_t)candidateSide * candidateSide * sizeof(uint16_t);

        Serial.printf("[PIX][QR] Tentando escala=%d: %dx%d (%u bytes).\n",
                      candidate, candidateSide, candidateSide, (unsigned)bytes);

        if (allocateQrBuffer(candidateSide)) {
            scale = candidate;
            side = candidateSide;
            break;
        }
    }

    if (scale == 0) {
        Serial.println("[PIX][QR] ERRO: nenhuma escala do bitmap coube na RAM.");
        if (lbl_pix_status) {
            lv_label_set_text(lbl_pix_status, "Memoria insuficiente\npara exibir o QR Code.");
            lv_obj_set_style_text_color(lbl_pix_status, lv_palette_main(LV_PALETTE_RED), 0);
        }
        return;
    }

    Serial.printf("[PIX][QR] Escala escolhida=%d, bitmap=%dx%d.\n", scale, side, side);

    // Fundo branco.
    const size_t pixelCount = (size_t)side * side;
    for (size_t i = 0; i < pixelCount; ++i) {
        qrCanvasBuf[i] = 0xFFFF;
    }

    int blackModules = 0;
    const int offset = quiet * scale;

    for (int y = 0; y < qrSize; ++y) {
        for (int x = 0; x < qrSize; ++x) {
            if (!esp_qrcode_get_module(qrcode, x, y)) continue;

            ++blackModules;
            const int px0 = offset + x * scale;
            const int py0 = offset + y * scale;

            for (int dy = 0; dy < scale; ++dy) {
                uint16_t* row = qrCanvasBuf + (py0 + dy) * side + px0;
                for (int dx = 0; dx < scale; ++dx) {
                    row[dx] = 0x0000;
                }
            }
        }
    }

    Serial.printf("[PIX][QR] Modulos pretos desenhados: %d.\n", blackModules);

    memset(&qrImageDsc, 0, sizeof(qrImageDsc));
    qrImageDsc.header.magic = LV_IMAGE_HEADER_MAGIC;
    qrImageDsc.header.cf = LV_COLOR_FORMAT_RGB565;
    qrImageDsc.header.w = side;
    qrImageDsc.header.h = side;
    qrImageDsc.header.stride = side * sizeof(uint16_t);
    qrImageDsc.data_size = (uint32_t)side * side * sizeof(uint16_t);
    qrImageDsc.data = reinterpret_cast<const uint8_t*>(qrCanvasBuf);

    // Mantem o bitmap compacto na RAM, mas amplia visualmente para a area
    // completa reservada no display. O LVGL faz a transformacao sem criar
    // um segundo bitmap RGB565 do tamanho final.
    lv_image_set_src(img_qr, &qrImageDsc);
    lv_image_set_antialias(img_qr, false);
    lv_obj_set_size(img_qr, QR_MAX_DISPLAY_SIZE, QR_MAX_DISPLAY_SIZE);
    lv_image_set_inner_align(img_qr, LV_IMAGE_ALIGN_STRETCH);
    lv_obj_align(img_qr, LV_ALIGN_LEFT_MID, 3, 10);
    lv_obj_clear_flag(img_qr, LV_OBJ_FLAG_HIDDEN);
    lv_obj_move_foreground(img_qr);
    lv_obj_invalidate(img_qr);
    lv_refr_now(NULL);

    Serial.printf("[PIX][QR] Fonte=%dx%d px, exibicao forcada=%dx%d px (~3 cm).\n",
                  side, side, QR_MAX_DISPLAY_SIZE, QR_MAX_DISPLAY_SIZE);
}

static void drawQrCode(const String& text) {
    if (!img_qr) {
        Serial.println("[PIX][QR] ERRO: objeto de imagem ainda nao foi criado.");
        return;
    }

    if (text.isEmpty()) {
        Serial.println("[PIX][QR] ERRO: codigo PIX vazio.");
        return;
    }

    Serial.printf("[PIX][QR] Gerando QR para payload PIX com %u caracteres.\n",
                  (unsigned)text.length());

    esp_qrcode_config_t cfg = ESP_QRCODE_CONFIG_DEFAULT();
    cfg.display_func = renderQrNoCanvas;
    cfg.max_qrcode_version = 20;
    cfg.qrcode_ecc_level = ESP_QRCODE_ECC_LOW;

    esp_err_t err = esp_qrcode_generate(&cfg, text.c_str());
    if (err != ESP_OK) {
        Serial.printf("[PIX][QR] Falha ao gerar QR Code. esp_err=%d\n", (int)err);
        if (lbl_pix_status) {
            lv_label_set_text(lbl_pix_status, "Nao foi possivel gerar\no QR Code.\nTente novamente.");
            lv_obj_set_style_text_color(lbl_pix_status, lv_palette_main(LV_PALETTE_RED), 0);
        }
        lv_refr_now(NULL);
        return;
    }

    Serial.println("[PIX][QR] esp_qrcode_generate retornou ESP_OK.");
}

static void mostrarErroAtivacao(const char* msg) {
    if (lbl_ativacao_status) {
        lv_label_set_text(lbl_ativacao_status, msg);
        lv_obj_set_style_text_color(lbl_ativacao_status, lv_palette_main(LV_PALETTE_RED), 0);
    }
    if (btn_ativar) lv_obj_clear_flag(btn_ativar, LV_OBJ_FLAG_HIDDEN);
}

static void go_pix_screen() {
    currentScreen = "pix";
    if (!scr_pix) {
        scr_pix = new_screen(NULL, true);
        lv_obj_set_size(scr_pix, 320, 240);
        lv_obj_set_scroll_dir(scr_pix, LV_DIR_NONE);

        lv_obj_t* card = lv_obj_create(scr_pix);
        lv_obj_set_size(card, lv_pct(98), lv_pct(98));
        lv_obj_center(card);
        lv_obj_set_style_radius(card, 14, 0);
        lv_obj_set_style_pad_all(card, 5, 0);
        lv_obj_set_style_bg_opa(card, LV_OPA_20, 0);
        lv_obj_set_style_bg_color(card, lv_color_hex(0xFFFFFF), 0);

        lv_obj_t* title = lv_label_create(card);
        lv_obj_set_style_text_font(title, &lv_font_montserrat_18, 0);
        lv_label_set_text(title, "Ativacao via PIX");
        lv_obj_align(title, LV_ALIGN_TOP_MID, 0, 0);

        img_qr = lv_image_create(card);
        lv_obj_set_size(img_qr, QR_MAX_DISPLAY_SIZE, QR_MAX_DISPLAY_SIZE);
        lv_obj_align(img_qr, LV_ALIGN_LEFT_MID, 3, 10);
        lv_obj_set_style_bg_color(img_qr, lv_color_white(), 0);
        lv_obj_set_style_bg_opa(img_qr, LV_OPA_COVER, 0);
        lv_image_set_antialias(img_qr, false);
        lv_image_set_inner_align(img_qr, LV_IMAGE_ALIGN_STRETCH);
        Serial.println("[PIX][QR] Objeto lv_image criado (area visual 174x174 px).");

        lbl_pix_valor = lv_label_create(card);
        lv_obj_set_style_text_font(lbl_pix_valor, &lv_font_montserrat_16, 0);
        lv_obj_set_width(lbl_pix_valor, 118);
        lv_obj_align(lbl_pix_valor, LV_ALIGN_TOP_RIGHT, -2, 42);
        lv_obj_set_style_text_align(lbl_pix_valor, LV_TEXT_ALIGN_CENTER, 0);

        lbl_pix_status = lv_label_create(card);
        lv_obj_set_style_text_font(lbl_pix_status, &lv_font_montserrat_12, 0);
        lv_obj_set_width(lbl_pix_status, 118);
        lv_label_set_long_mode(lbl_pix_status, LV_LABEL_LONG_WRAP);
        lv_obj_set_style_text_align(lbl_pix_status, LV_TEXT_ALIGN_CENTER, 0);
        lv_obj_align(lbl_pix_status, LV_ALIGN_TOP_RIGHT, -2, 85);

        btn_pix_tentar = lv_btn_create(card);
        lv_obj_set_size(btn_pix_tentar, 112, 38);
        lv_obj_align(btn_pix_tentar, LV_ALIGN_BOTTOM_RIGHT, -2, -5);
        lv_obj_add_flag(btn_pix_tentar, LV_OBJ_FLAG_HIDDEN);
        lv_obj_t* l = lv_label_create(btn_pix_tentar);
        lv_label_set_text(l, "TENTAR NOVAMENTE");
        lv_obj_set_style_text_font(l, &lv_font_montserrat_10, 0);
        lv_obj_center(l);
        lv_obj_add_event_cb(btn_pix_tentar, [](lv_event_t*) {
            aguardandoPagamento = false;
            paymentId = "";
            pixCode = "";
            go_ativacao();
        }, LV_EVENT_CLICKED, NULL);
    }

    lv_label_set_text_fmt(lbl_pix_valor, "R$ %.2f", activationPrice);
    lv_label_set_text(lbl_pix_status, "Escaneie o QR Code\ne efetue o pagamento.\n\nAguardando pagamento...");
    lv_obj_set_style_text_color(lbl_pix_status, lv_color_white(), 0);
    lv_obj_add_flag(btn_pix_tentar, LV_OBJ_FLAG_HIDDEN);
    lv_scr_load(scr_pix);
    lv_obj_add_flag(btn_exit, LV_OBJ_FLAG_HIDDEN);
    drawQrCode(pixCode);
}

static void criarPagamento() {
    if (criandoPagamento || WiFi.status() != WL_CONNECTED) return;
    criandoPagamento = true;
    lv_obj_add_flag(btn_ativar, LV_OBJ_FLAG_HIDDEN);
    lv_label_set_text(lbl_ativacao_status, "Gerando PIX...");
    lv_obj_set_style_text_color(lbl_ativacao_status, lv_color_white(), 0);
    lv_timer_handler();

    HTTPClient http;
    WiFiClientSecure secureClient;
    String url = backendBaseUrl() + "/api/device/activation/create";
    if (!httpBeginBackend(http, secureClient, url)) {
        criandoPagamento = false;
        mostrarErroAtivacao("Falha ao iniciar conexao segura com a API.");
        return;
    }
    http.setTimeout(15000);
    http.addHeader("Content-Type", "application/json");

    DynamicJsonDocument req(512);
    req["deviceId"] = getDeviceId();
    req["amount"] = activationPrice; // informativo; o backend usa o valor configurado no servidor
    String body;
    serializeJson(req, body);

    int code = http.POST(body);
    String response = code > 0 ? http.getString() : "";
    http.end();
    criandoPagamento = false;

    if (code < 200 || code >= 300) {
        Serial.printf("[ATIVACAO] Erro create HTTP %d: %s\n", code, response.c_str());
        mostrarErroAtivacao("Nao foi possivel gerar o PIX.\nToque para tentar novamente.");
        return;
    }

    DynamicJsonDocument doc(4096);
    if (deserializeJson(doc, response)) {
        mostrarErroAtivacao("Resposta invalida da API.");
        return;
    }

    bool alreadyActivated = doc["alreadyActivated"] | false;
    float backendAmount = doc["amount"] | activationPrice;
    if (backendAmount > 0.0f) activationPrice = backendAmount;

    if (alreadyActivated) {
        String token = doc["deviceToken"].as<String>();
        if (token.length() == 15) {
            salvarTokenPermanente(token);
            Serial.println("[ATIVACAO] Backend confirmou dispositivo ja ativado. Token recuperado.");
            go_token();
            if (wsConnected) registerDevice();
            return;
        }
    }

    paymentId = doc["paymentId"].as<String>();
    pixCode = doc["qrCode"].as<String>();
    Serial.printf("[ATIVACAO] PIX criado. paymentId=%s, qrCode length=%u\n",
                  paymentId.c_str(), (unsigned)pixCode.length());
    if (paymentId.isEmpty() || pixCode.isEmpty()) {
        mostrarErroAtivacao("API nao retornou QR Code PIX.");
        return;
    }

    aguardandoPagamento = true;
    ultimoStatus = 0;
    go_pix_screen();
}

static void consultarPagamento() {
    if (!aguardandoPagamento || paymentId.isEmpty() || WiFi.status() != WL_CONNECTED) return;
    if (millis() - ultimoStatus < STATUS_INTERVAL_MS) return;
    ultimoStatus = millis();

    HTTPClient http;
    WiFiClientSecure secureClient;
    String url = backendBaseUrl() + "/api/device/activation/status?deviceId=" + getDeviceId() + "&paymentId=" + paymentId;
    if (!httpBeginBackend(http, secureClient, url)) {
        Serial.println("[ATIVACAO] Falha ao iniciar HTTPS para status.");
        return;
    }
    http.setTimeout(12000);
    int code = http.GET();
    String response = code > 0 ? http.getString() : "";
    http.end();

    if (code < 200 || code >= 300) {
        Serial.printf("[ATIVACAO] Status HTTP %d\n", code);
        return; // mantem aguardando; falha de rede pode ser temporaria
    }

    DynamicJsonDocument doc(2048);
    if (deserializeJson(doc, response)) return;
    String status = doc["status"].as<String>();

    if (status == "approved") {
        String token = doc["deviceToken"].as<String>();
        if (token.length() != 15) {
            lv_label_set_text(lbl_pix_status, "Pagamento aprovado,\nmas o token recebido\ne invalido.");
            lv_obj_set_style_text_color(lbl_pix_status, lv_palette_main(LV_PALETTE_RED), 0);
            lv_obj_clear_flag(btn_pix_tentar, LV_OBJ_FLAG_HIDDEN);
            aguardandoPagamento = false;
            return;
        }
        salvarTokenPermanente(token);
        aguardandoPagamento = false;
        lv_label_set_text(lbl_pix_status, "Pagamento aprovado!\nDispositivo ativado.");
        lv_obj_set_style_text_color(lbl_pix_status, lv_palette_main(LV_PALETTE_GREEN), 0);
        lv_timer_handler();
        delay(900);
        go_token(); // mostra o token no mesmo modelo atual
        if (wsConnected) registerDevice();
    } else if (status == "rejected" || status == "cancelled") {
        aguardandoPagamento = false;
        lv_label_set_text(lbl_pix_status, "Pagamento nao aprovado.\nGere um novo PIX.");
        lv_obj_set_style_text_color(lbl_pix_status, lv_palette_main(LV_PALETTE_RED), 0);
        lv_obj_clear_flag(btn_pix_tentar, LV_OBJ_FLAG_HIDDEN);
    } else {
        lv_label_set_text(lbl_pix_status, "Escaneie o QR Code\ne efetue o pagamento.\n\nAguardando confirmacao...");
    }
}

void ativacao_loop() {
    consultarPagamento();
}

void go_ativacao() {
    currentScreen = "ativacao";
    if (!scr_ativacao) {
        scr_ativacao = new_screen(NULL, true);
        lv_obj_set_size(scr_ativacao, 320, 240);
        lv_obj_set_scroll_dir(scr_ativacao, LV_DIR_NONE);

        lv_obj_t* card = lv_obj_create(scr_ativacao);
        lv_obj_set_size(card, lv_pct(96), lv_pct(96));
        lv_obj_center(card);
        lv_obj_set_style_radius(card, 16, 0);
        lv_obj_set_style_pad_all(card, 10, 0);
        lv_obj_set_style_pad_row(card, 7, 0);
        lv_obj_set_style_bg_opa(card, LV_OPA_20, 0);
        lv_obj_set_style_bg_color(card, lv_color_hex(0xFFFFFF), 0);
        lv_obj_set_flex_flow(card, LV_FLEX_FLOW_COLUMN);
        lv_obj_set_flex_align(card, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);

        lv_obj_t* titulo = lv_label_create(card);
        lv_obj_set_style_text_font(titulo, &lv_font_montserrat_22, 0);
        lv_label_set_text(titulo, "Ativar dispositivo");

        lv_obj_t* info = lv_label_create(card);
        lv_obj_set_width(info, lv_pct(92));
        lv_label_set_long_mode(info, LV_LABEL_LONG_WRAP);
        lv_obj_set_style_text_font(info, &lv_font_montserrat_12, 0);
        lv_obj_set_style_text_align(info, LV_TEXT_ALIGN_CENTER, 0);
        lv_label_set_text(info,
            "Para utilizar este equipamento, faca a ativacao unica via PIX.\n"
            "Apos o pagamento, o token deste dispositivo sera criado e salvo permanentemente.");

        lbl_ativacao_valor = lv_label_create(card);
        lv_obj_set_style_text_font(lbl_ativacao_valor, &lv_font_montserrat_26, 0);
        lv_label_set_text_fmt(lbl_ativacao_valor, "R$ %.2f", activationPrice);
        lv_obj_set_style_text_color(lbl_ativacao_valor, lv_palette_main(LV_PALETTE_GREEN), 0);

        lbl_ativacao_status = lv_label_create(card);
        lv_obj_set_width(lbl_ativacao_status, lv_pct(90));
        lv_obj_set_style_text_font(lbl_ativacao_status, &lv_font_montserrat_12, 0);
        lv_obj_set_style_text_align(lbl_ativacao_status, LV_TEXT_ALIGN_CENTER, 0);
        lv_label_set_text(lbl_ativacao_status, "Toque em ATIVAR para gerar o QR Code PIX.");

        btn_ativar = lv_btn_create(card);
        lv_obj_set_width(btn_ativar, lv_pct(80));
        lv_obj_set_style_bg_color(btn_ativar, lv_palette_main(LV_PALETTE_GREEN), 0);
        lv_obj_t* l = lv_label_create(btn_ativar);
        lv_label_set_text(l, "ATIVAR");
        lv_obj_center(l);
        lv_obj_add_event_cb(btn_ativar, [](lv_event_t*) { criarPagamento(); }, LV_EVENT_CLICKED, NULL);
    }

    lv_label_set_text(lbl_ativacao_status, "Toque em ATIVAR para gerar o QR Code PIX.");
    lv_obj_set_style_text_color(lbl_ativacao_status, lv_color_white(), 0);
    if (lbl_ativacao_valor) lv_label_set_text_fmt(lbl_ativacao_valor, "R$ %.2f", activationPrice);
    lv_obj_clear_flag(btn_ativar, LV_OBJ_FLAG_HIDDEN);
    lv_scr_load(scr_ativacao);
    lv_obj_add_flag(btn_exit, LV_OBJ_FLAG_HIDDEN);

    // Busca o valor real no backend assim que a tela aparece. Se houver uma
    // falha temporaria, mantem o ultimo valor conhecido e o create confirma
    // novamente o valor retornado pelo servidor.
    if (!activationConfigLoaded) carregarConfiguracaoAtivacao();
}

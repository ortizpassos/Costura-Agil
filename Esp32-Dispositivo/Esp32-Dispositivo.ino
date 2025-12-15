#if defined(ESP32)
  #include <FS.h>
  using FS = fs::FS;
#endif

#include <LVGL_CYD.h>
#include "dashboard.h"
#include "login.h"
#include "home.h"
#include "token.h"
#include "operacao.h"
#include "config.h"

#include <WiFiManager.h>
#include <SocketIOclient.h>
#include <ArduinoJson.h>
#include <Preferences.h>

#define SCREEN_ORIENTATION USB_LEFT

// ---- Pino do botão ----
#define BUTTON_PIN 0 // GPIO0

lv_obj_t * btn_exit;
lv_obj_t * lbl_header;
bool wifi_connected = false;
bool token_registrado = false;
bool login_ok = false;
bool artigo_selecionado = false;
bool hasPendingSync = false; // Flag para indicar se há dados pendentes para sincronizar

// Controle de tentativas de registro
unsigned long lastCheckTime = 0;
const unsigned long checkInterval = 1000;

// Controle de keep-alive
unsigned long lastKeepAliveTime = 0;
const unsigned long keepAliveInterval = 30000; // 30 segundos

// Controle de atualizações em tempo real da tela de operação
unsigned long lastUpdateCheckTime = 0;
const unsigned long updateCheckInterval = 10000; // 10 segundos
String currentScreen = ""; // Rastreia tela atual

// ---- Config servidor ----
const char* host = "monitor-ellas-backend.onrender.com";   // Host do backend (produção)
const uint16_t port = 443;             // HTTPS/WSS
const bool useSSL = true;              // TLS habilitado para servidor online
const char* socketPath = "/socket.io/?EIO=4";

// ---- Dispositivo ----
const char* deviceToken = "461545616614165";

SocketIOclient socketIO;
bool wsConnected = false;
Preferences prefs;

// ---- Estado de negócio ----
String funcionarioSenha = "";
String funcionarioNome = "";
String artigoId = "";
String artigoNome = "";
int metaArtigo = 0;
int quantidade = 0;

// Controle do sensor para incrementação
bool sensorLow = false; // Flag para indicar se o sensor estava em nível baixo

// Função callback para ser chamada após conexão WiFi
void on_wifi_connected() {
  if (!wifi_connected) {
    Serial.println("\n[WiFi] ✅ Conectado!");
    Serial.print("[WiFi] IP: ");
    Serial.println(WiFi.localIP());

    wifi_connected = true;
    
    // Se já estava logado, ir para a tela apropriada
    if (login_ok) {
      if (artigo_selecionado) {
        go_dashboard();
        update_dashboard(artigoNome.c_str(), funcionarioNome.c_str(), metaArtigo, quantidade);
      } else {
        go_operacao();
      }
    } else {
      go_token();
    }
    
    if (useSSL) {
      socketIO.beginSSL(host, port, socketPath);
      Serial.println("[IO] Iniciando conexão segura (wss)");
    } else {
      socketIO.begin(host, port, socketPath);
      Serial.println("[IO] Iniciando conexão sem TLS (ws)");
    }
    socketIO.setReconnectInterval(5000);
    socketIO.onEvent(socketIOEvent);
  }
}

// Simulação: chamar esta função quando backend responder que token foi registrado
void on_token_registrado() {
    token_registrado = true;
    go_login();
}

// Simulação: chamar esta função quando login do funcionário for aceito
void on_login_ok() {
    login_ok = true;
    // Aqui irá para a tela de seleção de operação
    // go_operacao();
}

// Simulação: chamar esta função quando operação for selecionada
void on_artigo_selecionado() {
  artigo_selecionado = true;
    // Aqui irá para a dashboard
    // go_dashboard();
}

void loadPersistedState() {
  prefs.begin("prod", false);
  login_ok = prefs.getBool("login_ok", false);
  artigo_selecionado = prefs.getBool("artigo_selecionado", false);
  funcionarioSenha = prefs.getString("funcionarioSenha", "");
  funcionarioNome = prefs.getString("funcionarioNome", "");
  artigoId = prefs.getString("operacaoId", "");
  artigoNome = prefs.getString("operacaoNome", "");
  metaArtigo = prefs.getInt("metaDiaria", 0);
  quantidade = prefs.getInt("quantidade", 0);
  prefs.end();
  
  // Carregar estado do sensor
  prefs.begin("sensor", false);
  sensorLow = prefs.getBool("sensorLow", false);
  prefs.end();
  
  Serial.printf("📂 Estado carregado: login_ok=%d, artigo_sel=%d, senha='%s', nome='%s', sensorLow=%d\n", login_ok, artigo_selecionado, funcionarioSenha.c_str(), funcionarioNome.c_str(), sensorLow);
}

void saveLoginState() {
  prefs.begin("prod", false);
  prefs.putBool("login_ok", login_ok);
  prefs.putString("funcionarioSenha", funcionarioSenha);
  prefs.putString("funcionarioNome", funcionarioNome);
  prefs.end();
}

void saveArtigoState() {
  prefs.begin("prod", false);
  prefs.putBool("artigo_selecionado", artigo_selecionado);
  prefs.putString("operacaoId", artigoId);
  prefs.putString("operacaoNome", artigoNome);
  prefs.putInt("metaDiaria", metaArtigo);
  prefs.putInt("quantidade", quantidade);
  prefs.end();
}

void saveArtigos(String json) {
  prefs.begin("prod", false);
  prefs.putString("artigos", json);
  prefs.end();
}

String loadArtigos() {
  prefs.begin("prod", false);
  String json = prefs.getString("artigos", "");
  prefs.end();
  return json;
}

void loadSavedArtigos() {
  String artigosJson = loadArtigos();
  if (artigosJson == "") {
    show_operacao_message("Nenhum artigo salvo");
    return;
  }
  
  DynamicJsonDocument doc(4096);
  DeserializationError err = deserializeJson(doc, artigosJson);
  if (err) {
    Serial.printf("[JSON] Erro ao carregar artigos salvos: %s\n", err.c_str());
    show_operacao_message("Erro ao carregar artigos");
    return;
  }
  
  JsonArray artigos = doc.as<JsonArray>();
  Serial.printf("Carregando %d artigos salvos\n", artigos.size());
  
  for (size_t i = 0; i < artigos.size(); i++) {
    const char* artId = artigos[i]["_id"];
    const char* artNome = artigos[i]["nome"];
    int artMeta = artigos[i]["quantidade"];
    
    add_operacao_to_list(artId, artNome, artMeta);
  }
}

void syncPendingProduction() {
  if (!wsConnected || !hasPendingSync || artigoId == "") return;
  
  // Enviar a produção atual pendente
  DynamicJsonDocument doc(1024);
  JsonArray array = doc.to<JsonArray>();
  array.add("producao");
  JsonObject param = array.createNestedObject();
  param["deviceToken"] = deviceToken;
  param["quantidade"] = quantidade;
  param["tempoProducao"] = 0; // Tempo zero para sync
  
  String json; serializeJson(doc, json);
  socketIO.sendEVENT(json);
  Serial.printf("🔄 Sincronização pendente enviada: %d peças (%s)\n", quantidade, artigoNome.c_str());
  hasPendingSync = false;
}

// ---- Controle de conexão ----
// static bool wsConnected = false; // Removido redefinição

// ---- Socket.IO Events ----
void socketIOEvent(socketIOmessageType_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case sIOtype_DISCONNECT:
      Serial.println("[IO] ❌ Disconnected");
      wsConnected = false;
      break;
    case sIOtype_CONNECT:
      Serial.printf("[IO] ✅ Connected to https://%s:%u\n", host, port);
      // A conexão é estabelecida automaticamente, não é necessário enviar um evento de conexão manual.
      // socketIO.send(sIOtype_CONNECT, "/"); 
      wsConnected = true;
      registerDevice();
      if (login_ok && funcionarioSenha != "") {
        loginFuncionario(funcionarioSenha.c_str()); // Re-logar se estava logado
      }
      syncPendingProduction(); // Sincronizar dados pendentes após conectar
      break;
    case sIOtype_EVENT: {
      String msg = String((char*)payload);
      Serial.printf("[IO] 📩 RX: %s\n", msg.c_str());
      
      DynamicJsonDocument doc(4096);
      DeserializationError err = deserializeJson(doc, msg);
      if (err) {
        Serial.printf("[JSON] ❌ Erro: %s\n", err.c_str());
        return;
      }

      // Socket.IO envia array ["evento", {dados}]
      String eventName = doc[0];
      JsonObject data = doc[1];

      // Injeta o tipo no objeto de dados para compatibilidade com processJsonMessage
      // Se data for nulo (alguns eventos podem não ter dados), cria um objeto
      if (data.isNull()) {
         // Se não tem dados, cria um novo doc para passar adiante
         DynamicJsonDocument newDoc(256);
         newDoc["type"] = eventName;
         String newMsg;
         serializeJson(newDoc, newMsg);
         processJsonMessage(newMsg);
      } else {
         // Adiciona o campo type aos dados existentes
         data["type"] = eventName;
         String newMsg;
         serializeJson(data, newMsg);
         processJsonMessage(newMsg);
      }
      break; 
    }
    case sIOtype_ACK:
      Serial.printf("[IO] ACK: %u\n", length);
      break;
    case sIOtype_ERROR:
      Serial.printf("[IO] Error: %u\n", length);
      break;
    case sIOtype_BINARY_EVENT:
    case sIOtype_BINARY_ACK:
      break;
  }
}

// ---- Processamento de mensagens JSON ----
void processJsonMessage(const String& msg) {
  Serial.printf("[WS] 📩 RX: %s\n", msg.c_str());
  DynamicJsonDocument doc(4096);
  DeserializationError err = deserializeJson(doc, msg);
  if (err) {
    Serial.printf("[JSON] ❌ Erro: %s\n", err.c_str());
    return;
  }
  String type = doc["type"] | "";
  if (type == "deviceRegistered") {
    String token = doc["data"]["deviceToken"] | "";
    if (token != String(deviceToken)) {
      Serial.printf("Ignorando deviceRegistered para outro token: %s\n", token.c_str());
      return;
    }

    bool success = doc["success"];
    String message = doc["message"];
    bool usuarioVinculado = doc["data"]["usuarioVinculado"] | false;

    Serial.printf("[deviceRegistered] Success: %d, Vinculado: %d, Message: %s\n", success, usuarioVinculado, message.c_str());
    
    if (success && usuarioVinculado) {
      on_token_registrado();
    } else {
      Serial.println("Dispositivo conectado, mas sem usuário vinculado. Aguardando...");
      // Opcional: Mostrar mensagem na tela de token
    }
  } else if (type == "loginSuccess") {
    String token = doc["data"]["deviceToken"] | "";
    if (token != String(deviceToken)) return;

    String nome = doc["data"]["funcionario"]["nome"];
    funcionarioNome = nome;
    Serial.printf("[loginSuccess] 👤 %s logado!\n", nome.c_str());
    
    login_ok = true;
    saveLoginState();
    
    // Verificar se já há artigo selecionado (reconnect)
    if (artigo_selecionado) {
      go_dashboard();
    } else {
      // Sempre ir para a tela de seleção de artigo
      go_operacao();
      clear_operacao_list();
      
      if (doc["data"].containsKey("artigos") && doc["data"]["artigos"].is<JsonArray>()) {
        JsonArray artigos = doc["data"]["artigos"].as<JsonArray>();
        Serial.printf("Artigos disponíveis: %d\n", artigos.size());

        if (artigos.size() == 0) {
          show_operacao_message("Nenhum artigo disponivel");
        }

        for (size_t i = 0; i < artigos.size(); i++) {
          const char* artId = artigos[i]["_id"].as<const char*>();
          const char* artNome = artigos[i]["nome"].as<const char*>();
          int artMeta = artigos[i]["quantidade"].as<int>();
          
          Serial.printf("[%d] %s (meta: %d)\n", (int)(i+1), artNome, artMeta);
          add_operacao_to_list(artId, artNome, artMeta);
        }
        
        // Salvar artigos localmente para uso offline
        String artigosJson;
        serializeJson(artigos, artigosJson);
        saveArtigos(artigosJson);
      } else {
        Serial.println("⚠️ Erro: Campo 'artigos' não encontrado ou inválido no JSON!");
        String jsonStr;
        serializeJson(doc, jsonStr);
        Serial.printf("JSON recebido: %s\n", jsonStr.c_str());
        show_operacao_message("Erro ao carregar artigos");
      }
    }
  } else if (type == "artigoSelecionado") {
    String token = doc["data"]["deviceToken"] | "";
    if (token != String(deviceToken)) {
      Serial.printf("⚠️ Token inválido em artigoSelecionado. Recebido: '%s', Esperado: '%s'\n", token.c_str(), deviceToken);
      // return; // Comentado para teste, mas o ideal é manter
    }

    artigoId = doc["data"]["artigo"]["_id"].as<String>();
    artigoNome = doc["data"]["artigo"]["nome"].as<String>();
    metaArtigo = doc["data"]["artigo"]["quantidade"].as<int>();
    
    // Usar quantidadeAtual do artigo (produção já salva no banco)
    if (doc["data"]["artigo"].containsKey("quantidadeAtual") && !doc["data"]["artigo"]["quantidadeAtual"].isNull()) {
      quantidade = doc["data"]["artigo"]["quantidadeAtual"].as<int>();
    } else {
      quantidade = 0;
    }
    Serial.printf("✅ Artigo carregado: %s (meta: %d, produção atual: %d)\n", artigoNome.c_str(), metaArtigo, quantidade);
    
    artigo_selecionado = true;
    saveArtigoState();
    
    go_dashboard();
    update_dashboard(artigoNome.c_str(), funcionarioNome.c_str(), metaArtigo, quantidade);
  } else if (type == "producaoSuccess") {
    String token = doc["data"]["deviceToken"] | "";
    if (token != String(deviceToken)) return;
    Serial.println("[producaoSuccess] Produção registrada!");
    
    // Atualizar a tela operacao em tempo real se estiver visualizando
    if (currentScreen == "operacao") {
      int quantidadeAtual = doc["data"]["quantidade"] | 0;
      const char* artigoIdResp = doc["data"]["artigoId"].as<const char*>();
      const char* artigoNomeResp = doc["data"]["artigoNome"].as<const char*>();
      int metaResp = doc["data"]["meta"] | 0;
      
      if (artigoIdResp && artigoNomeResp && metaResp > 0) {
        update_operacao_quantities(artigoIdResp, quantidadeAtual, metaResp);
        Serial.printf("🎯 Tela operacao atualizada: %s (%d/%d)\n", artigoNomeResp, quantidadeAtual, metaResp);
      }
    }
  } else if (type == "artigosAtualizados") {
    // Atualização em tempo real da lista de artigos na tela de operação
    String token = doc["data"]["deviceToken"] | "";
    if (token != String(deviceToken)) return;

    Serial.println("[artigosAtualizados] 🔄 Atualizando lista de artigos...");
    
    clear_operacao_list(); // Limpar lista anterior
    
    if (doc["data"].containsKey("artigos") && doc["data"]["artigos"].is<JsonArray>()) {
      JsonArray artigos = doc["data"]["artigos"].as<JsonArray>();
      Serial.printf("Artigos atualizados: %d\n", artigos.size());

      if (artigos.size() == 0) {
        show_operacao_message("Nenhum artigo disponível");
      }

      for (size_t i = 0; i < artigos.size(); i++) {
        const char* artId = artigos[i]["_id"].as<const char*>();
        const char* artNome = artigos[i]["nome"].as<const char*>();
        int artMeta = artigos[i]["quantidade"].as<int>();
        
        Serial.printf("[%d] %s (meta: %d)\n", (int)(i+1), artNome, artMeta);
        add_operacao_to_list(artId, artNome, artMeta);
      }
      
      // Salvar artigos atualizados localmente
      String artigosJson;
      serializeJson(artigos, artigosJson);
      saveArtigos(artigosJson);
    } else {
      Serial.println("⚠️ Erro: Campo 'artigos' não encontrado em artigosAtualizados!");
    }
  } else if (type == "loginFailed" || type == "error") {
    String message = doc["message"];
    Serial.printf("[Erro] ❌ %s\n", message.c_str());
    // Exibir erro na tela de login
    extern void show_login_error(const char* msg);
    show_login_error(message.c_str());
  } else if (type == "sensorData") {
    String token = doc["data"]["deviceToken"] | "";
    if (token != String(deviceToken)) return;

    int nivel = doc["data"]["nivel"] | -1;
    Serial.printf("[sensorData] Nível recebido: %d\n", nivel);

    if (nivel == 0) {
      // Sensor em nível baixo (peça detectada)
      sensorLow = true;
      prefs.begin("sensor", false);
      prefs.putBool("sensorLow", sensorLow);
      prefs.end();
      Serial.println("🔴 Sensor em nível baixo");
    } else if (nivel == 1 && sensorLow) {
      // Sensor voltou ao nível alto após estar baixo - incrementar produção
      sensorLow = false;
      prefs.begin("sensor", false);
      prefs.putBool("sensorLow", sensorLow);
      prefs.end();
      Serial.println("🟢 Sensor voltou ao nível alto - incrementando produção");
      sendProductionData();
    }
  }
}



void registerDevice() {
  DynamicJsonDocument doc(1024);
  JsonArray array = doc.to<JsonArray>();
  array.add("registerDevice");
  JsonObject param = array.createNestedObject();
  param["deviceToken"] = deviceToken;
  
  String json; serializeJson(doc, json);
  socketIO.sendEVENT(json);
  Serial.printf("➡️ Registrando dispositivo: %s\n", deviceToken);
}

void loginFuncionario(const char* senha) {
  funcionarioSenha = senha;
  DynamicJsonDocument doc(1024);
  JsonArray array = doc.to<JsonArray>();
  array.add("loginFuncionario");
  JsonObject param = array.createNestedObject();
  param["deviceToken"] = deviceToken;
  param["codigo"] = funcionarioSenha;
  
  String json; serializeJson(doc, json);
  socketIO.sendEVENT(json);
  Serial.printf("➡️ Login do funcionário (código: %s)\n", funcionarioSenha.c_str());
}

void enviarSelecaoArtigo(const char* id) {
  artigoId = String(id);
  DynamicJsonDocument doc(1024);
  JsonArray array = doc.to<JsonArray>();
  array.add("selecionarArtigo");
  JsonObject param = array.createNestedObject();
  param["deviceToken"] = deviceToken;
  param["artigoId"] = artigoId;
  
  String json; serializeJson(doc, json);
  socketIO.sendEVENT(json);
  Serial.printf("➡️ Selecionando artigo ID: %s\n", id);
}

void sendKeepAlive() {
  DynamicJsonDocument doc(64);
  JsonArray array = doc.to<JsonArray>();
  array.add("keep-alive");
  JsonObject param = array.createNestedObject();
  param["millis"] = millis();
  
  String json; serializeJson(doc, json);
  socketIO.sendEVENT(json);
  Serial.println("➡️ Enviando keep-alive");
}

void solicitarArtigosAtualizados() {
  // Solicita atualização em tempo real da lista de artigos
  DynamicJsonDocument doc(1024);
  JsonArray array = doc.to<JsonArray>();
  array.add("solicitarArtigosAtualizados");
  JsonObject param = array.createNestedObject();
  param["deviceToken"] = deviceToken;
  // Se existe usuário logado, enviar seu ID
  String userId = prefs.getString("usuarioId", "");
  if (userId.length() > 0) {
    param["usuarioId"] = userId;
  }
  
  String json; serializeJson(doc, json);
  socketIO.sendEVENT(json);
  Serial.println("➡️ Solicitando atualização de artigos");
}

void sendProductionData() {
  if (artigoId == "") {
    Serial.println("⚠️ Nenhum artigo selecionado.");
    return;
  }
  
  // Verificar se já atingiu a meta antes de incrementar
  if (quantidade >= metaArtigo) {
    Serial.println("⚠️ Meta já atingida! Não é possível adicionar mais peças.");
    return;
  }
  
  int tempoProducao = random(100, 500);
  quantidade++;
  prefs.begin("prod", false);
  prefs.putInt("quantidade", quantidade);
  prefs.end();
  
  update_dashboard(artigoNome.c_str(), funcionarioNome.c_str(), metaArtigo, quantidade);
  
  if (wsConnected) {
    DynamicJsonDocument doc(1024);
    JsonArray array = doc.to<JsonArray>();
    array.add("producao");
    JsonObject param = array.createNestedObject();
    param["deviceToken"] = deviceToken;
    param["quantidade"] = quantidade;
    param["tempoProducao"] = tempoProducao;
    
    String json; serializeJson(doc, json);
    socketIO.sendEVENT(json);
    Serial.printf("📤 Produção enviada: %d peças em %d ms (%s)\n", quantidade, tempoProducao, artigoNome.c_str());
    hasPendingSync = false;
  } else {
    Serial.printf("📱 Produção registrada localmente (offline): %d peças (%s)\n", quantidade, artigoNome.c_str());
    hasPendingSync = true;
  }
  
  // Verificar se atingiu a meta após incrementar
  if (quantidade >= metaArtigo) {
    Serial.println("🎯 Meta atingida! Finalizando artigo...");
    
    // Aguardar um momento para exibir a conclusão
    delay(1500);
    
    // Limpar dados do artigo atual
    artigoId = "";
    artigoNome = "";
    metaArtigo = 0;
    quantidade = 0;
    artigo_selecionado = false;
    
    // Limpar dados persistidos do artigo
    prefs.begin("prod", false);
    prefs.remove("operacaoId");
    prefs.remove("operacaoNome");
    prefs.remove("metaDiaria");
    prefs.remove("quantidade");
    prefs.end();
    
    // Voltar para tela de operação
    currentScreen = "operacao";
    go_operacao();
    
    // Solicitar lista atualizada de artigos
    if (wsConnected && login_ok) {
      solicitarArtigosAtualizados();
    }
    
    Serial.println("✅ Retornado para seleção de artigos!");
  }
}

void logoutFuncionario() {
  Serial.println("🚪 Deslogando funcionário...");
  
  // Limpar estado de negócio
  funcionarioSenha = "";
  funcionarioNome = "";
  artigoId = "";
  artigoNome = "";
  metaArtigo = 0;
  quantidade = 0;
  
  // Resetar flags de autenticação
  login_ok = false;
  artigo_selecionado = false;
  
  // Limpar dados persistidos
  prefs.begin("prod", false);
  prefs.clear();
  prefs.end();
  
  // Voltar para tela de login
  currentScreen = "login";
  go_login();
  
  Serial.println("✅ Logout concluído!");
}

void resetWiFiConfig() {
  Serial.println("🔄 Resetando configurações WiFi...");
  WiFiManager wifiManager;
  wifiManager.resetSettings();
  delay(1000);
  Serial.println("✅ WiFi resetado! Reiniciando...");
  ESP.restart();
}

void atualizarInfoConfig() {
  // Atualizar informações na tela de configuração
  String wifiSSID = WiFi.SSID();
  String wifiIP = WiFi.localIP().toString();
  String backendURL = String(host) + ":" + String(port);
  
  update_config_info(
    wifiSSID.c_str(),
    wifiIP.c_str(),
    backendURL.c_str(),
    wsConnected
  );
  
  // Atualizar token do dispositivo
  extern lv_obj_t * lbl_device_token;
  if (lbl_device_token) {
    lv_label_set_text_fmt(lbl_device_token, "Token: %s", deviceToken);
  }
  
  // Atualizar uptime
  extern lv_obj_t * lbl_uptime;
  if (lbl_uptime) {
    unsigned long uptimeSeconds = millis() / 1000;
    unsigned long hours = uptimeSeconds / 3600;
    unsigned long minutes = (uptimeSeconds % 3600) / 60;
    unsigned long seconds = uptimeSeconds % 60;
    lv_label_set_text_fmt(lbl_uptime, "Tempo ativo: %02lu:%02lu:%02lu", hours, minutes, seconds);
  }
}

// -----------------------------------------------------------------------------
// SETUP
// -----------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  LVGL_CYD::begin(SCREEN_ORIENTATION);

  // Carregar estado persistido
  loadPersistedState();

  // Botão "EXIT" que fica na camada superior
  btn_exit = lv_obj_create(lv_layer_top());
  lv_obj_clear_flag(btn_exit, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_add_flag(btn_exit, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_style_bg_opa(btn_exit, LV_OPA_TRANSP, LV_PART_MAIN);
  lv_obj_set_style_border_width(btn_exit, 0, LV_PART_MAIN);
  lv_obj_set_size(btn_exit, 40, 40);
  lv_obj_align(btn_exit, LV_ALIGN_TOP_RIGHT, 0, 0);
  lv_obj_add_event_cb(btn_exit, [](lv_event_t * e) {
    go_home();
  }, LV_EVENT_CLICKED, NULL);
  // Texto "X"
  lv_obj_t * lbl_exit_symbol = lv_label_create(btn_exit);
  lv_obj_set_style_text_font(lbl_exit_symbol, &lv_font_montserrat_18, LV_PART_MAIN);
  lv_obj_set_style_text_align(lbl_exit_symbol, LV_TEXT_ALIGN_RIGHT, 0);
  lv_label_set_text(lbl_exit_symbol, LV_SYMBOL_CLOSE);
  lv_obj_align(lbl_exit_symbol, LV_ALIGN_TOP_LEFT, 5, -10);

  go_home();
}

void loop() {
  lv_task_handler();
  static bool wifi_tried = false;
  if (!wifi_connected && !wifi_tried) {
    Serial.println("[WiFi] Iniciando WiFiManager...");
    wifi_tried = true;
    WiFiManager wifiManager;
    if (wifiManager.autoConnect("Costura Agil")) {
      on_wifi_connected();
    }
  }
  if (wifi_connected) {
    socketIO.loop();

    // Se conectado ao WS mas ainda não registrado (sem usuário vinculado), tenta novamente periodicamente
    if (wsConnected && !token_registrado) {
      if (millis() - lastCheckTime > checkInterval) {
        lastCheckTime = millis();
        registerDevice();
      }
    }

    // Envia um sinal de "keep-alive" para manter a conexão aberta em proxies
    if (wsConnected) {
      if (millis() - lastKeepAliveTime > keepAliveInterval) {
        lastKeepAliveTime = millis();
        sendKeepAlive();
      }
    }

    // Solicita atualização de artigos em tempo real quando na tela de operação
    if (wsConnected && login_ok && currentScreen == "operacao") {
      if (millis() - lastUpdateCheckTime > updateCheckInterval) {
        lastUpdateCheckTime = millis();
        solicitarArtigosAtualizados();
      }
    }
    
    // Atualizar informações da tela de configuração quando estiver nela
    static unsigned long lastConfigUpdateTime = 0;
    const unsigned long configUpdateInterval = 1000; // 1 segundo
    if (currentScreen == "config") {
      if (millis() - lastConfigUpdateTime > configUpdateInterval) {
        lastConfigUpdateTime = millis();
        atualizarInfoConfig();
      }
    }
  }
  
  lv_timer_handler();
  
  // Leitura do botão com debounce simples
  static int lastButtonState = HIGH;
  static unsigned long lastDebounceTime = 0;
  static int previousButtonState = HIGH; // Estado anterior do botão
  int reading = digitalRead(BUTTON_PIN);

  if (reading != lastButtonState) {
    lastDebounceTime = millis();
  }

  if ((millis() - lastDebounceTime) > 70) {
    static int buttonState = HIGH;
    if (reading != buttonState) {
      buttonState = reading;
      if (buttonState == LOW) {
        Serial.println("� Botão pressionado!");
      } else if (buttonState == HIGH && previousButtonState == LOW) {
        Serial.println("� Botão solto!");
        sendProductionData();
      }
      previousButtonState = buttonState;
    }
  }
  lastButtonState = reading;
  
  delay(5);
}

// -----------------------------------------------------------------------------
// NOVA TELA BASE
// -----------------------------------------------------------------------------
lv_obj_t * new_screen(lv_obj_t * base, bool use_gradient = false) {
  lv_obj_t * obj = lv_obj_create(base);

  if (use_gradient) {
    lv_obj_set_style_bg_opa(obj, LV_OPA_COVER, LV_PART_MAIN);
    lv_obj_set_style_bg_color(obj, lv_color_hex(0x1A3D6B), 0);
    lv_obj_set_style_bg_grad_color(obj, lv_color_hex(0xEA824D), 0);
    lv_obj_set_style_bg_grad_dir(obj, LV_GRAD_DIR_VER, 0);
  } else {
    // Fundo transparente real
    lv_obj_set_style_bg_grad_color(obj, lv_color_hex(0xFFFFFF), 0);
  }
  lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_style_border_width(obj, 0, 0);

  // Layout padrão = coluna centralizada
  lv_obj_set_layout(obj, LV_LAYOUT_FLEX);
  lv_obj_set_flex_flow(obj, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_flex_align(obj,
    LV_FLEX_ALIGN_CENTER,
    LV_FLEX_ALIGN_CENTER,
    LV_FLEX_ALIGN_CENTER);

  lv_obj_set_style_pad_top(obj,    5, LV_PART_MAIN);
  lv_obj_set_style_pad_bottom(obj, 5, LV_PART_MAIN);
  lv_obj_set_style_pad_row(obj,   10, LV_PART_MAIN);
  return obj;
}


#if defined(ESP32)
  #include <FS.h>
  using FS = fs::FS;
#endif

#include <LVGL_CYD.h>
#include "dashboard.h"
#include "login.h"
#include "home.h"
#include "token.h"
#include "artigo.h"
#include "config.h"
#include "calibracao.h"
#include "ativacao.h"
#include "IntegracaoSensorRFID.h"
#include "revisao_rfid.h"

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
bool calibracaoConcluida = false;
bool sensorToFInicializado = false;
// true apenas durante o boot quando ja existe um token salvo.
// Nesse caso nao mostramos a tela de token antes da API confirmar o vinculo.
bool aguardandoValidacaoTokenBoot = false;

// Controle de tentativas de registro
unsigned long lastCheckTime = 0;
const unsigned long checkInterval = 1000;

// Controle de keep-alive
unsigned long lastKeepAliveTime = 0;
const unsigned long keepAliveInterval = 30000; // 30 segundos

// Controle de atualizações em tempo real da tela de artigo
unsigned long lastUpdateCheckTime = 0;
const unsigned long updateCheckInterval = 10000; // 10 segundos
String currentScreen = ""; // Rastreia tela atual

// ---- Config servidor ----
const char* host = "monitor-ellas-backend.onrender.com"; // mesmo backend do dispositivo funcional
uint16_t port = 443;                                  // HTTPS/WSS em producao
bool useSSL = true;                                   // TLS habilitado
const char* socketPath = "/socket.io/?EIO=4";

// ---- Dispositivo ----
String deviceToken = ""; // gerado apos ativacao PIX e salvo em Preferences

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
    
    // FLUXO DE INICIALIZACAO:
    // 1) Sem token: abre ativacao PIX.
    // 2) Com token salvo: NAO mostra a tela do token no boot. Mantem a tela
    //    inicial enquanto conecta ao Socket.IO e valida o token na API.
    //    Se a API confirmar o vinculo, vai direto para calibracao.
    //    Se ainda nao estiver vinculado, ai sim mostra o token para cadastro.
    if (ativacao_token_salvo()) {
      ativacao_carregar_token();
      aguardandoValidacaoTokenBoot = true;
      Serial.printf("[BOOT] Token salvo encontrado: %s. Validando na API...\n", deviceToken.c_str());
    } else {
      aguardandoValidacaoTokenBoot = false;
      go_ativacao();
    }
    lv_timer_handler();

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

void continuarFluxoAposCalibracao() {
  if (!calibracaoConcluida) return;

  if (login_ok && funcionarioSenha.length() > 0) {
    // Refaz o login no backend somente depois da calibracao. A resposta
    // loginSuccess restaura Artigo/Dashboard corretamente.
    go_login();
    if (wsConnected) loginFuncionario(funcionarioSenha.c_str());
    return;
  }

  if (token_registrado) {
    go_login();
  } else if (deviceToken.length() == 15) {
    go_token();
  } else {
    go_ativacao();
  }
}

// Simulação: chamar esta função quando backend responder que token foi registrado
void on_token_registrado() {
    token_registrado = true;

    // O dispositivo ja foi ativado e vinculado na API. Agora a calibracao
    // e obrigatoria antes do login/operacao.
    go_calibracao();
    lv_timer_handler();

    if (!sensorToFInicializado) {
      sensorToFInicializado = IntegracaoSensorRFID::iniciar(beepSensor, servicoDuranteCalibracao);
      if (!sensorToFInicializado) {
        Serial.println("[VL53L5CX] ERRO: sensor nao inicializado.");
        atualizar_calibracao_status("Sensor VL53L5CX nao encontrado.\nVerifique SDA=27 e SCL=22.", false);
      } else {
        atualizar_calibracao_status("Sensor pronto para calibracao.", true);
      }
    }
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
    show_artigo_message("Nenhum artigo salvo");
    return;
  }
  
  DynamicJsonDocument doc(4096);
  DeserializationError err = deserializeJson(doc, artigosJson);
  if (err) {
    Serial.printf("[JSON] Erro ao carregar artigos salvos: %s\n", err.c_str());
    show_artigo_message("Erro ao carregar artigos");
    return;
  }
  
  JsonArray artigos = doc.as<JsonArray>();
  Serial.printf("Carregando %d artigos salvos\n", artigos.size());
  
  for (size_t i = 0; i < artigos.size(); i++) {
    const char* artId = artigos[i]["_id"];
    const char* artNome = artigos[i]["nome"];
    int artMeta = artigos[i]["quantidade"];
    
    add_artigo_to_list(artId, artNome, artMeta);
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
      // O re-login acontece somente apos ativacao/vinculo e calibracao.
      // Nao enviar login aqui para evitar pular o novo fluxo inicial.
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
    if (token != deviceToken) {
      Serial.printf("Ignorando deviceRegistered para outro token: %s\n", token.c_str());
      return;
    }

    bool success = doc["success"];
    String message = doc["message"];
    bool usuarioVinculado = doc["data"]["usuarioVinculado"] | false;

    Serial.printf("[deviceRegistered] Success: %d, Vinculado: %d, Message: %s\n", success, usuarioVinculado, message.c_str());
    
    if (success && usuarioVinculado) {
      // Tanto no primeiro vinculo quanto nos proximos boots, uma confirmacao
      // positiva da API libera imediatamente a calibracao.
      aguardandoValidacaoTokenBoot = false;
      on_token_registrado();
    } else {
      Serial.println("Dispositivo possui token, mas ainda nao esta vinculado a um usuario.");

      // Durante o boot evitamos mostrar o token antes de consultar a API.
      // Se a consulta confirmar que ainda falta o vinculo, mostramos a tela
      // com o token para que o usuario possa cadastra-lo no sistema web.
      aguardandoValidacaoTokenBoot = false;
      if (deviceToken.length() == 15 && currentScreen != "token") {
        go_token();
        lv_timer_handler();
      }
    }
  } else if (type == "loginSuccess") {
    String token = doc["data"]["deviceToken"] | "";
    if (token != deviceToken) return;

    String nome = doc["data"]["funcionario"]["nome"];
    funcionarioNome = nome;
    Serial.printf("[loginSuccess] 👤 %s logado!\n", nome.c_str());
    
    login_ok = true;
    saveLoginState();
    
    // O arco nao usa a lista generica retornada pelo loginSuccess.
    // Solicita exclusivamente artigos RFID prontos para revisao.
    artigo_selecionado = false;
    revisaoRFID_limparArtigo();
    go_artigo();
    clear_artigo_list();
    show_artigo_message("Carregando artigos RFID...");
    solicitarArtigosRFID();
  } else if (type == "artigoSelecionado") {
    String token = doc["data"]["deviceToken"] | "";
    if (token != deviceToken) {
      Serial.printf("⚠️ Token inválido em artigoSelecionado. Recebido: '%s', Esperado: '%s'\n", token.c_str(), deviceToken.c_str());
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
    if (token != deviceToken) return;
    Serial.println("[producaoSuccess] Produção registrada!");
    
    // Atualizar a tela artigo em tempo real se estiver visualizando
    if (currentScreen == "artigo") {
      int quantidadeAtual = doc["data"]["quantidade"] | 0;
      const char* artigoIdResp = doc["data"]["artigoId"].as<const char*>();
      const char* artigoNomeResp = doc["data"]["artigoNome"].as<const char*>();
      int metaResp = doc["data"]["meta"] | 0;
      
      if (artigoIdResp && artigoNomeResp && metaResp > 0) {
        update_artigo_quantities(artigoIdResp, quantidadeAtual, metaResp);
        Serial.printf("🎯 Tela artigo atualizada: %s (%d/%d)\n", artigoNomeResp, quantidadeAtual, metaResp);
      }
    }
  } else if (type == "artigosAtualizados") {
    // Atualização em tempo real da lista de artigos na tela de operação
    String token = doc["data"]["deviceToken"] | "";
    if (token != deviceToken) return;

    Serial.println("[artigosAtualizados] 🔄 Atualizando lista de artigos...");
    
    clear_artigo_list(); // Limpar lista anterior
    
    if (doc["data"].containsKey("artigos") && doc["data"]["artigos"].is<JsonArray>()) {
      JsonArray artigos = doc["data"]["artigos"].as<JsonArray>();
      Serial.printf("Artigos atualizados: %d\n", artigos.size());

      if (artigos.size() == 0) {
        show_artigo_message("Nenhum artigo disponível");
      }

      for (size_t i = 0; i < artigos.size(); i++) {
        const char* artId = artigos[i]["_id"].as<const char*>();
        const char* artNome = artigos[i]["nome"].as<const char*>();
        int artMeta = artigos[i]["quantidade"].as<int>();
        
        Serial.printf("[%d] %s (meta: %d)\n", (int)(i+1), artNome, artMeta);
        add_artigo_to_list(artId, artNome, artMeta);
      }
      
      // Salvar artigos atualizados localmente
      String artigosJson;
      serializeJson(artigos, artigosJson);
      saveArtigos(artigosJson);
    } else {
      Serial.println("⚠️ Erro: Campo 'artigos' não encontrado em artigosAtualizados!");
    }
  } else if (type == "artigosRFIDAtualizados") {
    clear_artigo_list();

    bool success = doc["success"] | false;
    if (!success) {
      show_artigo_message("Nenhum artigo RFID disponivel");
      return;
    }

    JsonArray artigos = doc["data"]["artigos"].as<JsonArray>();
    Serial.printf("[RFID] Artigos prontos para revisao: %u\n", (unsigned)artigos.size());

    if (artigos.size() == 0) {
      show_artigo_message("Nenhum artigo RFID pronto");
    }

    for (JsonObject art : artigos) {
      String id = art["_id"].as<String>();
      String nome = art["nome"].as<String>();
      int total = art["quantidade"] | 0;
      int revisadas = art["revisadas"] | 0;

      update_artigo_quantities(id.c_str(), revisadas, total);
      add_artigo_to_list(id.c_str(), nome.c_str(), total);
    }
  } else if (type == "artigoRFIDSelecionado") {
    bool success = doc["success"] | false;
    if (!success) {
      show_artigo_message(doc["message"] | "Artigo RFID invalido");
      return;
    }

    JsonObject art = doc["data"]["artigo"];

    artigoId = art["_id"].as<String>();
    artigoNome = art["nome"].as<String>();
    metaArtigo = art["quantidade"] | 0;
    quantidade = doc["data"]["revisadas"] | 0;
    artigo_selecionado = true;

    revisaoRFID_definirArtigo(
      artigoId,
      art["codigo"].as<String>(),
      artigoNome,
      metaArtigo,
      quantidade
    );
  } else if (type == "epcRFIDValidado") {
    revisaoRFID_onValidacao(doc["resultado"].as<String>());
  } else if (type == "revisaoRFIDConfirmada") {
    revisaoRFID_onConfirmacao(
      doc["success"] | false,
      doc["resultado"].as<String>(),
      doc["revisadas"] | quantidade,
      doc["total"] | metaArtigo
    );

    if ((doc["success"] | false) && doc["resultado"].as<String>() == "aprovada") {
      quantidade = doc["revisadas"] | quantidade;
    }
  } else if (type == "loginFailed" || type == "error") {
    String message = doc["message"];
    Serial.printf("[Erro] ❌ %s\n", message.c_str());
    // Exibir erro na tela de login
    extern void show_login_error(const char* msg);
    show_login_error(message.c_str());
  } else if (type == "sensorData") {
    String token = doc["data"]["deviceToken"] | "";
    if (token != deviceToken) return;

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
  if (deviceToken.length() != 15) {
    Serial.println("[DEVICE] Token ainda nao gerado; registro adiado.");
    return;
  }
  DynamicJsonDocument doc(1024);
  JsonArray array = doc.to<JsonArray>();
  array.add("registerDevice");
  JsonObject param = array.createNestedObject();
  param["deviceToken"] = deviceToken;
  param["deviceType"] = "revisao_rfid";
  
  String json; serializeJson(doc, json);
  socketIO.sendEVENT(json);
  Serial.printf("➡️ Registrando dispositivo de revisao RFID: %s\n", deviceToken.c_str());
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

void solicitarArtigosRFID() {
  DynamicJsonDocument doc(256);
  JsonArray array = doc.to<JsonArray>();
  array.add("solicitarArtigosRFID");
  JsonObject param = array.createNestedObject();
  param["deviceToken"] = deviceToken;

  String json;
  serializeJson(doc, json);
  socketIO.sendEVENT(json);
  Serial.println("➡️ Solicitando artigos RFID prontos");
}

void enviarSelecaoArtigoRFID(const char* id) {
  DynamicJsonDocument doc(256);
  JsonArray array = doc.to<JsonArray>();
  array.add("selecionarArtigoRFID");
  JsonObject param = array.createNestedObject();
  param["deviceToken"] = deviceToken;
  param["artigoId"] = id;

  String json;
  serializeJson(doc, json);
  socketIO.sendEVENT(json);
  Serial.printf("➡️ Selecionando artigo RFID: %s\n", id);
}

void enviarValidacaoEpcRFID(const String& id, const String& epc) {
  DynamicJsonDocument doc(384);
  JsonArray array = doc.to<JsonArray>();
  array.add("validarEpcRFID");
  JsonObject param = array.createNestedObject();
  param["deviceToken"] = deviceToken;
  param["artigoId"] = id;
  param["epc"] = epc;

  String json;
  serializeJson(doc, json);
  socketIO.sendEVENT(json);
  Serial.printf("➡️ Validando EPC %s\n", epc.c_str());
}

void confirmarRevisaoEpcRFID(const String& id, const String& epc) {
  DynamicJsonDocument doc(384);
  JsonArray array = doc.to<JsonArray>();
  array.add("confirmarRevisaoRFID");
  JsonObject param = array.createNestedObject();
  param["deviceToken"] = deviceToken;
  param["artigoId"] = id;
  param["epc"] = epc;

  String json;
  serializeJson(doc, json);
  socketIO.sendEVENT(json);
  Serial.printf("➡️ Confirmando revisao EPC %s\n", epc.c_str());
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
    
    // Voltar para tela de artigo
    currentScreen = "artigo";
    go_artigo();
    
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
  revisaoRFID_limparArtigo();
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
    lv_label_set_text_fmt(lbl_device_token, "Token: %s", deviceToken.c_str());
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

void beepSensor(int quantidade) {
  // Mantém o comportamento do projeto RFID. Pode ser substituído por buzzer GPIO.
  for (int i = 0; i < quantidade; i++) {
    Serial.println("BEEP");
    delay(120);
  }
}

void servicoDuranteCalibracao() {
  // A rotina de calibração é bloqueante, então mantemos LVGL e Socket.IO vivos.
  lv_timer_handler();
  if (wifi_connected) {
    socketIO.loop();
    ativacao_loop();
  }
}

// -----------------------------------------------------------------------------
// SETUP
// -----------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  LVGL_CYD::begin(SCREEN_ORIENTATION);

  // O VL53L5CX será inicializado somente depois que a interface e o Wi-Fi
  // estiverem ativos. Isso evita interferência na subida do display.

  // Carregar token permanente de ativacao e demais estados persistidos
  ativacao_carregar_token();
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

  // RFID UHF: usa o mesmo driver e configuracao validados no projeto base.
  revisaoRFID_begin();
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
    ativacao_loop();

    // Se conectado ao WS mas ainda nao registrado/vinculado, tenta novamente periodicamente.
    // No boot com token salvo isso valida silenciosamente antes de mostrar qualquer tela de token.
    if (wsConnected && !token_registrado && deviceToken.length() == 15) {
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

    // Solicita atualização de artigos em tempo real quando na tela de artigo
    if (wsConnected && login_ok && currentScreen == "artigo") {
      if (millis() - lastUpdateCheckTime > updateCheckInterval) {
        lastUpdateCheckTime = millis();
        solicitarArtigosRFID();
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
  
  // Atualiza continuamente sensor de presenca e leitor UHF.
  revisaoRFID_atualizar();

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
        Serial.println("Botao solto - sem acao na revisao RFID.");
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

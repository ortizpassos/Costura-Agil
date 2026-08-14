/*
 * COSTURA ÁGIL
 * ESP32 LEITOR DE CADASTRO RFID - SEM DISPLAY
 *
 * Hardware:
 *   ESP32
 *   YRM1001 UHF
 *   LED indicador
 *
 * RFID:
 *   RX ESP32 = GPIO16  <- TX do YRM1001
 *   TX ESP32 = GPIO17  -> RX do YRM1001
 *   Baud = 115200
 *
 * Fluxo:
 *  1. WiFiManager configura Wi-Fi.
 *  2. Portal mostra o Device ID.
 *  3. ESP32 conecta ao backend Socket.IO.
 *  4. Sem token: registerHardware(deviceId).
 *  5. Usuário ativa pelo frontend via PIX.
 *  6. Backend envia hardwareLinked + deviceToken.
 *  7. ESP32 salva token permanentemente em Preferences.
 *  8. Aguarda iniciarCadastroRFID.
 *  9. YRM1001 lê EPCs e envia epcCadastroRFID.
 *
 * IMPORTANTE:
 * A deduplicação definitiva é feita no backend.
 * O ESP32 usa somente uma pequena janela local para evitar
 * inundar a rede com a mesma etiqueta repetida.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <SocketIOclient.h>
#include <ArduinoJson.h>
#include <Preferences.h>

// ============================================================
// CONFIGURAÇÕES
// ============================================================

#define FIRMWARE_VERSION "1.0.0"

#define RFID_RX 16
#define RFID_TX 17

#define LED_PIN 2

// Botão BOOT do ESP32.
// Segurar por 8 segundos apaga SOMENTE o Wi-Fi.
// O token/licença NÃO é apagado.
#define WIFI_RESET_BUTTON 0

#define RFID_BAUD 115200

// Região e potência já usadas no projeto validado.
#define RFID_REGION 0x01
#define RFID_POWER_CENTIDBM 3000

// Renovação do inventário.
#define INVENTORY_INTERVAL_MS 100

// Evita enviar o mesmo EPC dezenas de vezes por segundo.
// O backend continua sendo a autoridade contra duplicidade.
#define LOCAL_DUPLICATE_WINDOW_MS 1500
#define RECENT_EPC_CACHE_SIZE 64

// Backend de produção
const char* BACKEND_HOST =
  "monitor-ellas-backend.onrender.com";

const uint16_t BACKEND_PORT = 443;

const char* SOCKET_PATH =
  "/socket.io/?EIO=4";

const bool USE_SSL = true;

// ============================================================
// GLOBAIS
// ============================================================

HardwareSerial RFID(2);
SocketIOclient socketIO;
Preferences prefs;

String deviceId;
String deviceToken;

bool wifiConnected = false;
bool socketConnected = false;
bool hardwareLinked = false;

bool scanActive = false;

String artigoIdAtual;
String artigoCodigoAtual;
String sessionIdAtual;

uint32_t quantidadeEsperada = 0;
uint32_t quantidadeCadastrada = 0;

// ============================================================
// ESTADO DO LED
// ============================================================

enum class LedState : uint8_t {
  WIFI_CONFIG,
  SOCKET_CONNECTING,
  WAITING_ACTIVATION,
  READY,
  SCANNING,
  ERROR_STATE
};

LedState ledState =
  LedState::WIFI_CONFIG;

bool ledLogical = false;
unsigned long lastLedToggle = 0;

// Flash curto ao detectar EPC.
unsigned long readFlashUntil = 0;

// ============================================================
// CACHE LOCAL DE REPETIÇÃO
// ============================================================

struct RecentEpc {
  uint32_t hash = 0;
  unsigned long lastSeen = 0;
};

RecentEpc recentEpcs[
  RECENT_EPC_CACHE_SIZE
];

uint8_t recentIndex = 0;

// ============================================================
// PARSER RFID
// ============================================================

constexpr uint8_t FRAME_HEAD = 0xBB;
constexpr uint8_t FRAME_TAIL = 0x7E;

constexpr size_t RFID_FRAME_MAX = 128;

uint8_t rfidFrame[RFID_FRAME_MAX];
size_t rfidFrameLen = 0;
bool receivingRfidFrame = false;

unsigned long lastInventoryCommand = 0;

// ============================================================
// PROTÓTIPOS
// ============================================================

void socketIOEvent(
  socketIOmessageType_t type,
  uint8_t* payload,
  size_t length
);

void registerHardware();
void sendHardwareHeartbeat();

void startRfidScan(JsonObject data);
void stopRfidScan(const char* reason);

void sendEpcToBackend(
  const String& epc,
  int8_t rssi
);

// ============================================================
// UTILITÁRIOS
// ============================================================

String buildDeviceId() {
  const uint64_t mac =
    ESP.getEfuseMac();

  char buffer[24];

  // Usa todos os 48 bits do eFuse/MAC.
  snprintf(
    buffer,
    sizeof(buffer),
    "RFID-%04X%08X",
    static_cast<uint16_t>(
      mac >> 32
    ),
    static_cast<uint32_t>(
      mac & 0xFFFFFFFFULL
    )
  );

  String id(buffer);
  id.toUpperCase();

  return id;
}

String shortDeviceId() {
  if (deviceId.length() <= 6) {
    return deviceId;
  }

  return deviceId.substring(
    deviceId.length() - 6
  );
}

String epcToHex(
  const uint8_t* epc,
  uint8_t len
) {
  String result;

  result.reserve(
    static_cast<size_t>(len) * 2
  );

  for (
    uint8_t i = 0;
    i < len;
    i++
  ) {
    if (epc[i] < 0x10) {
      result += '0';
    }

    result +=
      String(epc[i], HEX);
  }

  result.toUpperCase();

  return result;
}

uint32_t fnv1aHash(
  const char* text
) {
  uint32_t hash =
    2166136261UL;

  while (*text) {
    hash ^=
      static_cast<uint8_t>(*text++);

    hash *=
      16777619UL;
  }

  return hash;
}

bool isLocalDuplicate(
  const String& epc
) {
  const uint32_t hash =
    fnv1aHash(epc.c_str());

  const unsigned long now =
    millis();

  for (
    uint8_t i = 0;
    i < RECENT_EPC_CACHE_SIZE;
    i++
  ) {
    if (
      recentEpcs[i].hash == hash &&
      now - recentEpcs[i].lastSeen <
        LOCAL_DUPLICATE_WINDOW_MS
    ) {
      recentEpcs[i].lastSeen =
        now;

      return true;
    }
  }

  recentEpcs[recentIndex].hash =
    hash;

  recentEpcs[recentIndex].lastSeen =
    now;

  recentIndex =
    (
      recentIndex + 1
    ) %
    RECENT_EPC_CACHE_SIZE;

  return false;
}

void clearRecentCache() {
  memset(
    recentEpcs,
    0,
    sizeof(recentEpcs)
  );

  recentIndex = 0;
}

// ============================================================
// LED
// ============================================================

void writeLed(bool on) {
  ledLogical = on;

  digitalWrite(
    LED_PIN,
    on ? HIGH : LOW
  );
}

void triggerReadFlash() {
  readFlashUntil =
    millis() + 90;
}

void updateLed() {
  const unsigned long now =
    millis();

  // Flash de leitura tem prioridade.
  if (
    readFlashUntil != 0 &&
    static_cast<long>(
      readFlashUntil - now
    ) > 0
  ) {
    // Durante leitura deixamos o LED aceso forte.
    writeLed(true);
    return;
  }

  readFlashUntil = 0;

  unsigned long interval = 0;

  switch (ledState) {

    case LedState::WIFI_CONFIG:
      interval = 500;
      break;

    case LedState::SOCKET_CONNECTING:
      interval = 250;
      break;

    case LedState::WAITING_ACTIVATION:
      interval = 800;
      break;

    case LedState::READY:
      // Pronto = LED aceso continuamente.
      if (!ledLogical) {
        writeLed(true);
      }
      return;

    case LedState::SCANNING:
      interval = 120;
      break;

    case LedState::ERROR_STATE:
      interval = 100;
      break;
  }

  if (
    now - lastLedToggle >=
      interval
  ) {
    lastLedToggle = now;

    writeLed(!ledLogical);
  }
}

// ============================================================
// PREFERENCES / TOKEN
// ============================================================

void loadToken() {
  prefs.begin(
    "rfid-reader",
    true
  );

  deviceToken =
    prefs.getString(
      "deviceToken",
      ""
    );

  prefs.end();

  hardwareLinked =
    !deviceToken.isEmpty();

  Serial.printf(
    "[TOKEN] %s\n",
    hardwareLinked
      ? "Token encontrado na NVS."
      : "Ainda sem token."
  );
}

void saveToken(
  const String& token
) {
  if (token.isEmpty()) {
    return;
  }

  prefs.begin(
    "rfid-reader",
    false
  );

  prefs.putString(
    "deviceToken",
    token
  );

  prefs.end();

  deviceToken = token;
  hardwareLinked = true;

  Serial.printf(
    "[TOKEN] Token salvo: %s\n",
    deviceToken.c_str()
  );
}

void clearToken() {
  prefs.begin(
    "rfid-reader",
    false
  );

  prefs.remove(
    "deviceToken"
  );

  prefs.end();

  deviceToken = "";
  hardwareLinked = false;

  Serial.println(
    "[TOKEN] Token removido por desvinculação."
  );
}

// ============================================================
// WIFI
// ============================================================

void connectWiFi() {
  WiFi.mode(WIFI_STA);

  WiFiManager wm;

  // Não apaga credenciais em caso de falha.
  wm.setConnectTimeout(30);

  const String apName =
    "Leitor-RFID-" +
    shortDeviceId();

  String customHtml =
    "<div style='"
    "padding:12px;"
    "margin:12px 0;"
    "border:1px solid #ccc;"
    "border-radius:8px'>"
    "<b>Leitor RFID - Costura Agil</b><br>"
    "Device ID:<br>"
    "<span style='font-size:20px;font-weight:bold'>" +
    deviceId +
    "</span><br><br>"
    "Depois de conectar o Wi-Fi, acesse o sistema em "
    "<b>Dispositivos &gt; Ativar dispositivo</b> "
    "e informe este Device ID."
    "</div>";

  WiFiManagerParameter info(
    customHtml.c_str()
  );

  wm.addParameter(&info);

  Serial.println();
  Serial.println(
    "=========================================="
  );
  Serial.println(
    "     LEITOR RFID - CONFIGURACAO WIFI"
  );
  Serial.println(
    "=========================================="
  );

  Serial.printf(
    "Device ID: %s\n",
    deviceId.c_str()
  );

  Serial.printf(
    "AP: %s\n",
    apName.c_str()
  );

  ledState =
    LedState::WIFI_CONFIG;

  const bool ok =
    wm.autoConnect(
      apName.c_str()
    );

  if (!ok) {
    Serial.println(
      "[WiFi] Falha ao conectar. Reiniciando..."
    );

    ledState =
      LedState::ERROR_STATE;

    delay(3000);

    ESP.restart();
  }

  wifiConnected = true;

  Serial.println(
    "[WiFi] Conectado."
  );

  Serial.printf(
    "[WiFi] SSID: %s\n",
    WiFi.SSID().c_str()
  );

  Serial.printf(
    "[WiFi] IP: %s\n",
    WiFi.localIP()
      .toString()
      .c_str()
  );
}

// ============================================================
// SOCKET.IO
// ============================================================

String socketPayloadToString(
  uint8_t* payload,
  size_t length
) {
  String msg;

  msg.reserve(
    length + 1
  );

  for (
    size_t i = 0;
    i < length;
    i++
  ) {
    msg +=
      static_cast<char>(
        payload[i]
      );
  }

  return msg;
}

void sendEvent(
  const char* eventName,
  JsonObjectConst payload
) {
  if (!socketConnected) {
    return;
  }

  DynamicJsonDocument doc(1024);

  JsonArray array =
    doc.to<JsonArray>();

  array.add(eventName);

  JsonObject body =
    array.createNestedObject();

  for (
    JsonPairConst kv :
    payload
  ) {
    body[kv.key()] =
      kv.value();
  }

  String json;

  serializeJson(
    doc,
    json
  );

  socketIO.sendEVENT(
    json
  );
}

void registerHardware() {
  if (!socketConnected) {
    return;
  }

  DynamicJsonDocument payloadDoc(512);

  JsonObject data =
    payloadDoc.to<JsonObject>();

  data["deviceId"] =
    deviceId;

  data["deviceType"] =
    "cadastro_rfid";

  data["firmwareVersion"] =
    FIRMWARE_VERSION;

  if (!deviceToken.isEmpty()) {
    data["deviceToken"] =
      deviceToken;
  }

  sendEvent(
    "registerHardware",
    data
  );

  Serial.printf(
    "[IO] registerHardware: %s token=%s\n",
    deviceId.c_str(),
    deviceToken.isEmpty()
      ? "<sem token>"
      : deviceToken.c_str()
  );
}

void sendHardwareHeartbeat() {
  if (!socketConnected) {
    return;
  }

  DynamicJsonDocument payloadDoc(256);

  JsonObject data =
    payloadDoc.to<JsonObject>();

  data["deviceId"] =
    deviceId;

  data["millis"] =
    millis();

  sendEvent(
    "hardwareHeartbeat",
    data
  );
}

void connectSocket() {
  ledState =
    LedState::SOCKET_CONNECTING;

  if (USE_SSL) {
    socketIO.beginSSL(
      BACKEND_HOST,
      BACKEND_PORT,
      SOCKET_PATH
    );

    Serial.println(
      "[IO] Iniciando WSS."
    );
  } else {
    socketIO.begin(
      BACKEND_HOST,
      BACKEND_PORT,
      SOCKET_PATH
    );

    Serial.println(
      "[IO] Iniciando WS."
    );
  }

  socketIO.setReconnectInterval(
    5000
  );

  socketIO.onEvent(
    socketIOEvent
  );
}

// ============================================================
// RFID - COMANDOS BINÁRIOS
// ============================================================

void rfidSendRaw(
  const uint8_t* data,
  size_t len
) {
  RFID.write(
    data,
    len
  );
}

void configureRfid() {
  RFID.setRxBufferSize(
    2048
  );

  RFID.begin(
    RFID_BAUD,
    SERIAL_8N1,
    RFID_RX,
    RFID_TX
  );

  delay(500);

  while (RFID.available()) {
    RFID.read();
  }

  // SET REGION - China1 / região validada no projeto.
  const uint8_t cmdRegion[] = {
    0xBB,
    0x00,
    0x07,
    0x00,
    0x01,
    RFID_REGION,
    static_cast<uint8_t>(
      (
        0x00 +
        0x07 +
        0x00 +
        0x01 +
        RFID_REGION
      ) & 0xFF
    ),
    0x7E
  };

  rfidSendRaw(
    cmdRegion,
    sizeof(cmdRegion)
  );

  delay(100);

  const uint8_t powerHigh =
    static_cast<uint8_t>(
      RFID_POWER_CENTIDBM >>
      8
    );

  const uint8_t powerLow =
    static_cast<uint8_t>(
      RFID_POWER_CENTIDBM &
      0xFF
    );

  const uint8_t powerChecksum =
    static_cast<uint8_t>(
      (
        0x00 +
        0xB6 +
        0x00 +
        0x02 +
        powerHigh +
        powerLow
      ) & 0xFF
    );

  const uint8_t cmdPower[] = {
    0xBB,
    0x00,
    0xB6,
    0x00,
    0x02,
    powerHigh,
    powerLow,
    powerChecksum,
    0x7E
  };

  rfidSendRaw(
    cmdPower,
    sizeof(cmdPower)
  );

  delay(100);

  Serial.println(
    "[RFID] YRM1001 configurado."
  );

  Serial.printf(
    "[RFID] UART RX=%d TX=%d baud=%d potencia=%.2f dBm\n",
    RFID_RX,
    RFID_TX,
    RFID_BAUD,
    RFID_POWER_CENTIDBM /
      100.0f
  );
}

void sendInventoryCommand() {
  // Mesmo comando validado no projeto anterior:
  // BB 00 27 00 03 22 FF FF 4A 7E
  const uint8_t cmd[] = {
    0xBB,
    0x00,
    0x27,
    0x00,
    0x03,
    0x22,
    0xFF,
    0xFF,
    0x4A,
    0x7E
  };

  rfidSendRaw(
    cmd,
    sizeof(cmd)
  );

  lastInventoryCommand =
    millis();
}

void sendStopInventory() {
  // Frame 0x28 sem parâmetros.
  const uint8_t cmd[] = {
    0xBB,
    0x00,
    0x28,
    0x00,
    0x00,
    0x28,
    0x7E
  };

  rfidSendRaw(
    cmd,
    sizeof(cmd)
  );
}

void processRfidFrame() {
  if (!scanActive) {
    return;
  }

  // Mantém a interpretação já validada:
  // frame[1] = 0x02
  // frame[2] = 0x22
  // frame[4] = RSSI
  // frame[7] = início EPC
  // epcLen = frame total - 13
  if (rfidFrameLen < 13) {
    return;
  }

  if (
    rfidFrame[1] != 0x02 ||
    rfidFrame[2] != 0x22
  ) {
    return;
  }

  const int epcLen =
    static_cast<int>(
      rfidFrameLen
    ) - 13;

  if (
    epcLen <= 0 ||
    epcLen > 12
  ) {
    return;
  }

  const String epc =
    epcToHex(
      &rfidFrame[7],
      static_cast<uint8_t>(
        epcLen
      )
    );

  const int8_t rssi =
    static_cast<int8_t>(
      rfidFrame[4]
    );

  if (
    isLocalDuplicate(epc)
  ) {
    return;
  }

  Serial.printf(
    "[RFID] EPC: %s RSSI=%d dBm\n",
    epc.c_str(),
    rssi
  );

  triggerReadFlash();

  sendEpcToBackend(
    epc,
    rssi
  );
}

void updateRfidParser() {
  while (RFID.available()) {
    const uint8_t b =
      RFID.read();

    if (!receivingRfidFrame) {
      if (b == FRAME_HEAD) {
        receivingRfidFrame =
          true;

        rfidFrameLen = 0;

        rfidFrame[
          rfidFrameLen++
        ] = b;
      }

      continue;
    }

    if (
      rfidFrameLen >=
      RFID_FRAME_MAX
    ) {
      receivingRfidFrame =
        false;

      rfidFrameLen = 0;

      continue;
    }

    rfidFrame[
      rfidFrameLen++
    ] = b;

    if (b == FRAME_TAIL) {
      processRfidFrame();

      receivingRfidFrame =
        false;

      rfidFrameLen = 0;
    }
  }
}

void updateRfid() {
  updateRfidParser();

  if (!scanActive) {
    return;
  }

  const unsigned long now =
    millis();

  if (
    now -
      lastInventoryCommand >=
    INVENTORY_INTERVAL_MS
  ) {
    sendInventoryCommand();

    // Processa resposta que possa já ter chegado.
    updateRfidParser();
  }
}

// ============================================================
// SESSÃO DE CADASTRO RFID
// ============================================================

void startRfidScan(
  JsonObject data
) {
  if (!hardwareLinked) {
    Serial.println(
      "[CADASTRO] Ignorado: hardware ainda não ativado."
    );

    return;
  }

  const String artigoId =
    data["artigoId"] | "";

  if (artigoId.isEmpty()) {
    Serial.println(
      "[CADASTRO] iniciarCadastroRFID sem artigoId."
    );

    return;
  }

  artigoIdAtual =
    artigoId;

  artigoCodigoAtual =
    String(
      data["codigo"] | ""
    );

  sessionIdAtual =
    String(
      data["sessionId"] | ""
    );

  quantidadeEsperada =
    data["quantidade"] | 0;

  quantidadeCadastrada =
    data["jaCadastradas"] | 0;

  clearRecentCache();

  scanActive = true;

  lastInventoryCommand = 0;

  ledState =
    LedState::SCANNING;

  Serial.println();
  Serial.println(
    "========== CADASTRO RFID INICIADO =========="
  );

  Serial.printf(
    "Artigo ID: %s\n",
    artigoIdAtual.c_str()
  );

  Serial.printf(
    "Codigo: %s\n",
    artigoCodigoAtual.c_str()
  );

  Serial.printf(
    "Progresso: %lu / %lu\n",
    static_cast<unsigned long>(
      quantidadeCadastrada
    ),
    static_cast<unsigned long>(
      quantidadeEsperada
    )
  );

  Serial.println(
    "============================================"
  );

  sendInventoryCommand();
}

void stopRfidScan(
  const char* reason
) {
  if (scanActive) {
    sendStopInventory();
  }

  scanActive = false;

  artigoIdAtual = "";
  artigoCodigoAtual = "";
  sessionIdAtual = "";

  quantidadeEsperada = 0;
  quantidadeCadastrada = 0;

  clearRecentCache();

  ledState =
    hardwareLinked
      ? LedState::READY
      : LedState::WAITING_ACTIVATION;

  Serial.printf(
    "[CADASTRO] Leitura encerrada: %s\n",
    reason ? reason : ""
  );
}

void sendEpcToBackend(
  const String& epc,
  int8_t rssi
) {
  if (
    !socketConnected ||
    !scanActive ||
    artigoIdAtual.isEmpty()
  ) {
    return;
  }

  DynamicJsonDocument payloadDoc(
    512
  );

  JsonObject data =
    payloadDoc.to<JsonObject>();

  data["deviceId"] =
    deviceId;

  data["deviceToken"] =
    deviceToken;

  data["artigoId"] =
    artigoIdAtual;

  if (!sessionIdAtual.isEmpty()) {
    data["sessionId"] =
      sessionIdAtual;
  }

  data["epc"] =
    epc;

  data["rssi"] =
    rssi;

  sendEvent(
    "epcCadastroRFID",
    data
  );
}

// ============================================================
// EVENTOS RECEBIDOS
// ============================================================

void handleSocketEvent(
  const String& eventName,
  JsonObject data
) {
  Serial.printf(
    "[IO] Evento: %s\n",
    eventName.c_str()
  );

  // --------------------------------------------------------
  // Provisionamento
  // --------------------------------------------------------

  if (
    eventName ==
    "hardwareRegistered"
  ) {
    const bool success =
      data["success"] | false;

    if (!success) {
      Serial.printf(
        "[HW] Falha: %s\n",
        String(
          data["message"] | ""
        ).c_str()
      );

      ledState =
        LedState::ERROR_STATE;

      return;
    }

    const bool linked =
      data["linked"] | false;

    const String token =
      data["deviceToken"] | "";

    if (
      linked &&
      !token.isEmpty()
    ) {
      if (
        token !=
        deviceToken
      ) {
        saveToken(token);
      }

      hardwareLinked = true;

      ledState =
        LedState::READY;
    } else {
      hardwareLinked =
        false;

      ledState =
        LedState::WAITING_ACTIVATION;

      Serial.printf(
        "[HW] Aguardando ativacao. Device ID: %s\n",
        deviceId.c_str()
      );
    }

    return;
  }

  if (
    eventName ==
    "hardwareLinked"
  ) {
    const bool success =
      data["success"] | false;

    const String targetDeviceId =
      data["deviceId"] | "";

    if (
      !targetDeviceId.isEmpty() &&
      targetDeviceId !=
        deviceId
    ) {
      return;
    }

    const String token =
      data["deviceToken"] | "";

    if (
      success &&
      !token.isEmpty()
    ) {
      saveToken(token);

      hardwareLinked = true;

      ledState =
        LedState::READY;

      Serial.println(
        "[HW] Dispositivo ativado/vinculado."
      );
    }

    return;
  }

  if (
    eventName ==
    "hardwareUnlinked"
  ) {
    stopRfidScan(
      "hardware desvinculado"
    );

    clearToken();

    ledState =
      LedState::WAITING_ACTIVATION;

    Serial.println(
      "[HW] Licenca removida deste hardware."
    );

    return;
  }

  // --------------------------------------------------------
  // Cadastro RFID
  // --------------------------------------------------------

  if (
    eventName ==
    "iniciarCadastroRFID"
  ) {
    startRfidScan(data);
    return;
  }

  if (
    eventName ==
    "pararCadastroRFID"
  ) {
    stopRfidScan(
      "comando remoto"
    );

    return;
  }

  if (
    eventName ==
    "cadastroRFIDConcluido"
  ) {
    const String artigoId =
      data["artigoId"] | "";

    if (
      artigoId.isEmpty() ||
      artigoId ==
        artigoIdAtual
    ) {
      quantidadeCadastrada =
        data["etiquetasCadastradas"] |
        quantidadeCadastrada;

      Serial.printf(
        "[CADASTRO] CONCLUIDO: %lu / %lu\n",
        static_cast<unsigned long>(
          quantidadeCadastrada
        ),
        static_cast<unsigned long>(
          quantidadeEsperada
        )
      );

      stopRfidScan(
        "quantidade completa"
      );
    }

    return;
  }

  // Resultado individual opcional enviado pelo backend.
  if (
    eventName ==
    "epcCadastroRFIDResultado"
  ) {
    const bool accepted =
      data["accepted"] | false;

    const bool duplicate =
      data["duplicate"] | false;

    quantidadeCadastrada =
      data["etiquetasCadastradas"] |
      quantidadeCadastrada;

    quantidadeEsperada =
      data["quantidade"] |
      quantidadeEsperada;

    Serial.printf(
      "[CADASTRO] EPC %s | %lu/%lu%s\n",
      accepted
        ? "ACEITO"
        : "IGNORADO",
      static_cast<unsigned long>(
        quantidadeCadastrada
      ),
      static_cast<unsigned long>(
        quantidadeEsperada
      ),
      duplicate
        ? " | DUPLICADO"
        : ""
    );

    return;
  }
}

void socketIOEvent(
  socketIOmessageType_t type,
  uint8_t* payload,
  size_t length
) {
  switch (type) {

    case sIOtype_DISCONNECT:
      Serial.println(
        "[IO] Desconectado."
      );

      socketConnected = false;

      if (scanActive) {
        sendStopInventory();
      }

      ledState =
        LedState::SOCKET_CONNECTING;

      break;


    case sIOtype_CONNECT:
      Serial.printf(
        "[IO] Conectado a https://%s:%u\n",
        BACKEND_HOST,
        BACKEND_PORT
      );

      socketConnected = true;

      registerHardware();

      break;


    case sIOtype_EVENT: {
      const String msg =
        socketPayloadToString(
          payload,
          length
        );

      Serial.printf(
        "[IO] RX: %s\n",
        msg.c_str()
      );

      DynamicJsonDocument doc(
        4096
      );

      const DeserializationError err =
        deserializeJson(
          doc,
          msg
        );

      if (err) {
        Serial.printf(
          "[JSON] Erro: %s\n",
          err.c_str()
        );

        return;
      }

      // Socket.IO:
      // ["evento", {dados}]
      const String eventName =
        doc[0] | "";

      JsonObject data =
        doc[1].as<JsonObject>();

      if (eventName.isEmpty()) {
        return;
      }

      if (data.isNull()) {
        DynamicJsonDocument emptyDoc(
          32
        );

        JsonObject empty =
          emptyDoc.to<JsonObject>();

        handleSocketEvent(
          eventName,
          empty
        );
      } else {
        handleSocketEvent(
          eventName,
          data
        );
      }

      break;
    }


    case sIOtype_ACK:
      break;


    case sIOtype_ERROR:
      Serial.printf(
        "[IO] Erro Socket.IO (%u bytes)\n",
        static_cast<unsigned>(
          length
        )
      );

      break;


    case sIOtype_BINARY_EVENT:
    case sIOtype_BINARY_ACK:
      break;
  }
}

// ============================================================
// BOTÃO - RESET WIFI
// ============================================================

void updateWifiResetButton() {
  static bool pressing =
    false;

  static unsigned long pressedAt =
    0;

  const bool pressed =
    digitalRead(
      WIFI_RESET_BUTTON
    ) == LOW;

  if (
    pressed &&
    !pressing
  ) {
    pressing = true;
    pressedAt = millis();
  }

  if (
    !pressed &&
    pressing
  ) {
    pressing = false;
    pressedAt = 0;
  }

  if (
    pressing &&
    millis() - pressedAt >=
      8000
  ) {
    Serial.println(
      "[WiFi] Reset solicitado. Token sera preservado."
    );

    WiFiManager wm;

    wm.resetSettings();

    delay(500);

    ESP.restart();
  }
}

// ============================================================
// SETUP / LOOP
// ============================================================

void setup() {
  Serial.begin(115200);

  delay(300);

  pinMode(
    LED_PIN,
    OUTPUT
  );

  writeLed(false);

  pinMode(
    WIFI_RESET_BUTTON,
    INPUT_PULLUP
  );

  deviceId =
    buildDeviceId();

  Serial.println();
  Serial.println(
    "=========================================="
  );
  Serial.println(
    " COSTURA AGIL - LEITOR RFID SEM DISPLAY"
  );
  Serial.println(
    "=========================================="
  );

  Serial.printf(
    "Firmware: %s\n",
    FIRMWARE_VERSION
  );

  Serial.printf(
    "Device ID: %s\n",
    deviceId.c_str()
  );

  loadToken();

  configureRfid();

  connectWiFi();

  connectSocket();
}

void loop() {
  socketIO.loop();

  updateRfid();

  updateLed();

  updateWifiResetButton();

  static unsigned long lastHeartbeat =
    0;

  if (
    socketConnected &&
    millis() - lastHeartbeat >=
      30000
  ) {
    lastHeartbeat =
      millis();

    sendHardwareHeartbeat();
  }

  // Se Wi-Fi cair, o Socket.IO se reconecta após Wi-Fi voltar.
  if (
    WiFi.status() !=
      WL_CONNECTED
  ) {
    wifiConnected = false;

    if (scanActive) {
      sendStopInventory();
    }

    ledState =
      LedState::SOCKET_CONNECTING;
  } else {
    wifiConnected = true;
  }

  delay(1);
}

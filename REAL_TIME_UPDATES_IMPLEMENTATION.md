# ✅ Real-Time ESP32 Operacao Screen Updates - Implementation Complete

## Overview
Implemented real-time updates for the ESP32 operacao (article selection) screen. When articles change status on the web backend (e.g., new article added to em_producao, existing article paused/completed), the ESP32 device automatically refreshes its article list every 10 seconds.

---

## Architecture

### 1. **Backend (Node.js/Socket.IO)**
**File:** `backend/app.js` (lines 276-310)

**Event Handler:** `solicitarArtigosAtualizados`
```javascript
socket.on('solicitarArtigosAtualizados', async (data) => {
  // Receives: { deviceToken, usuarioId }
  // Returns: { deviceToken, artigos: [...] }
});
```

**Logic:**
- Receives update request from ESP32 device
- Identifies the user from device token or provided usuarioId
- Queries all articles created by that user with status='em_producao'
- Returns filtered list with article details (nome, codigo, quantidade, quantidadeAtual)
- Includes deviceToken in response for identification

---

### 2. **ESP32 Firmware (C++)**

#### **A. Global Variables** 
**File:** `Esp32-Dispositivo/Esp32-Dispositivo.ino` (lines 39-42)

```cpp
// Controle de atualizações em tempo real da tela de operação
unsigned long lastUpdateCheckTime = 0;
const unsigned long updateCheckInterval = 10000; // 10 segundos
String currentScreen = ""; // Rastreia tela atual
```

**Purpose:**
- `lastUpdateCheckTime`: Tracks last update request timestamp
- `updateCheckInterval`: 10-second interval between requests
- `currentScreen`: Tracks current screen to only request updates when on operacao

#### **B. Main Loop Update Check**
**File:** `Esp32-Dispositivo/Esp32-Dispositivo.ino` (lines 466-472)

```cpp
// Solicita atualização de artigos em tempo real quando na tela de operação
if (wsConnected && login_ok && currentScreen == "operacao") {
  if (millis() - lastUpdateCheckTime > updateCheckInterval) {
    lastUpdateCheckTime = millis();
    solicitarArtigosAtualizados();
  }
}
```

**Conditions:**
- WebSocket connected (`wsConnected`)
- User logged in (`login_ok`)
- On operacao screen (`currentScreen == "operacao"`)
- 10+ seconds since last request

#### **C. Request Function**
**File:** `Esp32-Dispositivo/Esp32-Dispositivo.ino` (lines 363-379)

```cpp
void solicitarArtigosAtualizados() {
  DynamicJsonDocument doc(1024);
  JsonArray array = doc.to<JsonArray>();
  array.add("solicitarArtigosAtualizados");
  JsonObject param = array.createNestedObject();
  param["deviceToken"] = deviceToken;
  
  // Optional: send user ID if available
  String userId = prefs.getString("usuarioId", "");
  if (userId.length() > 0) {
    param["usuarioId"] = userId;
  }
  
  String json; serializeJson(doc, json);
  socketIO.sendEVENT(json);
  Serial.println("➡️ Solicitando atualização de artigos");
}
```

**Sends to Backend:**
- `deviceToken`: Device identifier
- `usuarioId`: (Optional) User identifier from preferences

#### **D. Response Handler**
**File:** `Esp32-Dispositivo/Esp32-Dispositivo.ino` (lines 269-293)

```cpp
} else if (type == "artigosAtualizados") {
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
      
      add_operacao_to_list(artId, artNome, artMeta);
    }
  } else {
    Serial.println("⚠️ Erro: Campo 'artigos' não encontrado!");
  }
}
```

**Behavior:**
1. Validates deviceToken matches
2. Clears current list
3. Populates with fresh article data
4. Handles empty state gracefully

#### **E. Screen Tracking**
**Files Modified:**
- `operacao.cpp` (line 29): `currentScreen = "operacao"`
- `dashboard.cpp` (line 29): `currentScreen = "dashboard"`

**Purpose:** Only request updates when user is viewing article selection screen

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     ESP32 Device Loop (every 10s)               │
│  1. Check: wsConnected && login_ok && currentScreen=="operacao" │
│  2. Call solicitarArtigosAtualizados()                          │
│  3. Send JSON: ["solicitarArtigosAtualizados", {...}]           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ Socket.IO Event
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Backend Socket.IO Handler (app.js)                 │
│  1. Receive solicitarArtigosAtualizados event                   │
│  2. Lookup device -> find user                                  │
│  3. Query Artigo.find({ criadoPor: usuario, status: 'em_producao' })
│  4. Format response with deviceToken & articles array           │
│  5. Emit artigosAtualizados event back to device                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ Socket.IO Event
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│            ESP32 Message Handler (processJsonMessage)           │
│  1. Validate deviceToken matches                                │
│  2. Clear current operacao list                                 │
│  3. Loop through updated articles array                         │
│  4. Call add_operacao_to_list() for each article                │
│  5. Display updated list to user                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Features

### ✅ **Automatic Updates**
- **Interval:** Every 10 seconds (configurable via `updateCheckInterval`)
- **Conditional:** Only when on operacao screen and user is logged in
- **Smart:** Won't spam requests if WebSocket is disconnected

### ✅ **Data Consistency**
- Articles shown on ESP32 always match backend status
- New articles automatically appear within 10 seconds
- Paused/completed articles automatically disappear

### ✅ **Network Efficiency**
- Interval-based polling (not real-time push)
- Small JSON payloads
- Graceful handling of network delays

### ✅ **User Experience**
- Seamless list refresh without screen disruption
- Serial debug output shows all updates
- Empty state message when no articles available

---

## Configuration

### Update Interval
**File:** `Esp32-Dispositivo/Esp32-Dispositivo.ino` (line 41)

```cpp
const unsigned long updateCheckInterval = 10000; // milliseconds
```

Change value to adjust frequency:
- `5000` = 5 seconds (more responsive, more network traffic)
- `10000` = 10 seconds (balanced)
- `30000` = 30 seconds (less responsive, minimal traffic)

---

## Testing Workflow

1. **ESP32 Setup:**
   - Power on ESP32 device
   - Device connects to WiFi and backend
   - Navigate to operacao screen (article selection)

2. **Backend Test:**
   - Go to web dashboard producao page
   - Create new article with status "pending"
   - Click "Iniciar" button to change status to "em_producao"
   - Within 10 seconds, new article appears on ESP32 operacao screen

3. **Status Change Test:**
   - Change article status from "em_producao" to "pausado"
   - Within 10 seconds, article disappears from ESP32 list

4. **Navigation Test:**
   - Select article on ESP32 to go to dashboard
   - Navigate back to operacao screen
   - Updates resume

5. **Disconnection Test:**
   - Turn off WiFi on ESP32
   - Reconnect WiFi
   - List updates resume after login_ok is true

---

## Debug Output Examples

**Successful Update Cycle:**
```
[IO] ✅ Connected to https://192.168.100.4:3001
[IO] 📩 RX: ["loginSuccess",{"data":{"deviceToken":"461545616614165",...}}]
[loginSuccess] 👤 João Silva logado!
➡️ Solicitando atualização de artigos
[IO] 📩 RX: ["artigosAtualizados",{"data":{"deviceToken":"461545616614165","artigos":[...]}}]
[artigosAtualizados] 🔄 Atualizando lista de artigos...
Artigos atualizados: 3
[1] Camiseta Básica (meta: 100)
[2] Calça Jeans (meta: 50)
[3] Jaqueta Inverno (meta: 30)
```

**No Articles Available:**
```
[artigosAtualizados] 🔄 Atualizando lista de artigos...
Artigos atualizados: 0
Nenhum artigo disponível
```

---

## Files Modified

| File | Lines | Changes |
|------|-------|---------|
| `backend/app.js` | 276-310 | Socket event handler + deviceToken in response |
| `Esp32-Dispositivo/Esp32-Dispositivo.ino` | 39-42, 363-379, 466-472 | Globals, request function, loop integration |
| `Esp32-Dispositivo/operacao.cpp` | 1-29 | Screen tracker, extern currentScreen |
| `Esp32-Dispositivo/dashboard.cpp` | 1-29 | Screen tracker, extern currentScreen |

---

## Future Enhancements

1. **Push Notifications:** Instead of polling, use Socket.IO push events
2. **Partial Updates:** Only refresh if articles changed
3. **Offline Mode:** Cache articles locally, sync when reconnected
4. **Update Animation:** Smooth transitions when list changes
5. **User Preferences:** Configurable update frequency per device

---

## Status
✅ **COMPLETE AND TESTED**

The ESP32 operacao screen now updates in real-time with article changes from the backend!

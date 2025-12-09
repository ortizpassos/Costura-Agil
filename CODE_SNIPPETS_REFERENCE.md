# 📋 Code Snippets Reference

## Quick Copy-Paste Reference

### 1. Backend Handler (Complete)

**File:** `backend/app.js` (insert at line 276)

```javascript
// Evento para atualizar lista de artigos em tempo real
socket.on('solicitarArtigosAtualizados', async (data) => {
  // data: { deviceToken, usuarioId }
  const Dispositivo = require('./models/Dispositivo');
  
  let usuario = data.usuarioId;
  const deviceToken = data.deviceToken;
  
  if (!usuario && deviceToken) {
    const dispositivo = await Dispositivo.findOne({ deviceToken: deviceToken });
    usuario = dispositivo?.usuario;
  }
  
  if (!usuario) {
    socket.emit('artigosAtualizados', { 
      deviceToken: deviceToken,
      artigos: [] 
    });
    return;
  }
  
  // Buscar artigos em produção
  const artigos = await Artigo.find({ 
    criadoPor: usuario, 
    status: 'em_producao'
  }).sort({ nome: 1 });
  
  socket.emit('artigosAtualizados', {
    deviceToken: deviceToken,
    artigos: artigos.map(art => ({
      _id: art._id,
      nome: art.nome,
      codigo: art.codigo,
      quantidade: art.quantidade,
      quantidadeAtual: art.quantidadeAtual || 0,
      status: art.status
    }))
  });
});
```

---

### 2. ESP32 Global Variables

**File:** `Esp32-Dispositivo/Esp32-Dispositivo.ino` (lines 39-42)

```cpp
// Controle de atualizações em tempo real da tela de operação
unsigned long lastUpdateCheckTime = 0;
const unsigned long updateCheckInterval = 10000; // 10 segundos
String currentScreen = ""; // Rastreia tela atual
```

---

### 3. ESP32 Request Function

**File:** `Esp32-Dispositivo/Esp32-Dispositivo.ino` (lines 363-379)

```cpp
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
```

---

### 4. ESP32 Response Handler

**File:** `Esp32-Dispositivo/Esp32-Dispositivo.ino` (lines 272-293)

```cpp
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
  } else {
    Serial.println("⚠️ Erro: Campo 'artigos' não encontrado em artigosAtualizados!");
  }
}
```

---

### 5. ESP32 Main Loop Update

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

---

### 6. Operacao Screen Update

**File:** `Esp32-Dispositivo/operacao.cpp` (lines 1-6, 29)

```cpp
#include "operacao.h"
#include "font/lv_font.h"
#include <cstring>


extern void enviarSelecaoArtigo(const char* id);
extern String currentScreen; // Variável global para rastrear tela atual

// ... other code ...

void go_operacao() {
    currentScreen = "operacao"; // Marca que estamos na tela de operação
    // ... rest of function ...
}
```

---

### 7. Dashboard Screen Update

**File:** `Esp32-Dispositivo/dashboard.cpp` (lines 1-3, 29)

```cpp
#include "dashboard.h"

extern String currentScreen; // Variável global para rastrear tela atual

// ... other code ...

void go_dashboard() {
    currentScreen = "dashboard"; // Marca que estamos na tela de dashboard
    // ... rest of function ...
}
```

---

## Common Tasks

### How to Change Update Interval

**Current:** 10 seconds
**File:** `Esp32-Dispositivo/Esp32-Dispositivo.ino` line 40

```cpp
// Change from:
const unsigned long updateCheckInterval = 10000; // 10 segundos

// To:
const unsigned long updateCheckInterval = 5000; // 5 segundos (faster)
const unsigned long updateCheckInterval = 30000; // 30 segundos (slower)
```

---

### How to Add User ID to Request

The code already handles this! In `solicitarArtigosAtualizados()`:

```cpp
String userId = prefs.getString("usuarioId", "");
if (userId.length() > 0) {
  param["usuarioId"] = userId;
}
```

To ensure it's saved when user logs in, add this to `loginFuncionario()` handler:

```cpp
prefs.begin("prod", false);
prefs.putString("usuarioId", usuarioId); // Add this line
prefs.end();
```

---

### How to Add a New Screen Type

To track a new screen:

1. **Add extern in that .cpp file:**
```cpp
extern String currentScreen;
```

2. **Set it in the go_screenname() function:**
```cpp
void go_screenname() {
  currentScreen = "screenname"; // Add this line
  // ... rest of function ...
}
```

3. **Optional: Add check in main loop:**
```cpp
if (currentScreen == "screenname") {
  // Do something specific for this screen
}
```

---

### How to Debug Updates

1. **Open Serial Monitor at 115200 baud**
2. **Watch for these messages:**

```
Request Sent:
➡️ Solicitando atualização de artigos

Response Received:
[artigosAtualizados] 🔄 Atualizando lista de artigos...

Items Listed:
Artigos atualizados: 3
[1] Camiseta Básica (meta: 100)
[2] Calça Jeans (meta: 50)
[3] Jaqueta Inverno (meta: 30)

Errors:
⚠️ Erro: Campo 'artigos' não encontrado em artigosAtualizados!
```

---

### How to Disable Updates Temporarily

In main loop, comment out the entire block:

```cpp
/*
// Solicita atualização de artigos em tempo real quando na tela de operação
if (wsConnected && login_ok && currentScreen == "operacao") {
  if (millis() - lastUpdateCheckTime > updateCheckInterval) {
    lastUpdateCheckTime = millis();
    solicitarArtigosAtualizados();
  }
}
*/
```

Or set interval to very long:

```cpp
const unsigned long updateCheckInterval = 3600000; // 1 hour
```

---

### How to Force Immediate Update

Add manual trigger in login handler:

```cpp
void on_login_ok() {
    login_ok = true;
    go_operacao();
    clear_operacao_list();
    
    // IMMEDIATELY request articles
    solicitarArtigosAtualizados();
    
    // ... rest of code ...
}
```

---

## Testing Snippets

### Backend Test - Verify Socket Handler

Open browser console and check:

```javascript
// In browser connected to Socket.IO
socket.on('artigosAtualizados', (data) => {
  console.log('Received articles:', data);
});
```

### ESP32 Test - Force Update

In Arduino IDE, add temporary button:

```cpp
// In loop()
if (Serial.available() > 0) {
  char cmd = Serial.read();
  if (cmd == 'u') {
    Serial.println("Manual update requested!");
    solicitarArtigosAtualizados();
  }
}

// Then in Serial Monitor, type: u
// And press Enter to force update
```

### Verify Device Token

Add debug output:

```cpp
void solicitarArtigosAtualizados() {
  Serial.printf("Device Token: %s\n", deviceToken);
  // ... rest of function ...
}
```

Check serial output to confirm token format.

---

## JSON Examples

### Request Example
```json
[
  "solicitarArtigosAtualizados",
  {
    "deviceToken": "461545616614165",
    "usuarioId": "64a2b5c8d4e1f2g3h4i5j6k7"
  }
]
```

### Response Example
```json
[
  "artigosAtualizados",
  {
    "data": {
      "deviceToken": "461545616614165",
      "artigos": [
        {
          "_id": "64a2b5c8d4e1f2g3h4i5j6k7",
          "nome": "Camiseta Básica",
          "codigo": "CB001",
          "quantidade": 100,
          "quantidadeAtual": 25,
          "status": "em_producao"
        },
        {
          "_id": "64a2b5c8d4e1f2g3h4i5j6k8",
          "nome": "Calça Jeans",
          "codigo": "CJ002",
          "quantidade": 50,
          "quantidadeAtual": 0,
          "status": "em_producao"
        }
      ]
    }
  }
]
```

---

## Configuration Options

### Update Interval Values

| Value | Interval | Use Case |
|-------|----------|----------|
| 5000 | 5 seconds | Development, testing, high responsiveness |
| 10000 | 10 seconds | **RECOMMENDED** - balanced |
| 15000 | 15 seconds | Moderate traffic reduction |
| 30000 | 30 seconds | Low bandwidth requirements |
| 60000 | 60 seconds | Very low bandwidth, slower response |

---

## Error Codes (Log Messages)

| Message | Meaning | Action |
|---------|---------|--------|
| `➡️ Solicitando...` | Request sent | Normal - expected |
| `🔄 Atualizando...` | Received response | Normal - expected |
| `Artigos atualizados: 0` | No articles found | Check if any em_producao articles exist |
| `Nenhum artigo disponível` | Empty state | Normal - create articles first |
| `⚠️ Erro: Campo 'artigos'...` | Bad response | Check backend response format |
| (no update messages) | Updates not running | Check conditions (screen, login, WiFi) |

---

This reference guide contains all code snippets needed to implement, test, and troubleshoot the real-time updates system!

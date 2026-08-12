# 🔄 Real-Time Updates Architecture Diagram

## Complete System Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COSTURA ÁGIL REAL-TIME UPDATE SYSTEM                     │
└─────────────────────────────────────────────────────────────────────────────┘

                              TIME: t=0s
                    ESP32 Operacao Screen Displayed
                              │
                              │ User is on operacao screen
                              │ login_ok = true
                              │ wsConnected = true
                              ▼
                    ┌──────────────────────┐
                    │  Main Loop Checks:   │
                    │  currentScreen =     │
                    │  "operacao"          │
                    └──────────────────────┘
                              │
                              │ Timer elapsed? (> 10 seconds)
                              ▼
                    ┌──────────────────────────────────────────────┐
                    │ ESP32: solicitarArtigosAtualizados()         │
                    │                                              │
                    │ Sends JSON Event:                            │
                    │ ["solicitarArtigosAtualizados", {            │
                    │   "deviceToken": "461545616614165",          │
                    │   "usuarioId": "user_id_from_prefs"          │
                    │ }]                                           │
                    │                                              │
                    │ Serial: ➡️ Solicitando atualização...       │
                    └──────────────────────────────────────────────┘
                              │
                              │ Socket.IO Event (WiFi)
                              ▼
                    ┌──────────────────────────────────────────────┐
                    │ BACKEND: app.js Handler (line 276)           │
                    │ socket.on('solicitarArtigosAtualizados')     │
                    │                                              │
                    │ 1. Extract deviceToken from request          │
                    │ 2. Lookup device in DB                       │
                    │ 3. Find associated user                      │
                    │ 4. Query Articles where:                     │
                    │    - criadoPor = usuario                     │
                    │    - status = 'em_producao'                  │
                    │ 5. Format response with:                     │
                    │    - deviceToken                             │
                    │    - artigos array (nome, codigo, qtd, meta) │
                    └──────────────────────────────────────────────┘
                              │
                              │ Emits 'artigosAtualizados' event
                              ▼
                    ┌──────────────────────────────────────────────┐
                    │ ESP32: processJsonMessage()                  │
                    │        Handler (line 272)                    │
                    │                                              │
                    │ 1. Parse JSON response                       │
                    │ 2. Validate deviceToken matches              │
                    │ 3. Call clear_operacao_list()                │
                    │                                              │
                    │ Serial: 🔄 Atualizando lista de artigos...  │
                    │         Artigos atualizados: 3               │
                    └──────────────────────────────────────────────┘
                              │
                              │ Loop through articles array
                              ▼
                    ┌──────────────────────────────────────────────┐
                    │ For Each Article:                            │
                    │  - Extract: _id, nome, quantidade            │
                    │  - Call: add_operacao_to_list(...)           │
                    │  - Serial: [1] Camiseta (meta: 100)          │
                    │            [2] Calça (meta: 50)              │
                    │            [3] Jaqueta (meta: 30)            │
                    └──────────────────────────────────────────────┘
                              │
                              │ UI Updates
                              ▼
                    ┌──────────────────────────────────────────────┐
                    │ ESP32 LVGL Display Updates:                  │
                    │ Operacao Screen Shows:                       │
                    │ ┌─────────────────────────────────────────┐  │
                    │ │  Selecione o Artigo                    │  │
                    │ ├─────────────────────────────────────────┤  │
                    │ │  ☑ Camiseta Básica                     │  │
                    │ │  ☑ Calça Jeans                         │  │
                    │ │  ☑ Jaqueta Inverno                     │  │
                    │ └─────────────────────────────────────────┘  │
                    │ (Ready for user to tap)                      │
                    └──────────────────────────────────────────────┘

                              TIME: t=10s
                              │
                              │ Timer resets, loop repeats
                              │ Request sent again...
                              ▼
                    (Same sequence, updates any changes)

```

## State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│              ESP32 Update Request State Machine                 │
└─────────────────────────────────────────────────────────────────┘

           START
             │
             ▼
    ┌─────────────────┐
    │ Check Conditions│
    └────────┬────────┘
             │
    ┌────────▼────────────────────────────────────────┐
    │ wsConnected &&                                  │
    │ login_ok &&                                     │
    │ currentScreen == "operacao" ?                   │
    └────┬───────────────────────────────────────┬───┘
    YES  │                                       │  NO
         │                                       │
         ▼                                       ▼
    ┌──────────────┐                   ┌──────────────┐
    │ Check Timer  │                   │ Skip Update  │
    │ millis() -   │                   │ (conditions  │
    │ lastCheck >  │                   │  not met)    │
    │ 10000ms      │                   │              │
    └────┬──────┬──┘                   └──────────────┘
    YES  │      │ NO
         │      └─────────────────┐
         ▼                         │
    ┌──────────────┐              │
    │ Reset Timer  │              │
    │ lastCheck =  │              │
    │ millis()     │              │
    └────┬─────────┘              │
         │                        │
         ▼                        │
    ┌──────────────────┐         │
    │ Send Request     │         │
    │ solicitarArtigos │         │
    │ Atualizados()    │         │
    └────┬─────────────┘         │
         │                        │
         ▼                        │
    ┌──────────────────┐         │
    │ Await Response   │         │
    └────┬─────────────┘         │
         │                        │
         ▼                        │
    ┌──────────────────┐         │
    │ Update UI List   │         │
    │ (next 1-2 sec)   │         │
    └────┬─────────────┘         │
         │                        │
         └─────────────┬──────────┘
                       │
                       ▼
            REPEAT (wait 10 seconds)

```

## Data Format: Request/Response

### Request (ESP32 → Backend)
```json
["solicitarArtigosAtualizados", {
  "deviceToken": "461545616614165",
  "usuarioId": "64a2b5c8d4e1f2g3h4i5j6k7"  // Optional
}]
```

### Response (Backend → ESP32)
```json
["artigosAtualizados", {
  "data": {
    "deviceToken": "461545616614165",
    "artigos": [
      {
        "_id": "64a2b5c8d4e1f2g3h4i5j6k7",
        "nome": "Camiseta Básica",
        "codigo": "CB001",
        "quantidade": 100,
        "quantidadeAtual": 0,
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
}]
```

## Timeline Example: Article Status Changes

```
TIME    BACKEND STATUS              ESP32 DISPLAY              ACTION
────────────────────────────────────────────────────────────────────────────
0s      [Create Article "Camiseta"]
        Status: pending             [No change yet]             User creates article

3s      [Click "Iniciar"]
        Status: em_producao         [Still showing old list]    User clicks Iniciar
                                    (waiting for next update)

8s      [Still em_producao]         [Still old list]            Waiting for timer

10s     [em_producao]               ✓ Camiseta appears!         ← UPDATE #1

15s     [Same]                      [Camiseta shown]            (No changes)

20s     [Same]                      [Camiseta shown]            ← UPDATE #2

25s     [Click "Pausar"]
        Status: pausado             [Still showing Camiseta]    User pauses article

30s     [pausado]                   ✗ Camiseta disappears!      ← UPDATE #3

```

## Conditions for Updates

```
UPDATE WILL HAPPEN IF:
  ✓ ESP32 WiFi connected (wsConnected == true)
  ✓ User logged in (login_ok == true)
  ✓ On operacao screen (currentScreen == "operacao")
  ✓ 10+ seconds since last request (timer elapsed)

UPDATE WILL NOT HAPPEN IF:
  ✗ WiFi disconnected
  ✗ Not logged in
  ✗ On different screen (dashboard, home, login, etc.)
  ✗ Less than 10 seconds elapsed
  ✗ Socket.IO connection dropped

IF ANY CONDITION FAILS:
  → Update skipped (no request sent)
  → Timer continues
  → Next cycle will check conditions again
```

## Memory Usage

```
Variables Added:
  unsigned long lastUpdateCheckTime    (4 bytes)
  unsigned long updateCheckInterval    (4 bytes) - constant
  String currentScreen                 (~80 bytes max)
  
Total Additional Memory: ~88 bytes (< 0.2% of ESP32 RAM)

JSON Buffer Size:
  DynamicJsonDocument doc(1024)       (1024 bytes for serialization)
  DynamicJsonDocument doc(4096)       (4096 bytes for deserialization)
  
These are temporary, freed after processing
```

## Error Handling

```
Potential Issues & Handling:

1. Device Token Mismatch
   └─ Check: if (token != String(deviceToken)) return;
   └─ Action: Ignore message silently

2. JSON Parse Error
   └─ Check: if (err) { Serial.printf("[JSON] ❌ Erro: %s\n", err.c_str()); }
   └─ Action: Log error, don't update list

3. Missing Articles Array
   └─ Check: if (!doc["data"].containsKey("artigos"))
   └─ Action: Log warning, show empty message

4. Empty Articles List
   └─ Check: if (artigos.size() == 0)
   └─ Action: Show "Nenhum artigo disponível" message

5. User Not Found
   └─ Check: if (!usuario)
   └─ Action: Return empty artigos array

6. WebSocket Disconnected
   └─ Check: if (!wsConnected)
   └─ Action: Skip update cycle completely
```

---

This architecture ensures reliable, efficient real-time updates without overwhelming the device!

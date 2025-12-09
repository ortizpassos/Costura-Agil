# 🚀 Quick Start: Real-Time ESP32 Updates

## What Was Implemented?

The ESP32 **operacao screen** (article selection) now automatically updates every 10 seconds to show the latest articles from the backend.

---

## How It Works

1. **ESP32 periodically requests:** "Hey backend, give me updated article list"
2. **Backend responds:** Sends all articles with status='em_producao' for that user
3. **ESP32 refreshes:** Clears old list and displays new articles
4. **Repeat:** Every 10 seconds while on operacao screen

---

## Testing Steps

### Test 1: New Article Appears
```
STEP 1: ESP32 operacao screen is showing (e.g., 2 articles)
STEP 2: Go to web dashboard → Producao page
STEP 3: Create new article
STEP 4: Click "Iniciar" button (status → em_producao)
RESULT: Article appears on ESP32 within 10 seconds ✓
```

### Test 2: Article Disappears
```
STEP 1: ESP32 showing article "Camiseta"
STEP 2: Web dashboard → Click "Pausar" on same article
RESULT: Article disappears from ESP32 within 10 seconds ✓
```

### Test 3: Reconnection
```
STEP 1: On operacao screen
STEP 2: Disconnect WiFi on ESP32
STEP 3: Reconnect WiFi
STEP 4: Log in again
RESULT: Updates resume working ✓
```

---

## Configuration

Want faster/slower updates? Edit:

**File:** `Esp32-Dispositivo/Esp32-Dispositivo.ino` line 41

```cpp
const unsigned long updateCheckInterval = 10000; // Change this

// Examples:
// 5000  = 5 seconds (faster, more traffic)
// 10000 = 10 seconds (balanced) ← CURRENT
// 30000 = 30 seconds (slower, less traffic)
```

---

## How to Monitor Updates

Look for these messages in ESP32 Serial Monitor:

```
✓ Request sent:     ➡️ Solicitando atualização de artigos
✓ Response received: 🔄 Atualizando lista de artigos...
✓ Count:            Artigos atualizados: 3
✓ New items:        [1] Camiseta Básica (meta: 100)
```

---

## Key Points

✅ Only updates when:
- ESP32 is connected to WiFi
- User is logged in
- On the operacao (article selection) screen

✅ Updates automatically:
- Show new articles (em_producao)
- Hide paused/completed articles
- Maintain article count and details

✅ Smart behavior:
- Won't spam requests if disconnected
- Gracefully handles empty states
- Validates responses before updating

---

## Troubleshooting

**Articles not updating?**
- Check Serial Monitor for "🔄 Atualizando" messages
- Verify device token matches in logs
- Check if you're on operacao screen

**Updates too slow?**
- Lower updateCheckInterval to 5000ms
- Check backend response time

**ESP32 crashing?**
- Ensure Preferences library is initialized in setup()
- Check JSON parsing doesn't overflow memory

---

## Technical Details

| Component | Details |
|-----------|---------|
| **Interval** | Every 10 seconds |
| **Request Event** | `solicitarArtigosAtualizados` |
| **Response Event** | `artigosAtualizados` |
| **Filter** | Only articles with status='em_producao' |
| **Validation** | deviceToken must match |
| **Buffer Size** | 4096 bytes (JSON payload) |

---

## Files to Know

- **Backend:** `backend/app.js` lines 276-310
- **ESP32 Main:** `Esp32-Dispositivo/Esp32-Dispositivo.ino` lines 39-379
- **Screen Tracking:** `Esp32-Dispositivo/operacao.cpp` line 29

---

Need to adjust frequency or add features? Check `REAL_TIME_UPDATES_IMPLEMENTATION.md` for complete documentation!

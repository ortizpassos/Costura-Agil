ESP32 LEITOR RFID SEM DISPLAY - V1
=================================

OBJETIVO
--------
Leitor exclusivo para cadastrar EPCs nos artigos RFID.

O ESP32 NÃO:
- escolhe artigo;
- salva todas as etiquetas;
- decide se o EPC já existe no artigo;
- cria token.

Essas funções pertencem ao frontend/backend.

O ESP32:
- configura Wi-Fi;
- mostra Device ID no portal do WiFiManager;
- registra o hardware no backend;
- recebe o token após ativação pelo frontend;
- salva o token permanentemente;
- recebe comando para iniciar/parar leitura;
- lê EPCs do YRM1001;
- envia EPC para o backend;
- usa LED como indicador.

HARDWARE
--------
ESP32               YRM1001
--------------------------------
GPIO16 (RX2)  <----- TX
GPIO17 (TX2)  -----> RX
GND           ------ GND

Baud: 115200

ATENÇÃO:
Verifique a tensão/alimentação exigida pelo seu módulo YRM1001.
Não alimente o módulo de potência UHF pelo pino 3V3 do ESP32 se o
hardware exigir corrente/tensão maior.

LED:
GPIO2

BOTÃO:
GPIO0 (BOOT)
Segurar 8 segundos:
- apaga somente a configuração de Wi-Fi;
- NÃO apaga o token/licença.

PRIMEIRO BOOT
-------------
1. O ESP32 gera Device ID a partir do eFuse/MAC.

2. Rede criada:
   Leitor-RFID-XXXXXX

3. No portal do WiFiManager aparece:
   Device ID: RFID-XXXXXXXXXXXX

4. Configure o Wi-Fi.

5. No frontend:
   Dispositivos
   > Ativar dispositivo
   > informe o Device ID
   > PIX
   > pagamento aprovado

6. Backend envia:
   hardwareLinked

7. ESP32 salva deviceToken na Preferences.

EVENTOS SOCKET.IO
-----------------
ESP32 -> backend:
registerHardware
hardwareHeartbeat
epcCadastroRFID

Backend -> ESP32:
hardwareRegistered
hardwareLinked
hardwareUnlinked
iniciarCadastroRFID
pararCadastroRFID
cadastroRFIDConcluido
epcCadastroRFIDResultado (opcional)

COMANDO PARA INICIAR LEITURA
----------------------------
Backend deve enviar:

iniciarCadastroRFID

{
  "artigoId": "...",
  "codigo": "ART001",
  "quantidade": 100,
  "jaCadastradas": 0,
  "sessionId": "opcional"
}

ESP32 passa a inventariar.

PARA CADA EPC DIFERENTE
-----------------------
ESP32 envia:

epcCadastroRFID

{
  "deviceId": "RFID-...",
  "deviceToken": "...",
  "artigoId": "...",
  "sessionId": "...",
  "epc": "E280...",
  "rssi": -52
}

DUPLICIDADE
-----------
Existe um cache local de 64 hashes por 1,5 s apenas para reduzir tráfego.

A deduplicação REAL deve permanecer no MongoDB/backend:
- EPC repetido no mesmo artigo: não incrementa;
- EPC pertencente a outro artigo: rejeita;
- EPC novo: salva e incrementa;
- ao alcançar quantidade do artigo: conclui sessão.

LED
---
Wi-Fi configurando:
pisca ~500 ms.

Socket conectando:
pisca rápido.

Aguardando ativação:
pisca lentamente.

Ativado / aguardando comando:
aceso.

Escaneando:
pisca muito rápido.

EPC novo detectado localmente:
flash curto.

BIBLIOTECAS ARDUINO
-------------------
WiFiManager
WebSockets / SocketIOclient (Links2004)
ArduinoJson
Preferences (incluída no ESP32 core)

Placa:
ESP32 Dev Module ou equivalente.

OBSERVAÇÃO
----------
O parser RFID usa exatamente a interpretação já validada no projeto:
frame[1] = 0x02
frame[2] = 0x22
frame[4] = RSSI
frame[7] = início EPC
EPC length = tamanho total - 13

Comandos:
SET REGION
SET POWER 30 dBm
INVENTORY MULTI
STOP INVENTORY

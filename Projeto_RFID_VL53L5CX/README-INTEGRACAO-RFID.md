# Integração inicial: Display + API + VL53L5CX

Esta versão une o fluxo inicial do projeto `Esp32-Dispositivo` com o sensor VL53L5CX do projeto RFID.

## Fluxo implementado

1. Inicializa display LVGL.
2. Inicializa VL53L5CX.
3. Exibe a tela inicial do projeto original.
4. Executa WiFiManager (`Costura Agil`).
5. Ao conectar à Internet, abre obrigatoriamente a tela **Calibração do Sensor**.
6. O operador deixa o arco vazio e parado e toca em **CALIBRAR**.
7. A rotina existente `IntegracaoSensorRFID::calibrarArcoVazio()` é executada.
8. Somente após sucesso o firmware continua o fluxo original:
   - sessão já restaurada: Artigo/Dashboard;
   - dispositivo já vinculado: Login;
   - dispositivo ainda não vinculado: Token.
9. Socket.IO e eventos da API permanecem os mesmos do projeto-modelo.

## Arquivos adicionados

- `calibracao.h`
- `calibracao.cpp`
- `SensorPresencaVL53L5CX.*`
- `IntegracaoSensorRFID.*`
- `YRM1001Driver.*`

## Observação

Nesta etapa foi alterado somente o **fluxo inicial + calibração**. As telas de operação RFID (cadastro/revisão/lotes/resultados), que substituirão o menu Serial do projeto RFID, ainda devem ser integradas na próxima etapa.

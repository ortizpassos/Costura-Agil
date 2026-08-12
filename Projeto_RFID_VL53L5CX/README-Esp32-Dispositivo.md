# ESP32-Dispositivo - Costura Ágil

Este diretório contém o firmware para o dispositivo ESP32 utilizado no sistema Costura Ágil. O ESP32 atua como coletor de dados de produção, enviando eventos em tempo real para o backend via WebSocket.

## Objetivo
Registrar a produção (ex: peças costuradas) de forma automática, enviando cada evento para o backend, que atualiza a dashboard do gestor em tempo real.

## Hardware Utilizado
- ESP32 DevKit (ou similar)
- Botão físico (GPIO0)
- Display (opcional, LVGL)
- Conexão Wi-Fi

## Principais Funcionalidades
- Leitura do botão físico para contar produção
- Envio de eventos de produção via WebSocket
- Recebimento de comandos do backend (ex: seleção de operação, login de funcionário)
- Atualização de tela (dashboard local)

## Fluxo de Funcionamento
1. O dispositivo conecta ao Wi-Fi e ao backend via WebSocket.
2. Após login e seleção de operação, cada clique no botão incrementa a produção e envia o evento para o backend.
3. O backend processa e faz broadcast para o frontend (dashboard web) e outros clientes.
4. O display local é atualizado em tempo real.

## Como compilar e gravar
1. Instale o [Arduino IDE](https://www.arduino.cc/en/software) ou [PlatformIO](https://platformio.org/).
2. Instale o pacote ESP32 para Arduino.
3. Abra o arquivo `Esp32-Dispositivo.ino`.
4. Configure o Wi-Fi e o token do dispositivo no código, se necessário.
5. Conecte o ESP32 ao computador via USB.
6. Compile e faça upload para o ESP32.

## Integração
- O ESP32 se comunica com o backend Spring Boot via WebSocket (RAW).
- Produz eventos de produção (produtor) e consome comandos/status do backend (consumidor).

## Observações
- O botão deve estar ligado ao GPIO0 (com resistor de pull-up).
- O firmware pode ser adaptado para outros pinos ou sensores.

---
Para dúvidas ou sugestões, consulte o repositório principal 
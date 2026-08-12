# Projeto RFID + VL53L5CX

Arquivos:

- `Projeto_RFID_VL53L5CX.ino`: código RFID original com integração mínima.
- `SensorPresencaVL53L5CX.h/.cpp`: calibração e detecção da peça.
- `IntegracaoSensorRFID.h/.cpp`: ponte entre os eventos ToF e a lógica RFID.

## Biblioteca necessária

Instale no Arduino IDE:

`SparkFun VL53L5CX Arduino Library` versão 1.0.3.

## Ligações

| VL53L5CX | ESP32 DevKit |
|---|---|
| VIN | 3,3 V |
| GND | GND |
| SDA | GPIO 21 |
| SCL | GPIO 22 |
| INT | desconectado |
| RST | desconectado |

O RFID mantém:

- RX: GPIO 16
- TX: GPIO 17

## Uso

1. Abra `Projeto_RFID_VL53L5CX.ino`.
2. Confirme que os cinco arquivos estão na mesma pasta.
3. Compile para ESP32 DevKit.
4. Ao iniciar, digite `calibrar`.
5. Posicione-se atrás do arco, com o arco vazio e parado.
6. Após a calibração, o sistema emitirá dois beeps.
7. Use `revisao` normalmente.

Comandos adicionados:

- `calibrar`: calibra o arco vazio.
- `sensor`: mostra diagnóstico resumido.
- `matriz`: mostra a matriz 8x8 atual.

A lógica de cadastro, EPC, validação de lote, NVS e aprovação da peça
permanece no código RFID original.


## Apagar todas as etiquetas

No menu principal, use:

`apagar`

O sistema solicitará a confirmação exata:

`APAGAR`

A operação remove todas as etiquetas, lotes e resultados de revisão
do namespace NVS `rfid_sistema`. A calibração do VL53L5CX não é apagada.


## Otimizações de desempenho RFID

Esta versão inclui:

- remoção do `delay(50)` após cada comando RFID;
- recepção UART RFID com prioridade, várias vezes por loop;
- buffer RX da UART aumentado para 2048 bytes;
- VL53L5CX reduzido de 15 Hz para 5 Hz;
- inventário mantido em intervalos de 100 ms;
- estado `ARCO_GIRANDO` mantido internamente, sem mensagens na Serial.

Essas alterações reduzem a possibilidade de atraso ou perda de frames
do YRM1001 durante a transferência I2C da matriz do VL53L5CX.


## Exibição do RSSI

Ao detectar uma etiqueta nova, o terminal mostra:

`RSSI bruto: 0xA7 | decimal: 167`

O valor vem do byte `frame[4]` do notice de inventário. Ele é exibido
como valor bruto porque a conversão para dBm depende da tabela específica
do firmware do YRM1001.


## Ajuste de cadência RFID

Esta versão parte de `Projeto_RFID_VL53L5CX_Otimizado_RSSI.zip` e altera
somente a cadência de envio do inventário para reproduzir o código de teste
que apresentou melhor alcance:

- `INVENTORY_INTERVAL = 50`
- `delay(100)` após cada `RFID.write()` em `sendCommand()`

O parser RFID, RSSI, integração com o VL53L5CX, cadastro, revisão e demais
lógicas foram mantidos.


## Teste de prioridade RFID

Esta versão mantém a cadência já ajustada:

- `INVENTORY_INTERVAL = 50 ms`
- `delay(100)` em `sendCommand()`

E altera somente o `loop()` para:

1. drenar a UART RFID;
2. enviar inventário independentemente do estado do sistema;
3. drenar a UART novamente;
4. processar comandos Serial;
5. atualizar a integração do VL53L5CX;
6. drenar a UART RFID novamente.

O inventário fica temporariamente sempre ativo para comparar diretamente
o desempenho com o código simples de teste.


## Correção do travamento em "peça ausente"

A haste do arco não congela mais toda a máquina de estados do VL53L5CX.
As zonas da haste (140 a 280 mm) continuam sendo ignoradas individualmente,
mas as demais zonas úteis da ROI continuam participando da detecção.

Isso corrige o caso em que duas ou mais zonas da haste permaneciam na ROI
e impediam novas transições de ARCO_VAZIO para CONFIRMANDO_ENTRADA.

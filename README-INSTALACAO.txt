COSTURA ÁGIL - LICENÇA SEPARADA DO HARDWARE
================================================

OBJETIVO
--------
deviceToken        = licença permanente do usuário.
hardwareDeviceId   = hardware físico atual.
deviceType         = função da licença/hardware.

O mesmo token continua único globalmente.
O mesmo Device ID também passa a ser único globalmente.

FLUXO NOVO
----------
1. Hardware novo conecta à internet.
2. Hardware emite Socket.IO:
   registerHardware
   {
     deviceId,
     deviceType,
     firmwareVersion,
     deviceToken (opcional)
   }

3. Backend registra o Device ID como online.

4. Usuário entra em:
   Dispositivos > Ativar dispositivo

5. Informa o Device ID.

6. Backend localiza o hardware e o frontend gera PIX.

7. Pagamento aprovado:
   - cria uma nova licença/deviceToken;
   - associa a licença ao usuário autenticado;
   - vincula hardwareDeviceId quando possível;
   - envia hardwareLinked ao ESP32.

8. ESP32 salva deviceToken na NVS.

SUBSTITUIÇÃO
------------
Se o hardware quebrar:

Dispositivos
> Substituir hardware
> selecionar licença existente
> informar Device ID do novo equipamento

Não gera PIX.
Não cria novo token.
O token continua pertencendo ao mesmo usuário.
O hardware antigo é removido do vínculo e registrado no histórico.

ARQUIVOS NOVOS
--------------
backend/models/HardwareDevice.js
backend/models/ProvisioningActivation.js
backend/services/provisioningHub.js
backend/routes/deviceProvisioningRoutes.js
backend/socket/deviceProvisioningSocket.js

ARQUIVOS PARA SUBSTITUIR
------------------------
backend/models/Dispositivo.js
backend/services/mercadoPagoService.js
frontend/src/app/services/dispositivos.ts
frontend/src/app/dispositivos/dispositivos-list/dispositivos-list.ts
frontend/src/app/dispositivos/dispositivos-list/dispositivos-list.html

APP.JS
------
Aplicar as 3 inclusões descritas em PATCH-app.js.txt.

IMPORTANTE
----------
O fluxo antigo /api/device/activation foi preservado.
Não remova deviceActivationRoutes neste momento.

O novo fluxo foi criado em paralelo para permitir migração gradual dos
dispositivos atuais para o novo padrão.

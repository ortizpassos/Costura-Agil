INTEGRAÇÃO PIX - COSTURA ÁGIL

1) Copie a pasta BACKEND_INTEGRACAO para dentro da pasta backend do repositório.

2) No terminal, entre na pasta backend e execute:
   node BACKEND_INTEGRACAO/scripts/aplicar-integracao.js

3) O script cria/atualiza:
   models/DeviceActivation.js
   services/mercadoPagoService.js
   routes/deviceActivationRoutes.js
   app.js (adiciona require + app.use)

4) Configure no Render as variáveis descritas em ENV-RENDER.txt.

5) Faça deploy do backend.

6) Teste no navegador/curl:
   GET https://monitor-ellas-backend.onrender.com/api/device/activation/config

   Deve responder algo como:
   {"amount":1,"currency":"BRL"}

7) Grave o firmware desta mesma versão no ESP32.

FLUXO:
- Sem token: tela Ativar -> POST /create -> Mercado Pago -> QR no display -> GET /status.
- approved: backend gera token numérico de 15 dígitos e o vincula ao deviceId.
- ESP32 salva em Preferences e mostra o token.
- Socket.IO registerDevice continua usando o backend já existente.
- Quando usuarioVinculado=true, vai para Calibração.
- Próximo boot: carrega token, registra via Socket.IO e, se já vinculado, vai direto para Calibração.

RECUPERAÇÃO:
Se a NVS do ESP32 for apagada, o backend mantém deviceId -> token. Ao tocar ATIVAR novamente,
/create devolve alreadyActivated=true e o mesmo token, sem nova cobrança.

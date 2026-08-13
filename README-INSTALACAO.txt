COSTURA AGIL - BACKEND RFID FINAL
=================================

ARQUIVOS PARA SUBSTITUIR:
- backend/app.js
- backend/models/Artigo.js
- backend/routes/artigoRoutes.js

ARQUIVOS NOVOS:
- backend/models/RFIDTag.js
- backend/routes/rfidRoutes.js
- backend/socket/revisaoRFIDSocket.js

FRONTEND:
- frontend/src/app/services/artigos.ts pode substituir o atual.
- PATCH_PRODUCAO contém os blocos a incorporar em producao.ts e producao.html.

REGRAS:
1. Artigo sem RFID: continua funcionando como antes.
2. Artigo com RFID: rfidEnabled=true.
3. Quantidade de EPCs deve ser EXATAMENTE igual a quantidade de pecas.
4. O artigo so aparece no arco quando:
   status=em_producao
   rfidEnabled=true
   rfidScanStatus=concluido
   rfidTagsCount=quantidade
5. Esp32-Dispositivo antigo continua recebendo TODOS os artigos em producao.
6. Arco usa eventos exclusivos RFID.

ROTAS CADASTRO RFID:
GET    /api/artigos/:id/rfid
POST   /api/artigos/:id/rfid/start
POST   /api/artigos/:id/rfid/tag
DELETE /api/artigos/:id/rfid/tag/:epc
POST   /api/artigos/:id/rfid/finish

EVENTOS ARCO:
solicitarArtigosRFID -> artigosRFIDAtualizados
selecionarArtigoRFID -> artigoRFIDSelecionado
validarEpcRFID       -> epcRFIDValidado
confirmarRevisaoRFID -> revisaoRFIDConfirmada

VALIDACAO:
validarEpcRFID apenas consulta.
A etiqueta so recebe revisada=true quando confirmarRevisaoRFID for chamado APOS a peca sair do arco.

IMPORTANTE:
A rota POST /api/artigos/:id/rfid/tag foi deixada preparada para o futuro dispositivo de cadastro RFID.
Antes de producao final, recomendamos autenticar esse dispositivo com um token proprio.

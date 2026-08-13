COSTURA ÁGIL - RFID - CÓDIGO COMPLETO
=====================================

Arquivos para substituir no repositório:

backend/models/Artigo.js
backend/models/RFIDTag.js
backend/routes/artigoRoutes.js
backend/routes/rfidRoutes.js
backend/socket/revisaoRFIDSocket.js

frontend/src/app/services/artigos.ts
frontend/src/app/producao/producao.ts
frontend/src/app/producao/producao.html

O backend/app.js atual do repositório JÁ está correto e não precisa ser
substituído, desde que contenha:

const rfidRoutes = require('./routes/rfidRoutes');
const configurarSocketRevisaoRFID = require('./socket/revisaoRFIDSocket');

app.use('/api/artigos', artigoRoutes);
app.use('/api/artigos', rfidRoutes);

setArtigoSocketIO(io);
configurarSocketRevisaoRFID(io);

FLUXO:
- Novo Artigo -> escolha Sem RFID / Com RFID.
- Com RFID -> após salvar abre modal de etiquetas.
- 1 etiqueta para cada peça.
- Só fica "concluido" quando rfidTagsCount == quantidade.
- Dispositivo antigo continua recebendo todos os artigos em produção.
- Dispositivo de revisão recebe apenas artigos RFID concluídos.

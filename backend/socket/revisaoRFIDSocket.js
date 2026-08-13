const Artigo = require('../models/Artigo');
const RFIDTag = require('../models/RFIDTag');
const Dispositivo = require('../models/Dispositivo');

function normalizarEpc(v) {
  return String(v || '')
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase();
}

function configurarSocketRevisaoRFID(io) {
  io.on('connection', (socket) => {

    socket.on('solicitarArtigosRFID', async (data = {}) => {
      try {
        const deviceToken = String(data.deviceToken || '').trim();

        const dispositivo = await Dispositivo.findOne({ deviceToken });

        if (!dispositivo || !dispositivo.usuario) {
          return socket.emit('artigosRFIDAtualizados', {
            success: false,
            message: 'Dispositivo não vinculado.',
            data: { deviceToken, artigos: [] }
          });
        }

        const artigos = await Artigo.find({
          criadoPor: dispositivo.usuario,
          status: 'em_producao',
          rfidEnabled: true,
          rfidScanStatus: 'concluido',
          $expr: { $eq: ['$rfidTagsCount', '$quantidade'] }
        }).sort({ nome: 1 });

        const saida = [];

        for (const artigo of artigos) {
          const revisadas = await RFIDTag.countDocuments({
            artigo: artigo._id,
            revisada: true
          });

          saida.push({
            _id: artigo._id,
            codigo: artigo.codigo,
            nome: artigo.nome,
            cliente: artigo.cliente,
            quantidade: artigo.quantidade,
            revisadas,
            pendentes: Math.max(0, artigo.quantidade - revisadas),
            rfidTagsCount: artigo.rfidTagsCount
          });
        }

        socket.emit('artigosRFIDAtualizados', {
          success: true,
          data: {
            deviceToken,
            artigos: saida
          }
        });
      } catch (err) {
        console.error('[RFID] solicitarArtigosRFID:', err);

        socket.emit('artigosRFIDAtualizados', {
          success: false,
          message: 'Erro interno ao buscar artigos RFID.',
          data: { artigos: [] }
        });
      }
    });

    socket.on('selecionarArtigoRFID', async (data = {}) => {
      try {
        const deviceToken = String(data.deviceToken || '').trim();
        const artigoId = String(data.artigoId || '').trim();

        const dispositivo = await Dispositivo.findOne({ deviceToken });

        if (!dispositivo || !dispositivo.usuario) {
          return socket.emit('artigoRFIDSelecionado', {
            success: false,
            message: 'Dispositivo não vinculado.'
          });
        }

        const artigo = await Artigo.findOne({
          _id: artigoId,
          criadoPor: dispositivo.usuario,
          status: 'em_producao',
          rfidEnabled: true,
          rfidScanStatus: 'concluido'
        });

        if (!artigo || artigo.rfidTagsCount !== artigo.quantidade) {
          return socket.emit('artigoRFIDSelecionado', {
            success: false,
            message: 'Artigo não está pronto para revisão RFID.'
          });
        }

        const revisadas = await RFIDTag.countDocuments({
          artigo: artigo._id,
          revisada: true
        });

        socket.emit('artigoRFIDSelecionado', {
          success: true,
          data: {
            artigo: {
              _id: artigo._id,
              codigo: artigo.codigo,
              nome: artigo.nome,
              cliente: artigo.cliente,
              quantidade: artigo.quantidade,
              rfidTagsCount: artigo.rfidTagsCount
            },
            revisadas,
            pendentes: Math.max(0, artigo.quantidade - revisadas)
          }
        });
      } catch (err) {
        console.error('[RFID] selecionarArtigoRFID:', err);

        socket.emit('artigoRFIDSelecionado', {
          success: false,
          message: 'Erro interno.'
        });
      }
    });

    // Apenas valida. NÃO marca revisada.
    socket.on('validarEpcRFID', async (data = {}) => {
      try {
        const artigoId = String(data.artigoId || '').trim();
        const epc = normalizarEpc(data.epc);

        if (!artigoId || !epc) {
          return socket.emit('epcRFIDValidado', {
            success: false,
            resultado: 'dados_invalidos'
          });
        }

        const tag = await RFIDTag.findOne({ epc });

        if (!tag) {
          return socket.emit('epcRFIDValidado', {
            success: true,
            resultado: 'nao_cadastrado',
            epc
          });
        }

        if (String(tag.artigo) !== artigoId) {
          return socket.emit('epcRFIDValidado', {
            success: true,
            resultado: 'artigo_incorreto',
            epc
          });
        }

        if (tag.revisada) {
          return socket.emit('epcRFIDValidado', {
            success: true,
            resultado: 'ja_revisado',
            epc,
            revisadaEm: tag.revisadaEm
          });
        }

        socket.emit('epcRFIDValidado', {
          success: true,
          resultado: 'valido',
          epc
        });
      } catch (err) {
        console.error('[RFID] validarEpcRFID:', err);

        socket.emit('epcRFIDValidado', {
          success: false,
          resultado: 'erro_api'
        });
      }
    });

    // Só confirma depois que o arco detectou saída da peça.
    socket.on('confirmarRevisaoRFID', async (data = {}) => {
      try {
        const deviceToken = String(data.deviceToken || '').trim();
        const artigoId = String(data.artigoId || '').trim();
        const epc = normalizarEpc(data.epc);

        // Atualização atômica: impede dupla aprovação.
        const tag = await RFIDTag.findOneAndUpdate(
          {
            epc,
            artigo: artigoId,
            revisada: false
          },
          {
            $set: {
              revisada: true,
              revisadaEm: new Date(),
              dispositivoRevisao: deviceToken
            }
          },
          {
            new: true
          }
        );

        if (!tag) {
          const existente = await RFIDTag.findOne({
            epc,
            artigo: artigoId
          });

          return socket.emit('revisaoRFIDConfirmada', {
            success: false,
            resultado: existente ? 'ja_revisado' : 'nao_cadastrado'
          });
        }

        const total = await RFIDTag.countDocuments({
          artigo: artigoId
        });

        const revisadas = await RFIDTag.countDocuments({
          artigo: artigoId,
          revisada: true
        });

        socket.emit('revisaoRFIDConfirmada', {
          success: true,
          resultado: 'aprovada',
          epc,
          revisadas,
          total,
          pendentes: Math.max(0, total - revisadas)
        });
      } catch (err) {
        console.error('[RFID] confirmarRevisaoRFID:', err);

        socket.emit('revisaoRFIDConfirmada', {
          success: false,
          resultado: 'erro_api'
        });
      }
    });
  });
}

module.exports = configurarSocketRevisaoRFID;

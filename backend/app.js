const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const funcionarioRoutes = require('./routes/funcionarioRoutes');
const dispositivoRoutes = require('./routes/dispositivoRoutes');
const { router: authRoutes } = require('./routes/authRoutes');
const producaoRoutes = require('./routes/producaoRoutes');
const { router: artigoRoutes, setSocketIO: setArtigoSocketIO } = require('./routes/artigoRoutes');
const clienteRoutes = require('./routes/clienteRoutes');
const relatorioRoutes = require('./routes/relatorioRoutes');
const operacaoRoutes = require('./routes/operacaoRoutes');
const dispositivoTesteRoute = require('./routes/dispositivoTesteRoute');
const nfeRoutes = require('./routes/nfeRoutes');
const ProducaoDetalhada = require('./models/ProducaoDetalhada');
const Artigo = require('./models/Artigo');


const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('JSON inválido recebido:', err.message);
    return res.status(400).json({ message: 'JSON inválido: ' + err.message });
  }
  next(err);
});

// Rotas principais
app.use('/api/funcionarios', funcionarioRoutes);
app.use('/api/dispositivos', dispositivoRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/producao', producaoRoutes);
app.use('/api/artigos', artigoRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/relatorios', relatorioRoutes);
app.use('/api/operacoes', operacaoRoutes);
app.use('/api/nfe', nfeRoutes);

// Socket.IO setup
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  pingTimeout: 60000, // Tempo que o servidor espera por um pong antes de desconectar
  pingInterval: 25000 // Frequência com que o servidor envia pings
});

// Configurar Socket.IO nas rotas de artigos para notificações em tempo real
setArtigoSocketIO(io);

io.on('connection', (socket) => {
  const buildDeviceStatusPayload = async (dispositivo) => {
    if (!dispositivo) return null;
    if (typeof dispositivo.populate === 'function') {
      await dispositivo.populate(['operacao', 'artigo', 'funcionarioLogado']);
    }

    const payload = dispositivo.toObject ? dispositivo.toObject() : { ...dispositivo };
    const funcionarioId = payload.funcionarioLogado?._id || payload.funcionarioLogado || null;
    const artigoId = payload.artigo?._id || payload.artigo || null;
    const operacaoId = payload.operacao?._id || payload.operacao || null;

    if (funcionarioId && (artigoId || operacaoId)) {
      const matchStage = {
        funcionario: funcionarioId
      };

      if (artigoId) {
        matchStage.artigo = artigoId;
      } else if (operacaoId) {
        matchStage.operacao = operacaoId;
      }

      const resumo = await ProducaoDetalhada.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            total: { $sum: '$quantidade' }
          }
        }
      ]);
      payload.producaoFuncionario = resumo.length ? resumo[0].total : 0;
    } else {
      payload.producaoFuncionario = 0;
    }
    return payload;
  };
  // Evento para selecionar artigo no dispositivo
  socket.on('selecionarArtigo', async (data) => {
    // data: { deviceToken, artigoId }
    const Dispositivo = require('./models/Dispositivo');
    const ProducaoDetalhada = require('./models/ProducaoDetalhada');

    const dispositivo = await Dispositivo.findOne({ deviceToken: data.deviceToken });
    if (!dispositivo) {
      socket.emit('artigoSelecionado', {
        data: {
          deviceToken: data.deviceToken,
          artigo: null,
          error: 'Dispositivo não encontrado'
        }
      });
      return;
    }

    if (!data.artigoId) {
      socket.emit('artigoSelecionado', {
        data: {
          deviceToken: data.deviceToken,
          artigo: null,
          error: 'Artigo não informado'
        }
      });
      return;
    }

    const artigo = await Artigo.findById(data.artigoId);
    if (!artigo) {
      socket.emit('artigoSelecionado', {
        data: {
          deviceToken: data.deviceToken,
          artigo: null,
          error: 'Artigo não encontrado'
        }
      });
      return;
    }

    dispositivo.artigo = artigo._id;
    dispositivo.operacao = null;
    dispositivo.status = 'em_producao';
    dispositivo.producaoAtual = artigo.quantidadeAtual || 0;
    dispositivo.ultimaAtualizacao = new Date();
    await dispositivo.save();

    await dispositivo.populate(['artigo', 'funcionarioLogado']);

    let producaoFuncionario = 0;
    if (dispositivo.funcionarioLogado) {
      const resumoFuncionario = await ProducaoDetalhada.aggregate([
        {
          $match: {
            artigo: artigo._id,
            funcionario: dispositivo.funcionarioLogado._id
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$quantidade' }
          }
        }
      ]);
      producaoFuncionario = resumoFuncionario.length ? resumoFuncionario[0].total : 0;
    }

    const dispositivoData = dispositivo.toObject();
    dispositivoData.producaoFuncionario = producaoFuncionario;

    io.emit('deviceStatusUpdate', dispositivoData);
    socket.emit('artigoSelecionado', {
      data: {
        deviceToken: data.deviceToken,
        artigo: dispositivo.artigo ? {
          _id: dispositivo.artigo._id,
          nome: dispositivo.artigo.nome,
          codigo: dispositivo.artigo.codigo,
          quantidade: dispositivo.artigo.quantidade,
          quantidadeAtual: dispositivo.artigo.quantidadeAtual || 0,
          cliente: dispositivo.artigo.cliente
        } : null,
        producaoAtual: dispositivo.producaoAtual,
        producaoFuncionario
      }
    });
  });

  console.log('Novo dispositivo conectado:', socket.id);

  socket.on('registerDevice', async (data) => {
    console.log('Dispositivo registrado:', data.deviceToken);
    // Find and update device status in DB
    const Dispositivo = require('./models/Dispositivo');
    let dispositivo = await Dispositivo.findOne({ deviceToken: data.deviceToken });
    if (dispositivo) {
      dispositivo.status = 'online';
      dispositivo.ultimaAtualizacao = new Date();
      await dispositivo.save();
      // Emit update to all clients
      const payload = await buildDeviceStatusPayload(dispositivo);
      io.emit('deviceStatusUpdate', payload);

      socket.emit('deviceRegistered', { 
        success: true, 
        message: 'Dispositivo registrado e vinculado!',
        data: {
          deviceToken: data.deviceToken,
          usuarioVinculado: true
        }
      });
    } else {
      socket.emit('deviceRegistered', { 
        success: true, 
        message: 'Dispositivo conectado, aguardando vínculo.',
        data: {
          deviceToken: data.deviceToken,
          usuarioVinculado: false
        }
      });
    }
  });

 socket.on('loginFuncionario', async (data) => {
  // Find device and update funcionarioLogado by codigo
  const Dispositivo = require('./models/Dispositivo');
  const Funcionario = require('./models/Funcionario');
  let dispositivo = await Dispositivo.findOne({ deviceToken: data.deviceToken });
  if (dispositivo) {
    if (!dispositivo.usuario) {
       socket.emit('loginFailed', { message: 'Dispositivo não vinculado a um usuário.' });
       return;
    }

    let funcionario = null;
    if (data.codigo) {
      // Verifica funcionário pelo código E pelo usuário do dispositivo
      funcionario = await Funcionario.findOne({ codigo: data.codigo, usuario: dispositivo.usuario });
    } else if (data.funcionarioId) {
      funcionario = await Funcionario.findOne({ _id: data.funcionarioId, usuario: dispositivo.usuario });
    }
    
    if (!funcionario) {
      socket.emit('loginFailed', { message: 'Funcionário não encontrado para a senha/código informado.' });
      return;
    }
    dispositivo.funcionarioLogado = funcionario._id;
    dispositivo.status = 'online'; // Mantém online até selecionar operação
    dispositivo.ultimaAtualizacao = new Date();
    await dispositivo.save();
    // Popular funcionarioLogado antes de emitir para o frontend
    await dispositivo.populate('funcionarioLogado');
    const payload = await buildDeviceStatusPayload(dispositivo);
    io.emit('deviceStatusUpdate', payload);

    // Buscar artigos disponíveis do usuário dono do dispositivo (apenas em produção)
    let artigos = [];
    if (dispositivo.usuario) {
      artigos = await Artigo.find({ 
        criadoPor: dispositivo.usuario, 
        status: 'em_producao'
      })
        .sort({ nome: 1 });
    }

    socket.emit('loginSuccess', {
      data: {
        deviceToken: data.deviceToken,
        funcionario: { nome: funcionario.nome },
        artigos: artigos.map(art => ({
          _id: art._id,
          nome: art.nome,
          codigo: art.codigo,
          quantidade: art.quantidade,
          quantidadeAtual: art.quantidadeAtual || 0,
          status: art.status
        }))
      }
    });
  } else {
    socket.emit('loginFailed', { message: 'Dispositivo não encontrado' });
  }
});

// Evento para atualizar lista de artigos em tempo real
socket.on('solicitarArtigosAtualizados', async (data) => {
  // data: { deviceToken, usuarioId }
  const Dispositivo = require('./models/Dispositivo');
  
  let usuario = data.usuarioId;
  const deviceToken = data.deviceToken;
  
  if (!usuario && deviceToken) {
    const dispositivo = await Dispositivo.findOne({ deviceToken: deviceToken });
    usuario = dispositivo?.usuario;
  }
  
  if (!usuario) {
    socket.emit('artigosAtualizados', { 
      data: {
        deviceToken: deviceToken,
        artigos: []
      }
    });
    return;
  }
  
  // Buscar artigos em produção
  const artigos = await Artigo.find({ 
    criadoPor: usuario, 
    status: 'em_producao'
  }).sort({ nome: 1 });
  
  socket.emit('artigosAtualizados', {
    data: {
      deviceToken: deviceToken,
      artigos: artigos.map(art => ({
        _id: art._id,
        nome: art.nome,
        codigo: art.codigo,
        quantidade: art.quantidade,
        quantidadeAtual: art.quantidadeAtual || 0,
        status: art.status
      }))
    }
  });
});

  socket.on('producao', async (data) => {
    console.log('Produção recebida:', data);
    const Dispositivo = require('./models/Dispositivo');
    const ProducaoDetalhada = require('./models/ProducaoDetalhada');

    const dispositivo = await Dispositivo.findOne({ deviceToken: data.deviceToken });
    if (!dispositivo) {
      console.log('Dispositivo não encontrado para produção:', data.deviceToken);
      socket.emit('producaoFailed', { message: 'Dispositivo não encontrado' });
      return;
    }

    if (!dispositivo.funcionarioLogado || (!dispositivo.artigo && !dispositivo.operacao)) {
      socket.emit('producaoFailed', { message: 'Funcionário ou artigo não definidos para este dispositivo.' });
      return;
    }

    const quantidadeAtual = typeof data.quantidade === 'number' ? data.quantidade : 0;
    const producaoAnterior = dispositivo.producaoAtual || 0;
    const incremento = quantidadeAtual - producaoAnterior;

    if (incremento <= 0) {
      socket.emit('producaoSuccess', { message: 'Produção recebida (sem incremento).' });
      return;
    }

    dispositivo.producaoAtual = quantidadeAtual;
    dispositivo.ultimaAtualizacao = new Date();
    await dispositivo.save();

    let artigo = null;
    let artigoFinalizadoAgora = false;
    const agora = new Date();
    let tempoTotalArtigo = 0;

    if (dispositivo.artigo) {
      artigo = await Artigo.findById(dispositivo.artigo);
      if (artigo) {
        const statusAnterior = artigo.status;
        
        // Se artigo acabou de entrar em produção, registrar timestamp de início
        if (statusAnterior !== 'em_producao' && !artigo.dataInicioProducao) {
          artigo.dataInicioProducao = agora;
        }
        
        artigo.quantidadeAtual = (artigo.quantidadeAtual || 0) + incremento;
        if (artigo.quantidade && artigo.quantidadeAtual >= artigo.quantidade) {
          artigo.status = 'finalizado';
          if (statusAnterior !== 'finalizado') {
            artigoFinalizadoAgora = true;
            artigo.dataFimProducao = agora;
            
            // Calcular tempo total em segundos (fim - início)
            if (artigo.dataInicioProducao) {
              tempoTotalArtigo = Math.floor((agora - artigo.dataInicioProducao) / 1000);
            }
          }
        } else if (artigo.status !== 'em_producao') {
          artigo.status = 'em_producao';
        }
        await artigo.save();
      }
    }

    await ProducaoDetalhada.create({
      operacao: dispositivo.operacao,
      artigo: dispositivo.artigo,
      funcionario: dispositivo.funcionarioLogado,
      dispositivo: dispositivo._id,
      quantidade: incremento,
      tempoProducao: data.tempoProducao || 0,
      dataInicioPeca: agora,
      dataFimProducao: artigoFinalizadoAgora ? agora : null,
      tempoTotalArtigo: artigoFinalizadoAgora ? tempoTotalArtigo : 0
    });

    await dispositivo.populate('funcionarioLogado');
    await dispositivo.populate('operacao');
    await dispositivo.populate('artigo');

    if (dispositivo.artigo && artigo) {
      dispositivo.artigo.quantidadeAtual = artigo.quantidadeAtual;
    }

    const matchProducoes = {
      funcionario: dispositivo.funcionarioLogado._id
    };
    if (dispositivo.artigo) {
      matchProducoes.artigo = dispositivo.artigo._id || dispositivo.artigo;
    } else if (dispositivo.operacao) {
      matchProducoes.operacao = dispositivo.operacao._id || dispositivo.operacao;
    }

    const resumoFuncionario = await ProducaoDetalhada.aggregate([
      {
        $match: matchProducoes
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$quantidade' }
        }
      }
    ]);
    const quantidadeFuncionario = resumoFuncionario.length ? resumoFuncionario[0].total : incremento;

    const dispositivoData = dispositivo.toObject();
    dispositivoData.operacao = dispositivo.operacao;
    dispositivoData.artigo = dispositivo.artigo;
    dispositivoData.funcionarioLogado = dispositivo.funcionarioLogado;
    dispositivoData.producaoFuncionario = quantidadeFuncionario;

    io.emit('productionUpdate', { dispositivo: dispositivoData, quantidadeFuncionario });
    socket.emit('producaoSuccess', {
      message: 'Produção registrada com sucesso!',
      data: {
        deviceToken: data.deviceToken,
        incremento,
        quantidade: quantidadeAtual,
        quantidadeAtualTotal: artigo ? artigo.quantidadeAtual : quantidadeAtual,
        quantidadeFuncionario,
        artigoId: artigo ? artigo._id : null,
        artigoNome: artigo ? artigo.nome : null,
        meta: artigo ? artigo.quantidade : 0
      }
    });
    
    // Se o artigo foi finalizado agora, notificar todos os dispositivos do usuário
    if (artigoFinalizadoAgora && artigo) {
      console.log(`🎯 Artigo ${artigo.nome} foi finalizado!`);
      
      // Buscar dispositivos do usuário
      const dispositivos = await Dispositivo.find({ usuario: artigo.criadoPor });
      
      // Buscar artigos em produção (excluindo finalizados)
      const artigosEmProducao = await Artigo.find({ 
        criadoPor: artigo.criadoPor, 
        status: 'em_producao'
      }).sort({ nome: 1 });
      
      // Notificar cada dispositivo
      dispositivos.forEach(disp => {
        io.emit('artigosAtualizados', {
          data: {
            deviceToken: disp.deviceToken,
            artigos: artigosEmProducao.map(art => ({
              _id: art._id,
              nome: art.nome,
              codigo: art.codigo,
              quantidade: art.quantidade,
              quantidadeAtual: art.quantidadeAtual || 0,
              status: art.status
            }))
          }
        });
        
        console.log(`📡 Dispositivo ${disp.deviceToken} notificado sobre artigo finalizado`);
      });
    }
  });

  socket.on('disconnect', async () => {
    // Atualiza status do dispositivo para offline ao desconectar
    const Dispositivo = require('./models/Dispositivo');
    // Se o deviceToken estiver associado ao socket, atualiza normalmente
    if (socket.deviceToken) {
      let dispositivo = await Dispositivo.findOne({ deviceToken: socket.deviceToken });
      if (dispositivo) {
        dispositivo.status = 'offline';
        dispositivo.ultimaAtualizacao = new Date();
        await dispositivo.save();
        const payload = await buildDeviceStatusPayload(dispositivo);
        io.emit('deviceStatusUpdate', payload);
      }
    } else {
      // Se não houver deviceToken, busca dispositivos 'online' com última atualização antiga (ex: >2 minutos)
      const doisMinutosAtras = new Date(Date.now() - 2 * 60 * 1000);
      let dispositivos = await Dispositivo.find({ status: 'online', ultimaAtualizacao: { $lt: doisMinutosAtras } });
      for (const dispositivo of dispositivos) {
        dispositivo.status = 'offline';
        dispositivo.ultimaAtualizacao = new Date();
        await dispositivo.save();
        const payload = await buildDeviceStatusPayload(dispositivo);
        io.emit('deviceStatusUpdate', payload);
      }
    }
  });

  // Associar deviceToken ao socket para uso no disconnect
  socket.on('registerDevice', async (data) => {
    socket.deviceToken = data.deviceToken;
    // ...existing code...
  });
});

// Conexão com MongoDB - iniciar servidor somente após conexão bem-sucedida
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/production-monitor';

mongoose.connect(mongoUri, {})
  .then(async () => {
    const PORT = process.env.PORT || 3001;
    http.listen(PORT, () => {
      console.log(`API + Socket.IO rodando na porta ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Falha ao conectar ao MongoDB:', err.message || err);
    console.error('Verifique se o MongoDB está rodando e se MONGO_URI está correto.');
  });

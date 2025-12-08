const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const funcionarioRoutes = require('./routes/funcionarioRoutes');
const dispositivoRoutes = require('./routes/dispositivoRoutes');
const { router: authRoutes } = require('./routes/authRoutes');
const producaoRoutes = require('./routes/producaoRoutes');
const relatorioRoutes = require('./routes/relatorioRoutes');
const operacaoRoutes = require('./routes/operacaoRoutes');
const dispositivoTesteRoute = require('./routes/dispositivoTesteRoute');


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
app.use('/api/relatorios', relatorioRoutes);
app.use('/api/operacoes', operacaoRoutes);

// Socket.IO setup
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  pingTimeout: 60000, // Tempo que o servidor espera por um pong antes de desconectar
  pingInterval: 25000 // Frequência com que o servidor envia pings
});

io.on('connection', (socket) => {
  // Evento para selecionar operação no dispositivo
 socket.on('selecionarOperacao', async (data) => {
  // data: { deviceToken, operacaoId }
  const Dispositivo = require('./models/Dispositivo');
  const Operacao = require('./models/Operacao');
  const ProducaoDetalhada = require('./models/ProducaoDetalhada');

  let dispositivo = await Dispositivo.findOne({ deviceToken: data.deviceToken });
  if (!dispositivo) {
    socket.emit('operacaoSelecionada', {
      data: {
        deviceToken: data.deviceToken,
        operacao: null,
        error: 'Dispositivo não encontrado'
      }
    });
    return;
  }

  if (!data.operacaoId) {
    socket.emit('operacaoSelecionada', {
      data: {
        deviceToken: data.deviceToken,
        operacao: null,
        error: 'Operação não informada'
      }
    });
    return;
  }

  const operacao = await Operacao.findById(data.operacaoId);
  if (!operacao) {
    socket.emit('operacaoSelecionada', {
      data: {
        deviceToken: data.deviceToken,
        operacao: null,
        error: 'Operação não encontrada'
      }
    });
    return;
  }

  dispositivo.operacao = operacao._id;
  dispositivo.status = 'em_producao';
  dispositivo.producaoAtual = operacao.quantidadeAtual || 0;
  dispositivo.ultimaAtualizacao = new Date();
  await dispositivo.save();

  await dispositivo.populate('operacao');
  await dispositivo.populate('funcionarioLogado');

  let producaoFuncionario = 0;
  if (dispositivo.funcionarioLogado) {
    const resumoFuncionario = await ProducaoDetalhada.aggregate([
      {
        $match: {
          operacao: operacao._id,
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

  io.emit('deviceStatusUpdate', dispositivo);
  socket.emit('operacaoSelecionada', {
    data: {
      deviceToken: data.deviceToken,
      operacao: dispositivo.operacao ? {
        _id: dispositivo.operacao._id,
        nome: dispositivo.operacao.nome,
        metaDiaria: dispositivo.operacao.metaDiaria,
        quantidadeAtual: dispositivo.operacao.quantidadeAtual || 0
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
      io.emit('deviceStatusUpdate', dispositivo);

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
  const Operacao = require('./models/Operacao');
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
    io.emit('deviceStatusUpdate', dispositivo);

    // Buscar operações ativas do usuário dono do dispositivo
    let operacoes = [];
    if (dispositivo.usuario) {
      operacoes = await Operacao.find({ usuario: dispositivo.usuario, ativo: true }).sort({ nome: 1 });
    }

    socket.emit('loginSuccess', {
      data: {
        deviceToken: data.deviceToken,
        funcionario: { nome: funcionario.nome },
        operacoes: operacoes.map(op => ({
          _id: op._id,
          nome: op.nome,
          metaDiaria: op.metaDiaria
        }))
      }
    });
  } else {
    socket.emit('loginFailed', { message: 'Dispositivo não encontrado' });
  }
});

  socket.on('producao', async (data) => {
    console.log('Produção recebida:', data);
    const Dispositivo = require('./models/Dispositivo');
    const Operacao = require('./models/Operacao');
    const ProducaoDetalhada = require('./models/ProducaoDetalhada');

    const dispositivo = await Dispositivo.findOne({ deviceToken: data.deviceToken });
    if (!dispositivo) {
      console.log('Dispositivo não encontrado para produção:', data.deviceToken);
      socket.emit('producaoFailed', { message: 'Dispositivo não encontrado' });
      return;
    }

    if (!dispositivo.funcionarioLogado || !dispositivo.operacao) {
      socket.emit('producaoFailed', { message: 'Funcionário ou operação não definidos para este dispositivo.' });
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

    const operacao = await Operacao.findById(dispositivo.operacao);
    if (operacao) {
      operacao.quantidadeAtual = (operacao.quantidadeAtual || 0) + incremento;
      await operacao.save();
    }

    await ProducaoDetalhada.create({
      operacao: dispositivo.operacao,
      funcionario: dispositivo.funcionarioLogado,
      dispositivo: dispositivo._id,
      quantidade: incremento,
      tempoProducao: data.tempoProducao || 0
    });

    await dispositivo.populate('funcionarioLogado');
    await dispositivo.populate('operacao');

    if (dispositivo.operacao && operacao) {
      dispositivo.operacao.quantidadeAtual = operacao.quantidadeAtual;
    }

    const resumoFuncionario = await ProducaoDetalhada.aggregate([
      {
        $match: {
          operacao: dispositivo.operacao._id || dispositivo.operacao,
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
    const quantidadeFuncionario = resumoFuncionario.length ? resumoFuncionario[0].total : incremento;

    io.emit('productionUpdate', { dispositivo, quantidadeFuncionario });
    socket.emit('producaoSuccess', {
      message: 'Produção registrada com sucesso!',
      data: {
        deviceToken: data.deviceToken,
        incremento,
        quantidadeAtualTotal: operacao ? operacao.quantidadeAtual : quantidadeAtual,
        quantidadeFuncionario
      }
    });
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
        io.emit('deviceStatusUpdate', dispositivo);
      }
    } else {
      // Se não houver deviceToken, busca dispositivos 'online' com última atualização antiga (ex: >2 minutos)
      const doisMinutosAtras = new Date(Date.now() - 2 * 60 * 1000);
      let dispositivos = await Dispositivo.find({ status: 'online', ultimaAtualizacao: { $lt: doisMinutosAtras } });
      for (const dispositivo of dispositivos) {
        dispositivo.status = 'offline';
        dispositivo.ultimaAtualizacao = new Date();
        await dispositivo.save();
        io.emit('deviceStatusUpdate', dispositivo);
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
  .then(() => {
    const PORT = process.env.PORT || 3001;
    http.listen(PORT, () => {
      console.log(`API + Socket.IO rodando na porta ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Falha ao conectar ao MongoDB:', err.message || err);
    console.error('Verifique se o MongoDB está rodando e se MONGO_URI está correto.');
  });

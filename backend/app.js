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

// Ativação de dispositivo via PIX / Mercado Pago
const deviceActivationRoutes = require('./routes/deviceActivationRoutes');

const ProducaoDetalhada = require('./models/ProducaoDetalhada');
const Artigo = require('./models/Artigo');

const app = express();

app.use(cors());
app.use(express.json());

// Log das requisições HTTP
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Tratamento de JSON inválido
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('JSON inválido recebido:', err.message);
    return res.status(400).json({
      message: 'JSON inválido: ' + err.message
    });
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

// Rotas de ativação PIX
app.use('/api/device/activation', deviceActivationRoutes);

// Socket.IO setup
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  pingTimeout: 60000,
  pingInterval: 25000
});

// Configurar Socket.IO nas rotas de artigos para notificações em tempo real
setArtigoSocketIO(io);

io.on('connection', (socket) => {
  const buildDeviceStatusPayload = async (dispositivo) => {
    if (!dispositivo) return null;

    if (typeof dispositivo.populate === 'function') {
      await dispositivo.populate(['operacao', 'artigo', 'funcionarioLogado']);
    }

    const payload = dispositivo.toObject
      ? dispositivo.toObject()
      : { ...dispositivo };

    const funcionarioId =
      payload.funcionarioLogado?._id ||
      payload.funcionarioLogado ||
      null;

    const artigoId =
      payload.artigo?._id ||
      payload.artigo ||
      null;

    const operacaoId =
      payload.operacao?._id ||
      payload.operacao ||
      null;

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

      payload.producaoFuncionario =
        resumo.length ? resumo[0].total : 0;
    } else {
      payload.producaoFuncionario = 0;
    }

    return payload;
  };

  // Evento para selecionar artigo no dispositivo
  socket.on('selecionarArtigo', async (data) => {
    try {
      const Dispositivo = require('./models/Dispositivo');
      const dispositivo = await Dispositivo.findOne({
        deviceToken: data.deviceToken
      });

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

        producaoFuncionario =
          resumoFuncionario.length
            ? resumoFuncionario[0].total
            : 0;
      }

      const dispositivoData = dispositivo.toObject();
      dispositivoData.producaoFuncionario = producaoFuncionario;

      io.emit('deviceStatusUpdate', dispositivoData);

      socket.emit('artigoSelecionado', {
        data: {
          deviceToken: data.deviceToken,
          artigo: dispositivo.artigo
            ? {
                _id: dispositivo.artigo._id,
                nome: dispositivo.artigo.nome,
                codigo: dispositivo.artigo.codigo,
                quantidade: dispositivo.artigo.quantidade,
                quantidadeAtual:
                  dispositivo.artigo.quantidadeAtual || 0,
                cliente: dispositivo.artigo.cliente
              }
            : null,
          producaoAtual: dispositivo.producaoAtual,
          producaoFuncionario
        }
      });
    } catch (error) {
      console.error('Erro em selecionarArtigo:', error);
      socket.emit('artigoSelecionado', {
        data: {
          deviceToken: data?.deviceToken || null,
          artigo: null,
          error: 'Erro interno ao selecionar artigo'
        }
      });
    }
  });

  console.log('Novo dispositivo conectado:', socket.id);

  // Registra o dispositivo e associa o token ao socket.
  socket.on('registerDevice', async (data) => {
    try {
      const deviceToken = data?.deviceToken;

      if (!deviceToken) {
        socket.emit('deviceRegistered', {
          success: false,
          message: 'Token do dispositivo não informado.',
          data: {
            deviceToken: null,
            usuarioVinculado: false
          }
        });
        return;
      }

      socket.deviceToken = deviceToken;

      console.log('Dispositivo registrado:', deviceToken);

      const Dispositivo = require('./models/Dispositivo');
      const dispositivo = await Dispositivo.findOne({
        deviceToken
      });

      if (dispositivo) {
        dispositivo.status = 'online';
        dispositivo.ultimaAtualizacao = new Date();

        await dispositivo.save();

        const payload =
          await buildDeviceStatusPayload(dispositivo);

        io.emit('deviceStatusUpdate', payload);

        socket.emit('deviceRegistered', {
          success: true,
          message: 'Dispositivo registrado e vinculado!',
          data: {
            deviceToken,
            usuarioVinculado: true
          }
        });
      } else {
        socket.emit('deviceRegistered', {
          success: true,
          message: 'Dispositivo conectado, aguardando vínculo.',
          data: {
            deviceToken,
            usuarioVinculado: false
          }
        });
      }
    } catch (error) {
      console.error('Erro em registerDevice:', error);

      socket.emit('deviceRegistered', {
        success: false,
        message: 'Erro interno ao registrar dispositivo.',
        data: {
          deviceToken: data?.deviceToken || null,
          usuarioVinculado: false
        }
      });
    }
  });

  socket.on('loginFuncionario', async (data) => {
    try {
      const Dispositivo = require('./models/Dispositivo');
      const Funcionario = require('./models/Funcionario');

      const dispositivo = await Dispositivo.findOne({
        deviceToken: data.deviceToken
      });

      if (!dispositivo) {
        socket.emit('loginFailed', {
          message: 'Dispositivo não encontrado'
        });
        return;
      }

      if (!dispositivo.usuario) {
        socket.emit('loginFailed', {
          message: 'Dispositivo não vinculado a um usuário.'
        });
        return;
      }

      let funcionario = null;

      if (data.codigo) {
        funcionario = await Funcionario.findOne({
          codigo: data.codigo,
          usuario: dispositivo.usuario
        });
      } else if (data.funcionarioId) {
        funcionario = await Funcionario.findOne({
          _id: data.funcionarioId,
          usuario: dispositivo.usuario
        });
      }

      if (!funcionario) {
        socket.emit('loginFailed', {
          message:
            'Funcionário não encontrado para a senha/código informado.'
        });
        return;
      }

      dispositivo.funcionarioLogado = funcionario._id;
      dispositivo.status = 'online';
      dispositivo.ultimaAtualizacao = new Date();

      await dispositivo.save();
      await dispositivo.populate('funcionarioLogado');

      const payload =
        await buildDeviceStatusPayload(dispositivo);

      io.emit('deviceStatusUpdate', payload);

      let artigos = [];

      if (dispositivo.usuario) {
        artigos = await Artigo.find({
          criadoPor: dispositivo.usuario,
          status: 'em_producao'
        }).sort({ nome: 1 });
      }

      socket.emit('loginSuccess', {
        data: {
          deviceToken: data.deviceToken,
          funcionario: {
            nome: funcionario.nome
          },
          artigos: artigos.map((art) => ({
            _id: art._id,
            nome: art.nome,
            codigo: art.codigo,
            quantidade: art.quantidade,
            quantidadeAtual: art.quantidadeAtual || 0,
            status: art.status
          }))
        }
      });
    } catch (error) {
      console.error('Erro em loginFuncionario:', error);

      socket.emit('loginFailed', {
        message: 'Erro interno ao realizar login.'
      });
    }
  });

  // Evento para atualizar lista de artigos em tempo real
  socket.on('solicitarArtigosAtualizados', async (data) => {
    try {
      const Dispositivo = require('./models/Dispositivo');

      let usuario = data.usuarioId;
      const deviceToken = data.deviceToken;

      if (!usuario && deviceToken) {
        const dispositivo =
          await Dispositivo.findOne({
            deviceToken
          });

        usuario = dispositivo?.usuario;
      }

      if (!usuario) {
        socket.emit('artigosAtualizados', {
          data: {
            deviceToken,
            artigos: []
          }
        });
        return;
      }

      const artigos = await Artigo.find({
        criadoPor: usuario,
        status: 'em_producao'
      }).sort({ nome: 1 });

      socket.emit('artigosAtualizados', {
        data: {
          deviceToken,
          artigos: artigos.map((art) => ({
            _id: art._id,
            nome: art.nome,
            codigo: art.codigo,
            quantidade: art.quantidade,
            quantidadeAtual: art.quantidadeAtual || 0,
            status: art.status
          }))
        }
      });
    } catch (error) {
      console.error(
        'Erro em solicitarArtigosAtualizados:',
        error
      );

      socket.emit('artigosAtualizados', {
        data: {
          deviceToken: data?.deviceToken || null,
          artigos: []
        }
      });
    }
  });

  socket.on('producao', async (data) => {
    try {
      console.log('Produção recebida:', data);

      const Dispositivo = require('./models/Dispositivo');

      const dispositivo =
        await Dispositivo.findOne({
          deviceToken: data.deviceToken
        });

      if (!dispositivo) {
        console.log(
          'Dispositivo não encontrado para produção:',
          data.deviceToken
        );

        socket.emit('producaoFailed', {
          message: 'Dispositivo não encontrado'
        });
        return;
      }

      if (
        !dispositivo.funcionarioLogado ||
        (!dispositivo.artigo && !dispositivo.operacao)
      ) {
        socket.emit('producaoFailed', {
          message:
            'Funcionário ou artigo não definidos para este dispositivo.'
        });
        return;
      }

      const quantidadeAtual =
        typeof data.quantidade === 'number'
          ? data.quantidade
          : 0;

      const producaoAnterior =
        dispositivo.producaoAtual || 0;

      const incremento =
        quantidadeAtual - producaoAnterior;

      if (incremento <= 0) {
        socket.emit('producaoSuccess', {
          message:
            'Produção recebida (sem incremento).'
        });
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
        artigo =
          await Artigo.findById(dispositivo.artigo);

        if (artigo) {
          const statusAnterior = artigo.status;

          if (
            statusAnterior !== 'em_producao' &&
            !artigo.dataInicioProducao
          ) {
            artigo.dataInicioProducao = agora;
          }

          artigo.quantidadeAtual =
            (artigo.quantidadeAtual || 0) +
            incremento;

          if (
            artigo.quantidade &&
            artigo.quantidadeAtual >= artigo.quantidade
          ) {
            artigo.status = 'finalizado';

            if (statusAnterior !== 'finalizado') {
              artigoFinalizadoAgora = true;
              artigo.dataFimProducao = agora;

              if (artigo.dataInicioProducao) {
                tempoTotalArtigo = Math.floor(
                  (agora -
                    artigo.dataInicioProducao) /
                    1000
                );
              }
            }
          } else if (
            artigo.status !== 'em_producao'
          ) {
            artigo.status = 'em_producao';
          }

          await artigo.save();
        }
      }

      await ProducaoDetalhada.create({
        operacao: dispositivo.operacao,
        artigo: dispositivo.artigo,
        funcionario:
          dispositivo.funcionarioLogado,
        dispositivo: dispositivo._id,
        quantidade: incremento,
        tempoProducao: data.tempoProducao || 0,
        dataInicioPeca: agora,
        dataFimProducao:
          artigoFinalizadoAgora ? agora : null,
        tempoTotalArtigo:
          artigoFinalizadoAgora
            ? tempoTotalArtigo
            : 0
      });

      await dispositivo.populate(
        'funcionarioLogado'
      );

      await dispositivo.populate('operacao');
      await dispositivo.populate('artigo');

      if (dispositivo.artigo && artigo) {
        dispositivo.artigo.quantidadeAtual =
          artigo.quantidadeAtual;
      }

      const matchProducoes = {
        funcionario:
          dispositivo.funcionarioLogado._id
      };

      if (dispositivo.artigo) {
        matchProducoes.artigo =
          dispositivo.artigo._id ||
          dispositivo.artigo;
      } else if (dispositivo.operacao) {
        matchProducoes.operacao =
          dispositivo.operacao._id ||
          dispositivo.operacao;
      }

      const resumoFuncionario =
        await ProducaoDetalhada.aggregate([
          {
            $match: matchProducoes
          },
          {
            $group: {
              _id: null,
              total: {
                $sum: '$quantidade'
              }
            }
          }
        ]);

      const quantidadeFuncionario =
        resumoFuncionario.length
          ? resumoFuncionario[0].total
          : incremento;

      const dispositivoData =
        dispositivo.toObject();

      dispositivoData.operacao =
        dispositivo.operacao;

      dispositivoData.artigo =
        dispositivo.artigo;

      dispositivoData.funcionarioLogado =
        dispositivo.funcionarioLogado;

      dispositivoData.producaoFuncionario =
        quantidadeFuncionario;

      io.emit('productionUpdate', {
        dispositivo: dispositivoData,
        quantidadeFuncionario
      });

      socket.emit('producaoSuccess', {
        message:
          'Produção registrada com sucesso!',
        data: {
          deviceToken: data.deviceToken,
          incremento,
          quantidade: quantidadeAtual,
          quantidadeAtualTotal:
            artigo
              ? artigo.quantidadeAtual
              : quantidadeAtual,
          quantidadeFuncionario,
          artigoId:
            artigo ? artigo._id : null,
          artigoNome:
            artigo ? artigo.nome : null,
          meta:
            artigo ? artigo.quantidade : 0
        }
      });

      if (artigoFinalizadoAgora && artigo) {
        console.log(
          `🎯 Artigo ${artigo.nome} foi finalizado!`
        );

        const dispositivos =
          await Dispositivo.find({
            usuario: artigo.criadoPor
          });

        const artigosEmProducao =
          await Artigo.find({
            criadoPor: artigo.criadoPor,
            status: 'em_producao'
          }).sort({ nome: 1 });

        dispositivos.forEach((disp) => {
          io.emit('artigosAtualizados', {
            data: {
              deviceToken: disp.deviceToken,
              artigos: artigosEmProducao.map(
                (art) => ({
                  _id: art._id,
                  nome: art.nome,
                  codigo: art.codigo,
                  quantidade: art.quantidade,
                  quantidadeAtual:
                    art.quantidadeAtual || 0,
                  status: art.status
                })
              )
            }
          });

          console.log(
            `📡 Dispositivo ${disp.deviceToken} notificado sobre artigo finalizado`
          );
        });
      }
    } catch (error) {
      console.error(
        'Erro ao registrar produção:',
        error
      );

      socket.emit('producaoFailed', {
        message:
          'Erro interno ao registrar produção.'
      });
    }
  });

  socket.on('disconnect', async () => {
    try {
      const Dispositivo =
        require('./models/Dispositivo');

      if (socket.deviceToken) {
        const dispositivo =
          await Dispositivo.findOne({
            deviceToken: socket.deviceToken
          });

        if (dispositivo) {
          dispositivo.status = 'offline';
          dispositivo.ultimaAtualizacao =
            new Date();

          await dispositivo.save();

          const payload =
            await buildDeviceStatusPayload(
              dispositivo
            );

          io.emit(
            'deviceStatusUpdate',
            payload
          );
        }
      } else {
        const doisMinutosAtras =
          new Date(
            Date.now() -
              2 * 60 * 1000
          );

        const dispositivos =
          await Dispositivo.find({
            status: 'online',
            ultimaAtualizacao: {
              $lt: doisMinutosAtras
            }
          });

        for (const dispositivo of dispositivos) {
          dispositivo.status = 'offline';
          dispositivo.ultimaAtualizacao =
            new Date();

          await dispositivo.save();

          const payload =
            await buildDeviceStatusPayload(
              dispositivo
            );

          io.emit(
            'deviceStatusUpdate',
            payload
          );
        }
      }
    } catch (error) {
      console.error(
        'Erro ao tratar disconnect:',
        error
      );
    }
  });
});

// Endpoint simples para verificar se o backend está online
app.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'Costura Ágil Backend',
    socketIO: true,
    deviceActivation: true
  });
});

// Conexão com MongoDB - iniciar servidor somente após conexão bem-sucedida
const mongoUri =
  process.env.MONGO_URI ||
  'mongodb://localhost:27017/production-monitor';

mongoose
  .connect(mongoUri, {})
  .then(async () => {
    const PORT =
      process.env.PORT || 3001;

    http.listen(PORT, () => {
      console.log(
        `API + Socket.IO rodando na porta ${PORT}`
      );

      console.log(
        'Rota PIX disponível em: /api/device/activation'
      );
    });
  })
  .catch((err) => {
    console.error(
      'Falha ao conectar ao MongoDB:',
      err.message || err
    );

    console.error(
      'Verifique se o MongoDB está rodando e se MONGO_URI está correto.'
    );
  });

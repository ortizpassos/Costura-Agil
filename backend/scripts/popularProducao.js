const mongoose = require('mongoose');

const Producao = require('../models/Producao');
const Dispositivo = require('../models/Dispositivo');
const Funcionario = require('../models/Funcionario');
const Operacao = require('../models/Operacao');

mongoose.connect('mongodb://localhost:27017/monitor-ellas')
  .then(async () => {
    console.log('Conectado ao MongoDB');
    
    // Busca dispositivos, funcionários e operações existentes
    const dispositivos = await Dispositivo.find().limit(3);
    const funcionarios = await Funcionario.find().limit(3);
    const operacoes = await Operacao.find().limit(3);

    if (dispositivos.length === 0 || funcionarios.length === 0 || operacoes.length === 0) {
      console.log('Não há dispositivos, funcionários ou operações cadastrados. Execute o sistema primeiro.');
      process.exit(0);
    }

    console.log('Dispositivos encontrados:', dispositivos.length);
    console.log('Funcionários encontrados:', funcionarios.length);
    console.log('Operações encontradas:', operacoes.length);

    // Limpa dados antigos de produção
    await Producao.deleteMany({});
    console.log('Dados antigos de produção removidos');

    // Cria dados de produção para os últimos 7 dias
    const producoes = [];
    for (let i = 0; i < 7; i++) {
      const data = new Date();
      data.setDate(data.getDate() - i);
      data.setHours(8, 0, 0, 0); // 8h da manhã

      // Cria múltiplas produções para cada dia
      for (let j = 0; j < 5; j++) {
        const horaProducao = new Date(data);
        horaProducao.setHours(8 + j * 2); // Produção a cada 2 horas

        producoes.push({
          funcionario: funcionarios[j % funcionarios.length]._id,
          dispositivo: dispositivos[j % dispositivos.length]._id,
          operacao: operacoes[j % operacoes.length]._id,
          quantidade: Math.floor(Math.random() * 50) + 10, // 10 a 60 unidades
          tempoProducao: Math.floor(Math.random() * 3600) + 1800, // 30min a 1h30 em segundos
          dataHora: horaProducao
        });
      }
    }

    await Producao.insertMany(producoes);
    console.log(`${producoes.length} registros de produção criados com sucesso!`);

    // Mostra resumo
    const total = await Producao.countDocuments();
    console.log('Total de registros no banco:', total);

    process.exit(0);
  })
  .catch(err => {
    console.error('Erro:', err);
    process.exit(1);
  });

const express = require("express");
const router = express.Router();
const Dispositivo = require("../models/Dispositivo");
const ProducaoDetalhada = require("../models/ProducaoDetalhada");
const { autenticar } = require('./authRoutes');

// Criar novo dispositivo
router.post("/", autenticar, async (req, res) => {
  console.log('REQ.BODY:', req.body); // LOG PARA DEBUG
  try {
    // Associa o dispositivo ao usuário autenticado
    const usuarioId = req.usuario.id;
    const novoDispositivo = new Dispositivo({ ...req.body, usuario: usuarioId });
    await novoDispositivo.save();
    res.status(201).json(novoDispositivo);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Obter todos os dispositivos
router.get("/", autenticar, async (req, res) => {
  try {
    // Filtra dispositivos pelo usuário autenticado
    const usuarioId = req.usuario.id;
    const dispositivos = await Dispositivo.find({ usuario: usuarioId })
      .populate('funcionarioLogado')
      .populate('operacao')
      .populate('artigo');

    const dispositivosComTotais = await Promise.all(dispositivos.map(async (dispositivo) => {
      const dispositivoObj = dispositivo.toObject();
      const possuiFuncionario = Boolean(dispositivoObj.funcionarioLogado);
      const artigoId = dispositivoObj.artigo?._id;
      const operacaoId = dispositivoObj.operacao?._id;
      const filtro = {};
      if (artigoId) {
        filtro.artigo = artigoId;
      } else if (operacaoId) {
        filtro.operacao = operacaoId;
      }

      if (possuiFuncionario && Object.keys(filtro).length) {
        const resumoFuncionario = await ProducaoDetalhada.aggregate([
          {
            $match: {
              ...filtro,
              funcionario: dispositivoObj.funcionarioLogado._id
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$quantidade' }
            }
          }
        ]);
        dispositivoObj.producaoFuncionario = resumoFuncionario.length ? resumoFuncionario[0].total : 0;
      } else {
        dispositivoObj.producaoFuncionario = 0;
      }
      return dispositivoObj;
    }));

    res.json(dispositivosComTotais);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Obter dispositivo por ID
router.get("/:id", autenticar, async (req, res) => {
  try {
    const dispositivo = await Dispositivo.findById(req.params.id)
      .populate('funcionarioLogado')
      .populate('operacao');
    if (!dispositivo) return res.status(404).json({ message: "Dispositivo não encontrado" });
    res.json(dispositivo);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Atualizar dispositivo
router.patch("/:id", autenticar, async (req, res) => {
  try {
    const dispositivo = await Dispositivo.findById(req.params.id);
    if (!dispositivo) return res.status(404).json({ message: "Dispositivo não encontrado" });

    // Bloquear alteração direta do campo 'status' via PATCH REST
    if ('status' in req.body) {
      delete req.body.status;
    }
    Object.assign(dispositivo, req.body);
    await dispositivo.save();
    res.json(dispositivo);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Deletar dispositivo
router.delete("/:id", autenticar, async (req, res) => {
  try {
    const dispositivo = await Dispositivo.findById(req.params.id);
    if (!dispositivo) return res.status(404).json({ message: "Dispositivo não encontrado" });

    await Dispositivo.deleteOne({ _id: req.params.id });
    res.json({ message: "Dispositivo deletado" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;


const express = require('express');
const crypto = require('crypto');
const DeviceActivation = require('../models/DeviceActivation');
const Dispositivo = require('../models/Dispositivo');
const { createPixPayment, getPayment } = require('../services/mercadoPagoService');

const router = express.Router();

function activationAmount() {
  const value = Number(process.env.DEVICE_ACTIVATION_PRICE || '1.00');
  if (!Number.isFinite(value) || value <= 0) return 1.00;
  return Math.round(value * 100) / 100;
}

function normalizeDeviceId(value) {
  return String(value || '').replace(/[^A-Za-z0-9_-]/g, '').toUpperCase().slice(0, 40);
}

function makeNumericToken15() {
  // 15 dígitos, primeiro dígito nunca zero.
  const bytes = crypto.randomBytes(15);
  let token = String((bytes[0] % 9) + 1);
  for (let i = 1; i < 15; i++) token += String(bytes[i] % 10);
  return token;
}

async function generateUniqueDeviceToken() {
  for (let attempt = 0; attempt < 30; attempt++) {
    const token = makeNumericToken15();
    const [activationExists, deviceExists] = await Promise.all([
      DeviceActivation.exists({ deviceToken: token }),
      Dispositivo.exists({ deviceToken: token })
    ]);
    if (!activationExists && !deviceExists) return token;
  }
  throw new Error('Não foi possível gerar token único após várias tentativas.');
}

router.get('/config', (req, res) => {
  res.json({
    amount: activationAmount(),
    currency: 'BRL'
  });
});

router.post('/create', async (req, res) => {
  try {
    const deviceId = normalizeDeviceId(req.body?.deviceId);
    if (!deviceId) return res.status(400).json({ message: 'deviceId é obrigatório.' });

    const amount = activationAmount();
    let activation = await DeviceActivation.findOne({ deviceId });

    // Recuperação permanente: se o hardware já pagou/ativou, devolve o mesmo token.
    if (activation?.activated && activation.deviceToken) {
      return res.json({
        alreadyActivated: true,
        status: 'approved',
        deviceToken: activation.deviceToken,
        amount: activation.amount,
        currency: activation.currency
      });
    }

    // Evita gerar vários PIX para o mesmo clique/retry enquanto ainda há um pendente.
    if (activation?.paymentStatus === 'pending' && activation.paymentId && activation.qrCode) {
      return res.json({
        alreadyActivated: false,
        paymentId: activation.paymentId,
        qrCode: activation.qrCode,
        status: activation.paymentStatus,
        amount: activation.amount,
        currency: activation.currency
      });
    }

    const payment = await createPixPayment({ deviceId, amount });
    const qrCode = payment?.point_of_interaction?.transaction_data?.qr_code;
    const paymentId = payment?.id ? String(payment.id) : '';

    if (!paymentId || !qrCode) {
      console.error('[ATIVACAO] Mercado Pago não retornou paymentId/qrCode:', payment);
      return res.status(502).json({ message: 'Mercado Pago não retornou o QR Code PIX.' });
    }

    activation = await DeviceActivation.findOneAndUpdate(
      { deviceId },
      {
        $set: {
          paymentId,
          paymentStatus: payment.status || 'pending',
          amount,
          currency: payment.currency_id || 'BRL',
          qrCode,
          activated: false,
          lastCheckedAt: new Date()
        },
        $setOnInsert: { deviceId }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({
      alreadyActivated: false,
      paymentId: activation.paymentId,
      qrCode: activation.qrCode,
      status: activation.paymentStatus,
      amount: activation.amount,
      currency: activation.currency
    });
  } catch (err) {
    console.error('[ATIVACAO] Erro ao criar PIX:', err.response || err);
    res.status(err.statusCode || 500).json({
      message: err.message || 'Erro ao criar PIX.'
    });
  }
});

router.get('/status', async (req, res) => {
  try {
    const deviceId = normalizeDeviceId(req.query.deviceId);
    const paymentId = String(req.query.paymentId || '').trim();

    if (!deviceId || !paymentId) {
      return res.status(400).json({ message: 'deviceId e paymentId são obrigatórios.' });
    }

    const activation = await DeviceActivation.findOne({ deviceId, paymentId });
    if (!activation) return res.status(404).json({ message: 'Ativação não encontrada.' });

    if (activation.activated && activation.deviceToken) {
      return res.json({
        status: 'approved',
        deviceToken: activation.deviceToken,
        amount: activation.amount,
        currency: activation.currency
      });
    }

    const payment = await getPayment(paymentId);
    const status = String(payment.status || 'unknown');
    const expectedReference = `device_activation:${deviceId}`;
    const returnedAmount = Number(payment.transaction_amount);

    // Proteções: o pagamento consultado precisa ser exatamente o criado para este hardware.
    if (payment.external_reference !== expectedReference) {
      console.error('[ATIVACAO] external_reference divergente', payment.external_reference, expectedReference);
      return res.status(409).json({ message: 'Pagamento não pertence a este dispositivo.' });
    }
    if (Math.abs(returnedAmount - activation.amount) > 0.001) {
      console.error('[ATIVACAO] valor divergente', returnedAmount, activation.amount);
      return res.status(409).json({ message: 'Valor do pagamento diverge da ativação.' });
    }

    activation.paymentStatus = status;
    activation.lastCheckedAt = new Date();

    if (status === 'approved') {
      if (!activation.deviceToken) activation.deviceToken = await generateUniqueDeviceToken();
      activation.activated = true;
      activation.paidAt = activation.paidAt || new Date();
      // Depois de aprovado não precisamos reter o QR em banco.
      activation.qrCode = null;
    }

    await activation.save();

    res.json({
      status,
      deviceToken: status === 'approved' ? activation.deviceToken : undefined,
      amount: activation.amount,
      currency: activation.currency
    });
  } catch (err) {
    console.error('[ATIVACAO] Erro ao consultar pagamento:', err.response || err);
    res.status(err.statusCode || 500).json({
      message: err.message || 'Erro ao consultar pagamento.'
    });
  }
});

module.exports = router;

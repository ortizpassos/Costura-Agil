const express = require('express');
const crypto = require('crypto');

const HardwareDevice =
  require('../models/HardwareDevice');

const ProvisioningActivation =
  require('../models/ProvisioningActivation');

const DeviceActivation =
  require('../models/DeviceActivation');

const Dispositivo =
  require('../models/Dispositivo');

const {
  autenticar
} = require('./authRoutes');

const {
  createPixPayment,
  getPayment
} = require('../services/mercadoPagoService');

const {
  emitToHardware
} = require('../services/provisioningHub');

const router =
  express.Router();

function activationAmount() {
  const value =
    Number(
      process.env
        .DEVICE_ACTIVATION_PRICE ||
      '1.00'
    );

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return 1.00;
  }

  return Math.round(
    value * 100
  ) / 100;
}

function normalizeDeviceId(value) {
  return String(value || '')
    .replace(
      /[^A-Za-z0-9_-]/g,
      ''
    )
    .toUpperCase()
    .slice(0, 40);
}

function validDeviceType(value) {
  return [
    'producao',
    'revisao_rfid',
    'cadastro_rfid'
  ].includes(value);
}

function defaultName(
  deviceType,
  deviceId
) {
  const labels = {
    producao:
      'Dispositivo de Produção',

    revisao_rfid:
      'Revisão RFID',

    cadastro_rfid:
      'Leitor de Cadastro RFID'
  };

  return (
    labels[deviceType] ||
    'Dispositivo'
  ) + ' ' + deviceId;
}

function makeNumericToken15() {
  const bytes =
    crypto.randomBytes(15);

  let token =
    String(
      (bytes[0] % 9) + 1
    );

  for (
    let i = 1;
    i < 15;
    i++
  ) {
    token +=
      String(bytes[i] % 10);
  }

  return token;
}

async function generateUniqueToken() {
  for (
    let attempt = 0;
    attempt < 40;
    attempt++
  ) {
    const token =
      makeNumericToken15();

    const [
      deviceExists,
      oldActivationExists
    ] = await Promise.all([
      Dispositivo.exists({
        deviceToken: token
      }),

      DeviceActivation.exists({
        deviceToken: token
      })
    ]);

    if (
      !deviceExists &&
      !oldActivationExists
    ) {
      return token;
    }
  }

  throw new Error(
    'Não foi possível gerar token único.'
  );
}

async function hardwareCanBeLinked(
  hardware,
  tokenBeingLinked = ''
) {
  if (!hardware) {
    return {
      ok: false,
      message:
        'Hardware não encontrado.'
    };
  }

  if (
    hardware.linkedDeviceToken &&
    hardware.linkedDeviceToken !==
      tokenBeingLinked
  ) {
    return {
      ok: false,
      message:
        'Este hardware já está vinculado a outra licença.'
    };
  }

  const licenseUsingHardware =
    await Dispositivo.findOne({
      hardwareDeviceId:
        hardware.deviceId,
      ...(tokenBeingLinked
        ? {
            deviceToken: {
              $ne: tokenBeingLinked
            }
          }
        : {})
    });

  if (licenseUsingHardware) {
    return {
      ok: false,
      message:
        'Este Device ID já está vinculado a outra licença.'
    };
  }

  return { ok: true };
}

// ----------------------------------------------------------
// CONFIGURAÇÃO DE PREÇO
// ----------------------------------------------------------
router.get(
  '/activation/config',
  autenticar,
  (req, res) => {
    res.json({
      amount:
        activationAmount(),
      currency: 'BRL'
    });
  }
);

// ----------------------------------------------------------
// BUSCAR HARDWARE PELO DEVICE ID
// ----------------------------------------------------------
router.get(
  '/hardware/:deviceId',
  autenticar,
  async (req, res) => {
    try {
      const deviceId =
        normalizeDeviceId(
          req.params.deviceId
        );

      const hardware =
        await HardwareDevice.findOne({
          deviceId
        }).lean();

      if (!hardware) {
        return res.status(404).json({
          found: false,
          message:
            'Device ID ainda não apareceu no backend. ' +
            'Confirme se o equipamento está conectado à internet.'
        });
      }

      let linkedLicense = null;

      if (
        hardware.linkedDeviceToken
      ) {
        const license =
          await Dispositivo.findOne({
            deviceToken:
              hardware
                .linkedDeviceToken
          })
            .select(
              'deviceToken usuario nome deviceType'
            )
            .lean();

        if (license) {
          linkedLicense = {
            nome:
              license.nome,
            deviceType:
              license.deviceType,
            belongsToCurrentUser:
              String(
                license.usuario
              ) ===
              String(
                req.usuario.id
              )
          };
        }
      }

      res.json({
        found: true,

        hardware: {
          deviceId:
            hardware.deviceId,

          deviceType:
            hardware.deviceType,

          status:
            hardware.status,

          firmwareVersion:
            hardware.firmwareVersion,

          lastSeenAt:
            hardware.lastSeenAt,

          linked:
            Boolean(
              hardware
                .linkedDeviceToken
            )
        },

        linkedLicense
      });
    } catch (err) {
      res.status(500).json({
        message:
          err.message
      });
    }
  }
);

// ----------------------------------------------------------
// CRIAR NOVA LICENÇA VIA PIX
// ----------------------------------------------------------
router.post(
  '/activation/create',
  autenticar,
  async (req, res) => {
    try {
      const deviceId =
        normalizeDeviceId(
          req.body?.deviceId
        );

      if (!deviceId) {
        return res.status(400).json({
          message:
            'deviceId é obrigatório.'
        });
      }

      const hardware =
        await HardwareDevice.findOne({
          deviceId
        });

      if (!hardware) {
        return res.status(404).json({
          message:
            'Hardware não encontrado. ' +
            'Conecte o dispositivo à internet primeiro.'
        });
      }

      if (
        hardware.status !==
        'online'
      ) {
        return res.status(409).json({
          message:
            'O hardware está offline.'
        });
      }

      if (
        hardware.linkedDeviceToken
      ) {
        return res.status(409).json({
          message:
            'Este hardware já está vinculado a uma licença.'
        });
      }

      if (
        !validDeviceType(
          hardware.deviceType
        )
      ) {
        return res.status(400).json({
          message:
            'Tipo de hardware inválido.'
        });
      }

      const amount =
        activationAmount();

      // Reaproveita PIX pendente do mesmo usuário/hardware.
      let activation =
        await ProvisioningActivation
          .findOne({
            usuario:
              req.usuario.id,
            deviceId,
            paymentStatus:
              'pending'
          })
          .sort({
            createdAt: -1
          });

      if (
        activation &&
        activation.paymentId &&
        activation.qrCode
      ) {
        return res.json({
          activationId:
            activation._id,

          paymentId:
            activation.paymentId,

          status:
            activation
              .paymentStatus,

          amount:
            activation.amount,

          currency:
            activation.currency,

          qrCode:
            activation.qrCode,

          qrCodeBase64:
            activation
              .qrCodeBase64
        });
      }

      activation =
        await ProvisioningActivation.create({
          usuario:
            req.usuario.id,

          deviceId,

          deviceType:
            hardware.deviceType,

          nome:
            String(
              req.body?.nome ||
              defaultName(
                hardware.deviceType,
                deviceId
              )
            ).trim(),

          paymentStatus:
            'creating',

          amount,

          currency:
            'BRL'
        });

      const externalReference =
        `license_activation:` +
        `${activation._id}:` +
        `${deviceId}`;

      const payment =
        await createPixPayment({
          deviceId,
          amount,

          externalReference,

          description:
            `Licenca ${hardware.deviceType} ${deviceId}`
        });

      const transactionData =
        payment
          ?.point_of_interaction
          ?.transaction_data;

      const paymentId =
        payment?.id
          ? String(payment.id)
          : '';

      const qrCode =
        String(
          transactionData
            ?.qr_code ||
          ''
        );

      const qrCodeBase64 =
        String(
          transactionData
            ?.qr_code_base64 ||
          ''
        );

      if (
        !paymentId ||
        !qrCode
      ) {
        activation.paymentStatus =
          'error';

        await activation.save();

        return res.status(502).json({
          message:
            'Mercado Pago não retornou o QR Code PIX.'
        });
      }

      activation.paymentId =
        paymentId;

      activation.paymentStatus =
        payment.status ||
        'pending';

      activation.currency =
        payment.currency_id ||
        'BRL';

      activation.qrCode =
        qrCode;

      activation.qrCodeBase64 =
        qrCodeBase64;

      activation.lastCheckedAt =
        new Date();

      await activation.save();

      res.json({
        activationId:
          activation._id,

        paymentId,

        status:
          activation
            .paymentStatus,

        amount,

        currency:
          activation.currency,

        qrCode,

        qrCodeBase64
      });
    } catch (err) {
      console.error(
        '[PROVISIONING] activation/create:',
        err.response || err
      );

      res
        .status(
          err.statusCode ||
          500
        )
        .json({
          message:
            err.message ||
            'Erro ao criar ativação.'
        });
    }
  }
);

// ----------------------------------------------------------
// CONSULTAR PIX E CRIAR LICENÇA
// ----------------------------------------------------------
router.get(
  '/activation/status',
  autenticar,
  async (req, res) => {
    try {
      const activationId =
        String(
          req.query.activationId ||
          ''
        ).trim();

      if (!activationId) {
        return res.status(400).json({
          message:
            'activationId é obrigatório.'
        });
      }

      const activation =
        await ProvisioningActivation.findOne({
          _id:
            activationId,
          usuario:
            req.usuario.id
        });

      if (!activation) {
        return res.status(404).json({
          message:
            'Ativação não encontrada.'
        });
      }

      // Já processada antes.
      if (
        activation.licenseCreated &&
        activation.licenseToken
      ) {
        return res.json({
          status: 'approved',

          deviceToken:
            activation
              .licenseToken,

          hardwareLinked:
            activation
              .hardwareLinked,

          amount:
            activation.amount,

          currency:
            activation.currency
        });
      }

      if (!activation.paymentId) {
        return res.status(409).json({
          message:
            'Pagamento ainda não foi criado.'
        });
      }

      const payment =
        await getPayment(
          activation.paymentId
        );

      const status =
        String(
          payment.status ||
          'unknown'
        );

      const expectedReference =
        `license_activation:` +
        `${activation._id}:` +
        `${activation.deviceId}`;

      if (
        payment.external_reference !==
        expectedReference
      ) {
        return res.status(409).json({
          message:
            'Pagamento não pertence a esta ativação.'
        });
      }

      const returnedAmount =
        Number(
          payment.transaction_amount
        );

      if (
        Math.abs(
          returnedAmount -
          activation.amount
        ) > 0.001
      ) {
        return res.status(409).json({
          message:
            'Valor do pagamento diverge da ativação.'
        });
      }

      activation.paymentStatus =
        status;

      activation.lastCheckedAt =
        new Date();

      if (status !== 'approved') {
        await activation.save();

        return res.json({
          status,

          amount:
            activation.amount,

          currency:
            activation.currency
        });
      }

      activation.paidAt =
        activation.paidAt ||
        new Date();

      if (
        !activation
          .licenseToken
      ) {
        activation.licenseToken =
          await generateUniqueToken();
      }

      // Garante que a licença existe uma única vez.
      let license =
        await Dispositivo.findOne({
          deviceToken:
            activation
              .licenseToken
        });

      if (!license) {
        license =
          await Dispositivo.create({
            usuario:
              activation.usuario,

            deviceToken:
              activation
                .licenseToken,

            deviceType:
              activation
                .deviceType,

            nome:
              activation.nome ||
              defaultName(
                activation
                  .deviceType,
                activation
                  .deviceId
              ),

            activated:
              true,

            activationPaid:
              true,

            activationPaymentId:
              activation
                .paymentId,

            status:
              'offline'
          });
      }

      activation.licenseCreated =
        true;

      // Tenta vincular ao hardware que originou o PIX.
      const hardware =
        await HardwareDevice.findOne({
          deviceId:
            activation.deviceId
        });

      let linked = false;

      if (hardware) {
        const validation =
          await hardwareCanBeLinked(
            hardware,
            license.deviceToken
          );

        if (validation.ok) {
          const oldDeviceId =
            license
              .hardwareDeviceId ||
            '';

          if (
            oldDeviceId &&
            oldDeviceId !==
              hardware.deviceId
          ) {
            license.hardwareHistory.push({
              deviceId:
                oldDeviceId,

              linkedAt:
                license
                  .hardwareLinkedAt ||
                new Date(),

              unlinkedAt:
                new Date(),

              reason:
                'hardware_replacement'
            });
          }

          license.hardwareDeviceId =
            hardware.deviceId;

          license.hardwareLinkedAt =
            new Date();

          await license.save();

          hardware.linkedDeviceToken =
            license.deviceToken;

          await hardware.save();

          linked = true;

          emitToHardware(
            hardware.deviceId,
            'hardwareLinked',
            {
              success: true,

              deviceId:
                hardware.deviceId,

              deviceToken:
                license.deviceToken,

              deviceType:
                license.deviceType
            }
          );
        }
      }

      activation.hardwareLinked =
        linked;

      // PIX não precisa mais ficar armazenado.
      activation.qrCode = '';
      activation.qrCodeBase64 = '';

      await activation.save();

      res.json({
        status: 'approved',

        deviceToken:
          license.deviceToken,

        hardwareLinked:
          linked,

        amount:
          activation.amount,

        currency:
          activation.currency
      });
    } catch (err) {
      console.error(
        '[PROVISIONING] activation/status:',
        err.response || err
      );

      res
        .status(
          err.statusCode ||
          500
        )
        .json({
          message:
            err.message ||
            'Erro ao consultar ativação.'
        });
    }
  }
);

// ----------------------------------------------------------
// VINCULAR / SUBSTITUIR HARDWARE SEM NOVO PAGAMENTO
// ----------------------------------------------------------
router.post(
  '/licenses/:deviceToken/link-hardware',
  autenticar,
  async (req, res) => {
    try {
      const deviceToken =
        String(
          req.params.deviceToken ||
          ''
        ).trim();

      const newDeviceId =
        normalizeDeviceId(
          req.body?.deviceId
        );

      if (!newDeviceId) {
        return res.status(400).json({
          message:
            'Novo Device ID é obrigatório.'
        });
      }

      const license =
        await Dispositivo.findOne({
          deviceToken,
          usuario:
            req.usuario.id
        });

      if (!license) {
        return res.status(404).json({
          message:
            'Licença/token não encontrado para este usuário.'
        });
      }

      const hardware =
        await HardwareDevice.findOne({
          deviceId:
            newDeviceId
        });

      if (!hardware) {
        return res.status(404).json({
          message:
            'Novo hardware não encontrado. ' +
            'Conecte-o à internet primeiro.'
        });
      }

      if (
        hardware.deviceType !==
        license.deviceType
      ) {
        return res.status(409).json({
          message:
            `O hardware é do tipo ${hardware.deviceType}, ` +
            `mas a licença é do tipo ${license.deviceType}.`
        });
      }

      const validation =
        await hardwareCanBeLinked(
          hardware,
          license.deviceToken
        );

      if (!validation.ok) {
        return res.status(409).json({
          message:
            validation.message
        });
      }

      const oldDeviceId =
        license.hardwareDeviceId
          ? String(
              license
                .hardwareDeviceId
            )
          : '';

      if (
        oldDeviceId ===
        newDeviceId
      ) {
        return res.json({
          success: true,
          alreadyLinked: true,
          deviceToken:
            license.deviceToken,
          hardwareDeviceId:
            newDeviceId
        });
      }

      if (oldDeviceId) {
        license.hardwareHistory.push({
          deviceId:
            oldDeviceId,

          linkedAt:
            license
              .hardwareLinkedAt ||
            new Date(),

          unlinkedAt:
            new Date(),

          reason:
            'hardware_replacement'
        });

        await HardwareDevice.updateOne(
          {
            deviceId:
              oldDeviceId,
            linkedDeviceToken:
              license.deviceToken
          },
          {
            $set: {
              linkedDeviceToken:
                ''
            }
          }
        );

        emitToHardware(
          oldDeviceId,
          'hardwareUnlinked',
          {
            success: true,
            reason:
              'hardware_replacement'
          }
        );
      }

      license.hardwareDeviceId =
        newDeviceId;

      license.hardwareLinkedAt =
        new Date();

      await license.save();

      hardware.linkedDeviceToken =
        license.deviceToken;

      await hardware.save();

      emitToHardware(
        newDeviceId,
        'hardwareLinked',
        {
          success: true,
          deviceId:
            newDeviceId,
          deviceToken:
            license.deviceToken,
          deviceType:
            license.deviceType
        }
      );

      res.json({
        success: true,

        deviceToken:
          license.deviceToken,

        hardwareDeviceId:
          newDeviceId,

        previousHardwareDeviceId:
          oldDeviceId ||
          null
      });
    } catch (err) {
      console.error(
        '[PROVISIONING] link-hardware:',
        err
      );

      if (
        err?.code ===
        11000
      ) {
        return res.status(409).json({
          message:
            'Este Device ID já está associado a outra licença.'
        });
      }

      res.status(500).json({
        message:
          err.message
      });
    }
  }
);

module.exports = router;

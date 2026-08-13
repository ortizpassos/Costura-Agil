const HardwareDevice = require('../models/HardwareDevice');
const Dispositivo = require('../models/Dispositivo');

const {
  setIO,
  roomForHardware
} = require('../services/provisioningHub');

function normalizeDeviceId(value) {
  return String(value || '')
    .replace(/[^A-Za-z0-9_-]/g, '')
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

function configurarSocketProvisioning(io) {
  setIO(io);

  io.on('connection', (socket) => {

    /**
     * Usado por hardware ainda sem token e também pelo novo
     * hardware após substituição.
     *
     * Payload:
     * {
     *   deviceId: "RFID-A4C138",
     *   deviceType: "cadastro_rfid",
     *   firmwareVersion: "1.0.0",
     *   deviceToken: "" // opcional
     * }
     */
    socket.on(
      'registerHardware',
      async (data = {}) => {
        try {
          const deviceId =
            normalizeDeviceId(
              data.deviceId
            );

          const deviceType =
            String(
              data.deviceType || ''
            ).trim();

          if (!deviceId) {
            return socket.emit(
              'hardwareRegistered',
              {
                success: false,
                message:
                  'deviceId não informado.'
              }
            );
          }

          if (
            !validDeviceType(deviceType)
          ) {
            return socket.emit(
              'hardwareRegistered',
              {
                success: false,
                message:
                  'deviceType inválido.'
              }
            );
          }

          socket.hardwareDeviceId =
            deviceId;

          socket.join(
            roomForHardware(deviceId)
          );

          let hardware =
            await HardwareDevice.findOneAndUpdate(
              { deviceId },
              {
                $set: {
                  deviceType,
                  status: 'online',
                  firmwareVersion:
                    String(
                      data.firmwareVersion ||
                      ''
                    ),
                  ipAddress:
                    String(
                      socket.handshake
                        ?.address || ''
                    ),
                  lastSeenAt:
                    new Date()
                },
                $setOnInsert: {
                  deviceId
                }
              },
              {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true
              }
            );

          const informedToken =
            String(
              data.deviceToken || ''
            ).trim();

          let linked = false;
          let deviceToken = '';

          if (informedToken) {
            const license =
              await Dispositivo.findOne({
                deviceToken:
                  informedToken,
                hardwareDeviceId:
                  deviceId
              });

            if (license) {
              linked = true;
              deviceToken =
                license.deviceToken;

              hardware.linkedDeviceToken =
                license.deviceToken;

              await hardware.save();
            }
          } else if (
            hardware.linkedDeviceToken
          ) {
            const license =
              await Dispositivo.findOne({
                deviceToken:
                  hardware.linkedDeviceToken,
                hardwareDeviceId:
                  deviceId
              });

            if (license) {
              linked = true;
              deviceToken =
                license.deviceToken;
            } else {
              hardware.linkedDeviceToken =
                '';

              await hardware.save();
            }
          }

          socket.emit(
            'hardwareRegistered',
            {
              success: true,
              deviceId,
              deviceType,
              linked,
              deviceToken:
                linked
                  ? deviceToken
                  : undefined
            }
          );
        } catch (err) {
          console.error(
            '[PROVISIONING] registerHardware:',
            err
          );

          socket.emit(
            'hardwareRegistered',
            {
              success: false,
              message:
                'Erro interno ao registrar hardware.'
            }
          );
        }
      }
    );

    socket.on(
      'hardwareHeartbeat',
      async () => {
        try {
          if (
            !socket.hardwareDeviceId
          ) {
            return;
          }

          await HardwareDevice.updateOne(
            {
              deviceId:
                socket.hardwareDeviceId
            },
            {
              $set: {
                status: 'online',
                lastSeenAt: new Date()
              }
            }
          );
        } catch (err) {
          console.error(
            '[PROVISIONING] heartbeat:',
            err.message
          );
        }
      }
    );

    socket.on(
      'disconnect',
      async () => {
        try {
          if (
            !socket.hardwareDeviceId
          ) {
            return;
          }

          await HardwareDevice.updateOne(
            {
              deviceId:
                socket.hardwareDeviceId
            },
            {
              $set: {
                status: 'offline',
                lastSeenAt: new Date()
              }
            }
          );
        } catch (err) {
          console.error(
            '[PROVISIONING] disconnect:',
            err.message
          );
        }
      }
    );
  });
}

module.exports =
  configurarSocketProvisioning;

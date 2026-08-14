const HardwareDevice =
  require('../models/HardwareDevice');

const Dispositivo =
  require('../models/Dispositivo');

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

/**
 * Atualiza o status da licença/dispositivo principal
 * e avisa o frontend.
 */
async function syncLicenseStatus(
  io,
  deviceToken,
  status
) {
  if (!deviceToken) {
    return null;
  }

  const license =
    await Dispositivo.findOneAndUpdate(
      {
        deviceToken
      },
      {
        $set: {
          status,
          ultimaAtualizacao:
            new Date()
        }
      },
      {
        new: true
      }
    )
      .populate('operacao')
      .populate('artigo')
      .populate('funcionarioLogado');

  if (!license) {
    return null;
  }

  io.emit(
    'deviceStatusUpdate',
    license.toObject()
  );

  return license;
}

function configurarSocketProvisioning(io) {
  setIO(io);

  io.on('connection', (socket) => {

    // ========================================================
    // REGISTRO DO HARDWARE
    // ========================================================

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
            !validDeviceType(
              deviceType
            )
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
            roomForHardware(
              deviceId
            )
          );

          let hardware =
            await HardwareDevice
              .findOneAndUpdate(
                {
                  deviceId
                },
                {
                  $set: {
                    deviceType,
                    status:
                      'online',
                    firmwareVersion:
                      String(
                        data
                          .firmwareVersion ||
                        ''
                      ),
                    ipAddress:
                      String(
                        socket
                          .handshake
                          ?.address ||
                        ''
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
                  setDefaultsOnInsert:
                    true
                }
              );

          const informedToken =
            String(
              data.deviceToken ||
              ''
            ).trim();

          let linked =
            false;

          let deviceToken =
            '';

          // --------------------------------------------------
          // 1. ESP32 informou token salvo na NVS
          // --------------------------------------------------

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

              // CORREÇÃO:
              // mantém também Dispositivo online.
              await syncLicenseStatus(
                io,
                license.deviceToken,
                'online'
              );
            }
          }

          // --------------------------------------------------
          // 2. Hardware já possui token vinculado no backend
          // --------------------------------------------------

          else if (
            hardware
              .linkedDeviceToken
          ) {
            const license =
              await Dispositivo.findOne({
                deviceToken:
                  hardware
                    .linkedDeviceToken,

                hardwareDeviceId:
                  deviceId
              });

            if (license) {
              linked = true;

              deviceToken =
                license.deviceToken;

              // CORREÇÃO:
              // atualiza status da licença.
              await syncLicenseStatus(
                io,
                license.deviceToken,
                'online'
              );

            } else {
              hardware.linkedDeviceToken =
                '';

              await hardware.save();
            }
          }

          // Guarda token no socket para heartbeat/disconnect.
          socket.linkedDeviceToken =
            linked
              ? deviceToken
              : '';

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

          console.log(
            `[PROVISIONING] Hardware ${deviceId} registrado. ` +
            `Tipo=${deviceType} ` +
            `linked=${linked} ` +
            `token=${linked ? deviceToken : '<sem token>'}`
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

    // ========================================================
    // HEARTBEAT
    // ========================================================

    socket.on(
      'hardwareHeartbeat',
      async (data = {}) => {
        try {
          if (
            !socket.hardwareDeviceId
          ) {
            return;
          }

          const now =
            new Date();

          const hardware =
            await HardwareDevice
              .findOneAndUpdate(
                {
                  deviceId:
                    socket
                      .hardwareDeviceId
                },
                {
                  $set: {
                    status:
                      'online',

                    lastSeenAt:
                      now
                  }
                },
                {
                  new: true
                }
              );

          if (!hardware) {
            return;
          }

          // Descobre token pelo socket ou pelo próprio hardware.
          const token =
            socket
              .linkedDeviceToken ||
            hardware
              .linkedDeviceToken ||
            '';

          if (token) {
            socket
              .linkedDeviceToken =
              token;

            // CORREÇÃO:
            // heartbeat mantém a licença principal online.
            await syncLicenseStatus(
              io,
              token,
              'online'
            );
          }

        } catch (err) {
          console.error(
            '[PROVISIONING] heartbeat:',
            err
          );
        }
      }
    );

    // ========================================================
    // DESCONEXÃO
    // ========================================================

    socket.on(
      'disconnect',
      async (reason) => {
        try {
          if (
            !socket.hardwareDeviceId
          ) {
            return;
          }

          const now =
            new Date();

          const hardware =
            await HardwareDevice
              .findOneAndUpdate(
                {
                  deviceId:
                    socket
                      .hardwareDeviceId
                },
                {
                  $set: {
                    status:
                      'offline',

                    lastSeenAt:
                      now
                  }
                },
                {
                  new: true
                }
              );

          const token =
            socket
              .linkedDeviceToken ||
            hardware
              ?.linkedDeviceToken ||
            '';

          if (token) {
            // CORREÇÃO:
            // a licença também fica offline.
            await syncLicenseStatus(
              io,
              token,
              'offline'
            );
          }

          console.log(
            `[PROVISIONING] Hardware ${socket.hardwareDeviceId} desconectado. ` +
            `Motivo=${reason || 'desconhecido'}`
          );

        } catch (err) {
          console.error(
            '[PROVISIONING] disconnect:',
            err
          );
        }
      }
    );

  });
}

module.exports =
  configurarSocketProvisioning;

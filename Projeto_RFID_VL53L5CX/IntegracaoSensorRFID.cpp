#include "IntegracaoSensorRFID.h"

#include "SensorPresencaVL53L5CX.h"

namespace IntegracaoSensorRFID {
namespace {

bool revisaoAnterior = false;
bool estadoEntregueAoRFID = false;
ServicoCallback callbackServico = nullptr;

}  // namespace

bool iniciar(BeepCallback beepCallback, ServicoCallback servicoCallback) {
  revisaoAnterior = false;
  estadoEntregueAoRFID = false;
  callbackServico = servicoCallback;

  return SensorPresencaVL53L5CX::iniciar(beepCallback);
}

void atualizar(
  bool revisaoAtiva,
  EstadoPecaCallback callbackEstadoPeca
) {
  SensorPresencaVL53L5CX::atualizar();

  if (callbackEstadoPeca == nullptr) {
    return;
  }

  // Fora da revisão, o sensor continua sendo atualizado, mas não
  // interfere na lógica RFID.
  if (!revisaoAtiva) {
    SensorPresencaVL53L5CX::consumirEventoEntrada();
    SensorPresencaVL53L5CX::consumirEventoSaida();

    revisaoAnterior = false;
    estadoEntregueAoRFID = false;
    return;
  }

  // Nova sessão de revisão.
  if (!revisaoAnterior) {
    revisaoAnterior = true;
    estadoEntregueAoRFID = false;

    SensorPresencaVL53L5CX::reiniciarSessaoLogica();
  }

  if (SensorPresencaVL53L5CX::consumirEventoEntrada()) {
    if (!estadoEntregueAoRFID) {
      estadoEntregueAoRFID = true;
      callbackEstadoPeca(true);
    }
  }

  if (SensorPresencaVL53L5CX::consumirEventoSaida()) {
    if (estadoEntregueAoRFID) {
      estadoEntregueAoRFID = false;
      callbackEstadoPeca(false);
    }
  }
}

bool calibrarArcoVazio(CalibracaoProgressoCallback progressoCallback) {
  return SensorPresencaVL53L5CX::calibrarArcoVazio(progressoCallback);
}

ServicoCallback obterServicoCallback() {
  return callbackServico;
}

bool estaCalibrado() {
  return SensorPresencaVL53L5CX::estaCalibrado();
}

void mostrarStatusSensor() {
  SensorPresencaVL53L5CX::mostrarStatus();
}

void mostrarMatrizSensor() {
  SensorPresencaVL53L5CX::mostrarMatrizAtual();
}

void reiniciarSessao() {
  revisaoAnterior = false;
  estadoEntregueAoRFID = false;

  SensorPresencaVL53L5CX::reiniciarSessaoLogica();
}

}  // namespace IntegracaoSensorRFID

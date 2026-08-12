#pragma once

#include <Arduino.h>

namespace IntegracaoSensorRFID {

using EstadoPecaCallback = void (*)(bool presente);
using BeepCallback = void (*)(int quantidade);
using ServicoCallback = void (*)();
using CalibracaoProgressoCallback = void (*)(uint8_t percentual, const char* mensagem);

/**
 * Inicializa o módulo ToF e registra a função de beep já existente
 * no programa RFID.
 */
bool iniciar(BeepCallback beepCallback, ServicoCallback servicoCallback = nullptr);

/**
 * Atualiza o VL53L5CX e entrega somente eventos de entrada/saída
 * para a lógica RFID.
 *
 * A lógica de cadastro, EPC, lotes e NVS não é conhecida por este
 * módulo. Ela recebe apenas o mesmo bool que antes vinha da simulação.
 */
void atualizar(
  bool revisaoAtiva,
  EstadoPecaCallback callbackEstadoPeca
);

/**
 * Calibração e diagnóstico.
 */
bool calibrarArcoVazio(CalibracaoProgressoCallback progressoCallback = nullptr);
bool estaCalibrado();
void mostrarStatusSensor();
void mostrarMatrizSensor();

/**
 * Deve ser chamada ao iniciar ou encerrar um modo de revisão,
 * para evitar reaproveitar eventos temporais da sessão anterior.
 */
void reiniciarSessao();

}  // namespace IntegracaoSensorRFID

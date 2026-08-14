#pragma once

#include <Arduino.h>

namespace SensorPresencaVL53L5CX {

using BeepCallback = void (*)(int quantidade);
using CalibracaoProgressoCallback = void (*)(uint8_t percentual, const char* mensagem);


enum class Estado : uint8_t {
  SEM_REFERENCIA,
  ARCO_VAZIO,
  CONFIRMANDO_ENTRADA,
  ROUPA_PRESENTE,
  ARCO_GIRANDO,
  CONFIRMANDO_SAIDA,
  PECA_REMOVIDA
};

struct Diagnostico {
  bool inicializado;
  bool calibrado;
  bool hasteNoCentro;
  bool pecaPresente;

  Estado estado;

  uint8_t zonasROIValidas;
  uint8_t zonasHaste;
  uint8_t zonasUteis;
  uint8_t zonasAlteradas;

  float mediaROI;
  int16_t menorROI;
  float diferencaMediaROI;
  float confianca;
};

/**
 * Inicializa o VL53L5CX.
 *
 * Ligações padrão:
 *   SDA -> GPIO 27
 *   SCL -> GPIO 22
 *
 * A função não executa a calibração automaticamente. Ela apenas
 * apresenta a orientação para que o operador use o comando
 * "calibrar".
 */
bool iniciar(BeepCallback beepCallback = nullptr);

/**
 * Atualiza o sensor e a máquina de estados.
 * Deve ser chamada continuamente no loop().
 */
void atualizar();

/**
 * Executa a calibração do arco vazio.
 *
 * O operador deve permanecer atrás do arco, na posição normal
 * de trabalho. A captura começa após uma contagem regressiva
 * de três segundos e termina com dois beeps.
 */
bool calibrarArcoVazio(CalibracaoProgressoCallback progressoCallback = nullptr);

/**
 * Eventos de borda. Cada função retorna true uma única vez por evento.
 */
bool consumirEventoEntrada();
bool consumirEventoSaida();

/**
 * Consulta do estado atual.
 */
bool estaInicializado();
bool estaCalibrado();
bool temPeca();
bool hasteNoCentro();
Estado obterEstado();
Diagnostico obterDiagnostico();

/**
 * Utilidades de diagnóstico.
 */
void mostrarStatus();
void mostrarMatrizAtual();
void mostrarMenuCalibracao();

/**
 * Limpa apenas os estados temporais e eventos, mantendo a calibração.
 * Útil ao iniciar ou encerrar uma sessão de revisão.
 */
void reiniciarSessaoLogica();

const char *nomeEstado(Estado estado);

}  // namespace SensorPresencaVL53L5CX

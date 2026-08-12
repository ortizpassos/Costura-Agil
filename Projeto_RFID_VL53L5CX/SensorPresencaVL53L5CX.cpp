#include "SensorPresencaVL53L5CX.h"

#include <Wire.h>
#include <math.h>
#include <SparkFun_VL53L5CX_Library.h>

namespace IntegracaoSensorRFID {
using ServicoCallback = void (*)();
ServicoCallback obterServicoCallback();
}  // namespace IntegracaoSensorRFID

namespace SensorPresencaVL53L5CX {
namespace {

// ============================================================
// HARDWARE E SENSOR
// ============================================================

// IMPORTANTE (CYD ESP32-2432S028R):
// GPIO21 controla o backlight do display e NAO pode ser usado como SDA.
// O conector CN1 disponibiliza GPIO27 e GPIO22, ideais para I2C.
constexpr uint8_t SDA_PIN = 27;
constexpr uint8_t SCL_PIN = 22;
constexpr uint32_t I2C_CLOCK_HZ = 400000;

constexpr uint8_t MATRIX_ZONES = 64;
constexpr uint8_t ROI_ZONES = 16;
// 5 Hz reduz o tempo de barramento I2C e deixa mais CPU/UART
// disponíveis para o leitor RFID. A resposta de 200 ms ainda é
// adequada para detectar entrada e retirada da peça.
constexpr uint8_t FRAME_RATE_HZ = 5;
constexpr uint8_t AMOSTRAS_CALIBRACAO = 30;

// ROI central 4 x 4.
constexpr uint8_t ROI_CENTRAL[ROI_ZONES] = {
  18, 19, 20, 21,
  26, 27, 28, 29,
  34, 35, 36, 37,
  42, 43, 44, 45
};

// ============================================================
// PARÂMETROS DE CLASSIFICAÇÃO
// ============================================================

// Faixa válida geral do sensor.
constexpr int16_t DISTANCIA_MINIMA_MM = 30;
constexpr int16_t DISTANCIA_MAXIMA_MM = 4000;

// Margem de segurança para a haste próxima de 20 cm.
// Não usamos 200 mm exatos, porque a distância varia com
// posição, inclinação, tolerância mecânica e ruído do sensor.
constexpr int16_t HASTE_MIN_MM = 140;
constexpr int16_t HASTE_MAX_MM = 280;
constexpr uint8_t MINIMO_ZONAS_HASTE = 2;

// Alteração mínima, comparada com o arco vazio, para uma zona
// útil ser considerada ocupada pela roupa.
constexpr int16_t LIMIAR_ALTERACAO_ZONA_MM = 100;
constexpr uint8_t MINIMO_ZONAS_ALTERADAS = 2;

// Histerese da confiança.
constexpr float CONFIANCA_ENTRADA_PCT = 35.0f;
constexpr float CONFIANCA_SAIDA_PCT = 25.0f;

// Confirmação temporal.
constexpr uint8_t FRAMES_CONFIRMAR_ENTRADA = 3;
constexpr uint8_t FRAMES_CONFIRMAR_SAIDA = 6;

// Movimento do arco.
constexpr float LIMIAR_MOVIMENTO_ROI_MM = 45.0f;

SparkFun_VL53L5CX sensor;
VL53L5CX_ResultsData dadosMedicao;

struct Frame {
  int16_t distancia[MATRIX_ZONES];
  uint8_t status[MATRIX_ZONES];
  uint8_t alvos[MATRIX_ZONES];

  uint8_t zonasROIValidas;
  uint8_t zonasHaste;
  uint8_t zonasUteis;
  uint8_t zonasAlteradas;

  bool hasteNoCentro;

  float mediaROI;
  int16_t menorROI;

  float diferencaMediaROI;
  float confianca;
};

Frame atual{};
Frame referenciaVazia{};
Frame anterior{};

bool sensorInicializado = false;
bool referenciaOK = false;
bool possuiAnterior = false;

Estado estadoAtual = Estado::SEM_REFERENCIA;

uint8_t contadorEntrada = 0;
uint8_t contadorSaida = 0;

bool eventoEntrada = false;
bool eventoSaida = false;

BeepCallback callbackBeep = nullptr;

void executarServicoSeDisponivel() {
  const auto callbackServico = IntegracaoSensorRFID::obterServicoCallback();

  if (callbackServico != nullptr) {
    callbackServico();
  }
}

// ============================================================
// FUNÇÕES INTERNAS
// ============================================================

bool medicaoValida(
  int16_t distancia,
  uint8_t status,
  uint8_t alvos
) {
  if (status != 5 && status != 9) {
    return false;
  }

  if (alvos == 0) {
    return false;
  }

  return
    distancia >= DISTANCIA_MINIMA_MM &&
    distancia <= DISTANCIA_MAXIMA_MM;
}

bool distanciaDaHaste(int16_t distancia) {
  return
    distancia >= HASTE_MIN_MM &&
    distancia <= HASTE_MAX_MM;
}

void limparFrame(Frame &frame) {
  memset(&frame, 0, sizeof(Frame));
}

void copiarMedicao(Frame &frame) {
  limparFrame(frame);

  int32_t somaROI = 0;
  uint8_t quantidadeROI = 0;
  int16_t menor = INT16_MAX;

  for (uint8_t zona = 0; zona < MATRIX_ZONES; zona++) {
    frame.distancia[zona] = dadosMedicao.distance_mm[zona];
    frame.status[zona] = dadosMedicao.target_status[zona];
    frame.alvos[zona] = dadosMedicao.nb_target_detected[zona];
  }

  for (uint8_t i = 0; i < ROI_ZONES; i++) {
    const uint8_t zona = ROI_CENTRAL[i];

    if (!medicaoValida(
          frame.distancia[zona],
          frame.status[zona],
          frame.alvos[zona])) {
      continue;
    }

    frame.zonasROIValidas++;
    somaROI += frame.distancia[zona];
    quantidadeROI++;

    if (frame.distancia[zona] < menor) {
      menor = frame.distancia[zona];
    }

    if (distanciaDaHaste(frame.distancia[zona])) {
      frame.zonasHaste++;
    } else {
      frame.zonasUteis++;
    }
  }

  if (quantidadeROI > 0) {
    frame.mediaROI =
      static_cast<float>(somaROI) /
      static_cast<float>(quantidadeROI);

    frame.menorROI = menor;
  }

  frame.hasteNoCentro =
    frame.zonasHaste >= MINIMO_ZONAS_HASTE;
}

void compararComReferencia(Frame &frame) {
  frame.zonasAlteradas = 0;
  frame.diferencaMediaROI = 0;
  frame.confianca = 0;

  if (!referenciaOK) {
    return;
  }

  int32_t somaDiferencas = 0;
  uint8_t comparacoes = 0;

  for (uint8_t i = 0; i < ROI_ZONES; i++) {
    const uint8_t zona = ROI_CENTRAL[i];

    const bool atualValida = medicaoValida(
      frame.distancia[zona],
      frame.status[zona],
      frame.alvos[zona]
    );

    const bool referenciaValida = medicaoValida(
      referenciaVazia.distancia[zona],
      referenciaVazia.status[zona],
      referenciaVazia.alvos[zona]
    );

    if (!atualValida || !referenciaValida) {
      continue;
    }

    // A haste é geometria conhecida do arco, não roupa.
    // Essas zonas são retiradas da decisão.
    if (distanciaDaHaste(frame.distancia[zona])) {
      continue;
    }

    int16_t diferenca =
      referenciaVazia.distancia[zona] -
      frame.distancia[zona];

    // A roupa é esperada mais perto que o fundo calibrado.
    // Afastamentos não são evidência positiva.
    if (diferenca < 0) {
      diferenca = 0;
    }

    somaDiferencas += diferenca;
    comparacoes++;

    if (diferenca >= LIMIAR_ALTERACAO_ZONA_MM) {
      frame.zonasAlteradas++;
    }
  }

  if (comparacoes == 0) {
    return;
  }

  frame.diferencaMediaROI =
    static_cast<float>(somaDiferencas) /
    static_cast<float>(comparacoes);

  const uint8_t zonasConsideradas =
    frame.zonasUteis > 0 ? frame.zonasUteis : 1;

  float scoreZonas =
    static_cast<float>(frame.zonasAlteradas) /
    static_cast<float>(zonasConsideradas);

  if (scoreZonas > 1.0f) {
    scoreZonas = 1.0f;
  }

  float scoreDiferenca =
    frame.diferencaMediaROI /
    static_cast<float>(LIMIAR_ALTERACAO_ZONA_MM * 2);

  if (scoreDiferenca > 1.0f) {
    scoreDiferenca = 1.0f;
  }

  const float scoreValidade =
    static_cast<float>(frame.zonasUteis) /
    static_cast<float>(ROI_ZONES);

  frame.confianca =
    (
      scoreZonas * 0.45f +
      scoreDiferenca * 0.45f +
      scoreValidade * 0.10f
    ) * 100.0f;

  if (frame.confianca > 100.0f) {
    frame.confianca = 100.0f;
  }
}

bool detectarPresenca() {
  if (!referenciaOK) {
    return false;
  }

  // As zonas da haste ja sao excluidas individualmente em
  // compararComReferencia(). Portanto, a presenca pode ser
  // decidida pelas demais zonas uteis mesmo quando a haste
  // cruza parte da ROI central.
  if (atual.zonasUteis < 2) {
    return false;
  }

  return
    atual.zonasAlteradas >= MINIMO_ZONAS_ALTERADAS &&
    atual.confianca >= CONFIANCA_ENTRADA_PCT;
}

bool detectarAusencia() {
  if (!referenciaOK) {
    return false;
  }

  // A haste nao bloqueia mais toda a maquina de estados.
  // Somente suas zonas sao ignoradas na comparacao.
  if (atual.zonasUteis < 2) {
    return false;
  }

  return atual.confianca <= CONFIANCA_SAIDA_PCT;
}

bool detectarMovimento() {
  if (!possuiAnterior) {
    return false;
  }

  return
    fabsf(atual.mediaROI - anterior.mediaROI) >=
    LIMIAR_MOVIMENTO_ROI_MM;
}

void mudarEstado(Estado novoEstado) {
  if (novoEstado == estadoAtual) {
    return;
  }

  const Estado anteriorEstado = estadoAtual;
  estadoAtual = novoEstado;

  // O estado ARCO_GIRANDO continua funcionando internamente,
  // mas suas transições não são mostradas no Monitor Serial.
  if (
    anteriorEstado == Estado::ARCO_GIRANDO ||
    novoEstado == Estado::ARCO_GIRANDO
  ) {
    return;
  }
}

void atualizarMaquinaEstados() {
  if (!referenciaOK) {
    mudarEstado(Estado::SEM_REFERENCIA);
    return;
  }

  /*
    A haste nao congela mais toda a maquina de estados.

    Em compararComReferencia(), cada zona entre HASTE_MIN_MM e
    HASTE_MAX_MM ja e retirada da decisao. Assim as zonas restantes
    continuam detectando entrada e retirada da roupa.

    Isso evita o caso em que, depois de algumas pecas, duas zonas
    da haste permanecem na ROI e deixam o sistema preso em
    ARCO_VAZIO/peca ausente.
  */

  const bool presenca = detectarPresenca();
  const bool ausencia = detectarAusencia();
  const bool movimento = detectarMovimento();

  switch (estadoAtual) {
    case Estado::SEM_REFERENCIA:
      mudarEstado(Estado::ARCO_VAZIO);
      break;

    case Estado::ARCO_VAZIO:
      contadorSaida = 0;

      if (presenca) {
        contadorEntrada = 1;
        mudarEstado(Estado::CONFIRMANDO_ENTRADA);
      } else {
        contadorEntrada = 0;
      }
      break;

    case Estado::CONFIRMANDO_ENTRADA:
      if (presenca) {
        contadorEntrada++;

        if (contadorEntrada >= FRAMES_CONFIRMAR_ENTRADA) {
          contadorEntrada = 0;
          mudarEstado(Estado::ROUPA_PRESENTE);
          eventoEntrada = true;
        }
      } else {
        contadorEntrada = 0;
        mudarEstado(Estado::ARCO_VAZIO);
      }
      break;

    case Estado::ROUPA_PRESENTE:
      if (movimento) {
        contadorSaida = 0;
        mudarEstado(Estado::ARCO_GIRANDO);
      } else if (ausencia) {
        contadorSaida = 1;
        mudarEstado(Estado::CONFIRMANDO_SAIDA);
      }
      break;

    case Estado::ARCO_GIRANDO:
      if (presenca) {
        contadorSaida = 0;

        if (!movimento) {
          mudarEstado(Estado::ROUPA_PRESENTE);
        }
      } else if (ausencia) {
        contadorSaida++;

        if (contadorSaida >= FRAMES_CONFIRMAR_SAIDA) {
          contadorSaida = 0;
          mudarEstado(Estado::PECA_REMOVIDA);
          eventoSaida = true;
        }
      } else {
        contadorSaida = 0;
      }
      break;

    case Estado::CONFIRMANDO_SAIDA:
      if (presenca) {
        contadorSaida = 0;

        mudarEstado(
          movimento
            ? Estado::ARCO_GIRANDO
            : Estado::ROUPA_PRESENTE
        );
      } else if (ausencia) {
        contadorSaida++;

        if (contadorSaida >= FRAMES_CONFIRMAR_SAIDA) {
          contadorSaida = 0;
          mudarEstado(Estado::PECA_REMOVIDA);
          eventoSaida = true;
        }
      } else {
        contadorSaida = 0;
        mudarEstado(Estado::ROUPA_PRESENTE);
      }
      break;

    case Estado::PECA_REMOVIDA:
      mudarEstado(Estado::ARCO_VAZIO);
      break;
  }
}

bool capturarAmostraCalibracao(
  int32_t soma[MATRIX_ZONES],
  uint16_t validas[MATRIX_ZONES]
) {
  if (!sensor.isDataReady()) {
    return false;
  }

  if (!sensor.getRangingData(&dadosMedicao)) {
    return false;
  }

  for (uint8_t zona = 0; zona < MATRIX_ZONES; zona++) {
    const int16_t distancia =
      dadosMedicao.distance_mm[zona];

    const uint8_t status =
      dadosMedicao.target_status[zona];

    const uint8_t alvos =
      dadosMedicao.nb_target_detected[zona];

    if (!medicaoValida(distancia, status, alvos)) {
      continue;
    }

    soma[zona] += distancia;
    validas[zona]++;
  }

  return true;
}

}  // namespace

// ============================================================
// API PÚBLICA
// ============================================================

bool iniciar(BeepCallback beepCallback) {
  callbackBeep = beepCallback;

  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(I2C_CLOCK_HZ);

  Serial.println(F("Inicializando VL53L5CX..."));

  if (!sensor.begin()) {
    Serial.println(F("ERRO: VL53L5CX nao encontrado."));
    sensorInicializado = false;
    return false;
  }

  if (!sensor.setResolution(8 * 8)) {
    Serial.println(F("ERRO: falha configurando matriz 8x8."));
    return false;
  }

  if (!sensor.setRangingFrequency(FRAME_RATE_HZ)) {
    Serial.println(F("ERRO: falha configurando frequencia."));
    return false;
  }

  if (!sensor.startRanging()) {
    Serial.println(F("ERRO: falha iniciando medicoes."));
    return false;
  }

  sensorInicializado = true;
  mostrarMenuCalibracao();
  return true;
}

void atualizar() {
  if (!sensorInicializado) {
    return;
  }

  if (!sensor.isDataReady()) {
    return;
  }

  if (!sensor.getRangingData(&dadosMedicao)) {
    return;
  }

  if (possuiAnterior) {
    anterior = atual;
  }

  copiarMedicao(atual);
  compararComReferencia(atual);
  atualizarMaquinaEstados();

  if (!possuiAnterior) {
    anterior = atual;
    possuiAnterior = true;
  }
}

bool calibrarArcoVazio(CalibracaoProgressoCallback progressoCallback) {
  if (!sensorInicializado) {
    Serial.println(F("Sensor ToF nao inicializado."));
    return false;
  }

  Serial.println();
  Serial.println(F("========================================"));
  Serial.println(F(" CALIBRACAO DO ARCO VAZIO"));
  Serial.println(F("========================================"));
  Serial.println(F("Posicione-se atras do arco, na posicao"));
  Serial.println(F("normal de trabalho da revisao."));
  Serial.println(F("O arco deve estar VAZIO e PARADO."));
  Serial.println();
  Serial.println(F("A captura iniciara em 3 segundos."));
  Serial.println(F("3..."));
  if (progressoCallback) progressoCallback(0, "Preparando... 3");
  executarServicoSeDisponivel();
  delay(1000);
  Serial.println(F("2..."));
  if (progressoCallback) progressoCallback(0, "Preparando... 2");
  executarServicoSeDisponivel();
  delay(1000);
  Serial.println(F("1..."));
  if (progressoCallback) progressoCallback(0, "Preparando... 1");
  executarServicoSeDisponivel();
  delay(1000);
  Serial.println(F("INICIANDO CALIBRACAO..."));
  if (progressoCallback) progressoCallback(0, "Iniciando leitura do sensor...");

  int32_t soma[MATRIX_ZONES] = {};
  uint16_t validas[MATRIX_ZONES] = {};

  uint8_t coletadas = 0;
  const uint32_t inicio = millis();

  while (coletadas < AMOSTRAS_CALIBRACAO) {
    if (millis() - inicio > 30000UL) {
      Serial.println(F("ERRO: tempo limite na calibracao."));
      if (progressoCallback) progressoCallback(0, "Tempo limite: nenhuma leitura valida.");
      return false;
    }

    executarServicoSeDisponivel();

    if (!capturarAmostraCalibracao(soma, validas)) {
      delay(2);
      continue;
    }

    coletadas++;

    if (progressoCallback) {
      static char msgProgresso[40];
      snprintf(msgProgresso, sizeof(msgProgresso), "Amostra %u/%u", coletadas, AMOSTRAS_CALIBRACAO);
      const uint8_t percentual = (uint8_t)((coletadas * 100U) / AMOSTRAS_CALIBRACAO);
      progressoCallback(percentual, msgProgresso);
    }

    Serial.print(F("Amostra "));
    Serial.print(coletadas);
    Serial.print(F("/"));
    Serial.println(AMOSTRAS_CALIBRACAO);
  }

  limparFrame(referenciaVazia);

  for (uint8_t zona = 0; zona < MATRIX_ZONES; zona++) {
    if (validas[zona] == 0) {
      continue;
    }

    referenciaVazia.distancia[zona] =
      soma[zona] / validas[zona];

    referenciaVazia.status[zona] = 5;
    referenciaVazia.alvos[zona] = 1;
  }

  // Calcula as informações resumidas da referência.
  Frame temporario = referenciaVazia;
  limparFrame(referenciaVazia);

  for (uint8_t zona = 0; zona < MATRIX_ZONES; zona++) {
    referenciaVazia.distancia[zona] = temporario.distancia[zona];
    referenciaVazia.status[zona] = temporario.status[zona];
    referenciaVazia.alvos[zona] = temporario.alvos[zona];
  }

  int32_t somaROI = 0;
  uint8_t qtdROI = 0;
  int16_t menorROI = INT16_MAX;

  for (uint8_t i = 0; i < ROI_ZONES; i++) {
    const uint8_t zona = ROI_CENTRAL[i];

    if (!medicaoValida(
          referenciaVazia.distancia[zona],
          referenciaVazia.status[zona],
          referenciaVazia.alvos[zona])) {
      continue;
    }

    referenciaVazia.zonasROIValidas++;
    referenciaVazia.zonasUteis++;
    somaROI += referenciaVazia.distancia[zona];
    qtdROI++;

    if (referenciaVazia.distancia[zona] < menorROI) {
      menorROI = referenciaVazia.distancia[zona];
    }
  }

  if (qtdROI > 0) {
    referenciaVazia.mediaROI =
      static_cast<float>(somaROI) /
      static_cast<float>(qtdROI);

    referenciaVazia.menorROI = menorROI;
  } else {
    Serial.println(F("ERRO: nenhuma zona valida encontrou referencia para calibracao."));
    referenciaOK = false;
    if (progressoCallback) progressoCallback(0, "Falha: referencia invalida.");
    return false;
  }

  referenciaOK = true;
  reiniciarSessaoLogica();
  estadoAtual = Estado::ARCO_VAZIO;

  Serial.println();
  Serial.println(F("CALIBRACAO CONCLUIDA COM SUCESSO."));
  if (progressoCallback) progressoCallback(100, "Calibracao concluida com sucesso!");

  if (callbackBeep != nullptr) {
    callbackBeep(2);
  }

  return true;
}

bool consumirEventoEntrada() {
  if (!eventoEntrada) {
    return false;
  }

  eventoEntrada = false;
  return true;
}

bool consumirEventoSaida() {
  if (!eventoSaida) {
    return false;
  }

  eventoSaida = false;
  return true;
}

bool estaInicializado() {
  return sensorInicializado;
}

bool estaCalibrado() {
  return referenciaOK;
}

bool temPeca() {
  return
    estadoAtual == Estado::ROUPA_PRESENTE ||
    estadoAtual == Estado::ARCO_GIRANDO ||
    estadoAtual == Estado::CONFIRMANDO_SAIDA;
}

bool hasteNoCentro() {
  return atual.hasteNoCentro;
}

Estado obterEstado() {
  return estadoAtual;
}

Diagnostico obterDiagnostico() {
  Diagnostico diagnostico{};

  diagnostico.inicializado = sensorInicializado;
  diagnostico.calibrado = referenciaOK;
  diagnostico.hasteNoCentro = atual.hasteNoCentro;
  diagnostico.pecaPresente = temPeca();
  diagnostico.estado = estadoAtual;

  diagnostico.zonasROIValidas = atual.zonasROIValidas;
  diagnostico.zonasHaste = atual.zonasHaste;
  diagnostico.zonasUteis = atual.zonasUteis;
  diagnostico.zonasAlteradas = atual.zonasAlteradas;

  diagnostico.mediaROI = atual.mediaROI;
  diagnostico.menorROI = atual.menorROI;
  diagnostico.diferencaMediaROI = atual.diferencaMediaROI;
  diagnostico.confianca = atual.confianca;

  return diagnostico;
}

void mostrarStatus() {
  const Diagnostico d = obterDiagnostico();

  Serial.println();
  Serial.println(F("========== SENSOR VL53L5CX =========="));

  Serial.print(F("Inicializado: "));
  Serial.println(d.inicializado ? F("SIM") : F("NAO"));

  Serial.print(F("Calibrado: "));
  Serial.println(d.calibrado ? F("SIM") : F("NAO"));

  Serial.print(F("Estado: "));
  Serial.println(nomeEstado(d.estado));

  Serial.print(F("Haste no centro: "));
  Serial.println(d.hasteNoCentro ? F("SIM") : F("NAO"));

  Serial.print(F("Peca presente: "));
  Serial.println(d.pecaPresente ? F("SIM") : F("NAO"));

  Serial.print(F("ROI media/menor: "));
  Serial.print(d.mediaROI, 1);
  Serial.print(F(" / "));
  Serial.print(d.menorROI);
  Serial.println(F(" mm"));

  Serial.print(F("Zonas haste/uteis/alteradas: "));
  Serial.print(d.zonasHaste);
  Serial.print(F(" / "));
  Serial.print(d.zonasUteis);
  Serial.print(F(" / "));
  Serial.println(d.zonasAlteradas);

  Serial.print(F("Confianca: "));
  Serial.print(d.confianca, 1);
  Serial.println(F(" %"));

  Serial.println(F("====================================="));
}

void mostrarMatrizAtual() {
  Serial.println();
  Serial.println(F("========== MATRIZ TOF 8x8 (mm) =========="));

  for (uint8_t linha = 0; linha < 8; linha++) {
    for (uint8_t coluna = 0; coluna < 8; coluna++) {
      const uint8_t zona = linha * 8 + coluna;

      if (!medicaoValida(
            atual.distancia[zona],
            atual.status[zona],
            atual.alvos[zona])) {
        Serial.print(F(" --- "));
      } else {
        Serial.printf("%4d ", atual.distancia[zona]);
      }
    }

    Serial.println();
  }

  Serial.println(F("========================================="));
}

void mostrarMenuCalibracao() {
  Serial.println();
  Serial.println(F("========================================"));
  Serial.println(F(" CALIBRACAO INICIAL NECESSARIA"));
  Serial.println(F("========================================"));
  Serial.println(F("Digite 'calibrar' para calibrar o arco"));
  Serial.println(F("vazio antes de iniciar uma revisao."));
  Serial.println(F("========================================"));
}

void reiniciarSessaoLogica() {
  contadorEntrada = 0;
  contadorSaida = 0;
  eventoEntrada = false;
  eventoSaida = false;
  possuiAnterior = false;

  if (referenciaOK) {
    estadoAtual = Estado::ARCO_VAZIO;
  } else {
    estadoAtual = Estado::SEM_REFERENCIA;
  }
}

const char *nomeEstado(Estado estado) {
  switch (estado) {
    case Estado::SEM_REFERENCIA:
      return "SEM_REFERENCIA";

    case Estado::ARCO_VAZIO:
      return "ARCO_VAZIO";

    case Estado::CONFIRMANDO_ENTRADA:
      return "CONFIRMANDO_ENTRADA";

    case Estado::ROUPA_PRESENTE:
      return "ROUPA_PRESENTE";

    case Estado::ARCO_GIRANDO:
      return "ARCO_GIRANDO";

    case Estado::CONFIRMANDO_SAIDA:
      return "CONFIRMANDO_SAIDA";

    case Estado::PECA_REMOVIDA:
      return "PECA_REMOVIDA";
  }

  return "DESCONHECIDO";
}

}  // namespace SensorPresencaVL53L5CX

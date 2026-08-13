#include "revisao_rfid.h"
#include <HardwareSerial.h>
#include "YRM1001Driver.h"
#include "IntegracaoSensorRFID.h"
#include "revisao_ui.h"

extern bool wsConnected;
extern void enviarValidacaoEpcRFID(const String& artigoId, const String& epc);
extern void confirmarRevisaoEpcRFID(const String& artigoId, const String& epc);
extern void beepSensor(int quantidade);

namespace {
HardwareSerial serialRFID(2);
YRM1001Driver leitor(serialRFID, 16, 17);

constexpr uint8_t MAX_EPCS_PECA = 10;
constexpr uint32_t TIMEOUT_API_MS = 6000;
constexpr uint8_t REGIAO_RFID = 0x01;
constexpr uint16_t POTENCIA_RFID = 3000;

enum class EstadoSessao : uint8_t {
  OCIOSA,
  LENDO,
  AGUARDANDO_VALIDACAO,
  AGUARDANDO_CONFIRMACAO
};

struct Sessao {
  EstadoSessao estado = EstadoSessao::OCIOSA;
  bool pecaSaiu = false;
  uint8_t epcs[MAX_EPCS_PECA][YRM1001Driver::MAX_EPC_LEN]{};
  uint8_t lens[MAX_EPCS_PECA]{};
  uint8_t quantidade = 0;
  String epcPrincipal;
  String resultadoValidacao;
  uint32_t iniciouEsperaMs = 0;
};

Sessao sessao;
String artigoIdAtual;
String artigoCodigoAtual;
String artigoNomeAtual;
int artigoQuantidade = 0;
int artigoRevisadas = 0;
bool artigoAtivo = false;

String epcHex(const uint8_t* epc, uint8_t len) {
  String s;
  s.reserve(len * 2);
  for (uint8_t i = 0; i < len; i++) {
    if (epc[i] < 0x10) s += '0';
    s += String(epc[i], HEX);
  }
  s.toUpperCase();
  return s;
}

bool epcIgual(const uint8_t* a, uint8_t lenA, const uint8_t* b, uint8_t lenB) {
  return lenA == lenB && memcmp(a, b, lenA) == 0;
}

bool jaFoiLido(const uint8_t* epc, uint8_t len) {
  for (uint8_t i = 0; i < sessao.quantidade; i++) {
    if (epcIgual(sessao.epcs[i], sessao.lens[i], epc, len)) return true;
  }
  return false;
}

void limparSessao() {
  sessao = Sessao{};
}

void beepAprovada() { beepSensor(2); }
void beepErro() { beepSensor(3); }
void beepSemEtiqueta() { beepSensor(3); }
void beepMultiplas() { beepSensor(4); }

void finalizarReprovada(const String& motivo) {
  revisaoUI_reprovada(motivo);
  beepErro();
  sessao.estado = EstadoSessao::OCIOSA;
}

void processarValidacao() {
  if (sessao.quantidade != 1 || sessao.resultadoValidacao.isEmpty()) return;

  if (sessao.resultadoValidacao == "valido") {
    if (!sessao.pecaSaiu) return;

    if (!wsConnected) {
      revisaoUI_semConexao();
      beepErro();
      sessao.estado = EstadoSessao::OCIOSA;
      return;
    }

    confirmarRevisaoEpcRFID(artigoIdAtual, sessao.epcPrincipal);
    sessao.estado = EstadoSessao::AGUARDANDO_CONFIRMACAO;
    sessao.iniciouEsperaMs = millis();
    revisaoUI_validando("Confirmando revisao...");
    return;
  }

  if (!sessao.pecaSaiu) return;

  if (sessao.resultadoValidacao == "nao_cadastrado") {
    finalizarReprovada("Etiqueta nao cadastrada");
  } else if (sessao.resultadoValidacao == "artigo_incorreto") {
    finalizarReprovada("Etiqueta de outro artigo");
  } else if (sessao.resultadoValidacao == "ja_revisado") {
    finalizarReprovada("Peca ja revisada");
  } else {
    finalizarReprovada("Falha na validacao");
  }
}

void onTag(const YRM1001Driver::TagLida& tag) {
  if (sessao.estado != EstadoSessao::LENDO &&
      sessao.estado != EstadoSessao::AGUARDANDO_VALIDACAO) return;

  if (tag.epcLen == 0 || tag.epcLen > YRM1001Driver::MAX_EPC_LEN) return;
  if (jaFoiLido(tag.epc, tag.epcLen)) return;
  if (sessao.quantidade >= MAX_EPCS_PECA) return;

  memcpy(sessao.epcs[sessao.quantidade], tag.epc, tag.epcLen);
  sessao.lens[sessao.quantidade] = tag.epcLen;
  sessao.quantidade++;

  Serial.printf("[REVISAO] EPC distinto detectado. Total=%u\n", sessao.quantidade);
  revisaoUI_atualizarLeitura(sessao.quantidade);

  if (sessao.quantidade == 1) {
    sessao.epcPrincipal = epcHex(tag.epc, tag.epcLen);

    if (!wsConnected) {
      sessao.resultadoValidacao = "erro_api";
      return;
    }

    enviarValidacaoEpcRFID(artigoIdAtual, sessao.epcPrincipal);
    sessao.estado = EstadoSessao::AGUARDANDO_VALIDACAO;
    sessao.iniciouEsperaMs = millis();
    revisaoUI_validando("Etiqueta detectada\nValidando na API...");
  }
}

void entradaPeca() {
  if (!artigoAtivo) return;

  limparSessao();
  sessao.estado = EstadoSessao::LENDO;
  sessao.pecaSaiu = false;

  leitor.iniciarInventario();
  revisaoUI_lendo();
  Serial.println("[REVISAO] Peca entrou no arco.");
}

void saidaPeca() {
  if (sessao.estado == EstadoSessao::OCIOSA) return;

  sessao.pecaSaiu = true;
  leitor.pararInventario();

  Serial.printf("[REVISAO] Peca saiu. EPCs distintos=%u\n", sessao.quantidade);

  if (sessao.quantidade == 0) {
    revisaoUI_semEtiqueta();
    beepSemEtiqueta();
    sessao.estado = EstadoSessao::OCIOSA;
    return;
  }

  if (sessao.quantidade > 1) {
    revisaoUI_multiplas(sessao.quantidade);
    beepMultiplas();
    sessao.estado = EstadoSessao::OCIOSA;
    return;
  }

  if (!sessao.resultadoValidacao.isEmpty()) {
    processarValidacao();
    return;
  }

  sessao.estado = EstadoSessao::AGUARDANDO_VALIDACAO;
  sessao.iniciouEsperaMs = millis();
  revisaoUI_validando("Peca removida\nAguardando validacao...");
}

void callbackPeca(bool presente) {
  if (presente) entradaPeca();
  else saidaPeca();
}
}

void revisaoRFID_begin() {
  leitor.definirCallbackTag(onTag);

  if (!leitor.begin(115200)) {
    Serial.println("[RFID] Falha ao iniciar YRM1001.");
    return;
  }

  leitor.definirIntervaloInventario(100);
  leitor.configurar(REGIAO_RFID, POTENCIA_RFID);
  Serial.println("[RFID] YRM1001 pronto para revisao.");
}

void revisaoRFID_atualizar() {
  leitor.atualizar();
  IntegracaoSensorRFID::atualizar(artigoAtivo, callbackPeca);

  if (sessao.estado == EstadoSessao::AGUARDANDO_VALIDACAO ||
      sessao.estado == EstadoSessao::AGUARDANDO_CONFIRMACAO) {
    if (millis() - sessao.iniciouEsperaMs > TIMEOUT_API_MS) {
      leitor.pararInventario();
      revisaoUI_semConexao();
      beepErro();
      sessao.estado = EstadoSessao::OCIOSA;
    }
  }
}

void revisaoRFID_definirArtigo(const String& artigoId, const String& codigo, const String& nome, int quantidade, int revisadas) {
  leitor.pararInventario();
  artigoIdAtual = artigoId;
  artigoCodigoAtual = codigo;
  artigoNomeAtual = nome;
  artigoQuantidade = quantidade;
  artigoRevisadas = revisadas;
  artigoAtivo = !artigoIdAtual.isEmpty();
  limparSessao();
  IntegracaoSensorRFID::reiniciarSessao();
  revisaoUI_pronto(artigoCodigoAtual, artigoNomeAtual, artigoRevisadas, artigoQuantidade);
}

void revisaoRFID_limparArtigo() {
  leitor.pararInventario();
  artigoAtivo = false;
  artigoIdAtual = "";
  artigoCodigoAtual = "";
  artigoNomeAtual = "";
  artigoQuantidade = 0;
  artigoRevisadas = 0;
  limparSessao();
  IntegracaoSensorRFID::reiniciarSessao();
}

void revisaoRFID_onValidacao(const String& resultado) {
  if (sessao.estado == EstadoSessao::OCIOSA || sessao.quantidade != 1) return;
  sessao.resultadoValidacao = resultado;
  Serial.printf("[REVISAO] Validacao API: %s\n", resultado.c_str());
  processarValidacao();
}

void revisaoRFID_onConfirmacao(bool success, const String& resultado, int revisadas, int total) {
  if (sessao.estado != EstadoSessao::AGUARDANDO_CONFIRMACAO) return;

  if (!success || resultado != "aprovada") {
    revisaoUI_reprovada(resultado == "ja_revisado" ? "Peca ja revisada" : "Falha ao confirmar revisao");
    beepErro();
    sessao.estado = EstadoSessao::OCIOSA;
    return;
  }

  artigoRevisadas = revisadas;
  if (total > 0) artigoQuantidade = total;
  revisaoUI_aprovada(artigoRevisadas, artigoQuantidade);
  beepAprovada();
  sessao.estado = EstadoSessao::OCIOSA;
}

bool revisaoRFID_ativa() {
  return artigoAtivo;
}

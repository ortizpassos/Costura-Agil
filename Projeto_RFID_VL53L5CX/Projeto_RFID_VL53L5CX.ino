#include <HardwareSerial.h>
#include <Preferences.h>
#include "IntegracaoSensorRFID.h"

// ============================================================
// ESP32 + RFID UHF + VL53L5CX
// SISTEMA DE CADASTRO E REVISÃO POR LOTE
// ============================================================

// ============================================================
// PINOS RFID
// ============================================================

#define RFID_RX 16
#define RFID_TX 17

HardwareSerial RFID(2);

// ============================================================
// CONFIGURAÇÕES
// ============================================================

#define FRAME_HEAD 0xBB
#define FRAME_TAIL 0x7E

#define MAX_EPC_LEN 12

// Limite usado pelos vetores locais que agrupam lotes únicos.
#define MAX_LOTES_UNICOS 100

// Quantidade máxima de etiquetas cadastradas
#define MAX_TAGS_SALVAS 500

// Quantidade máxima de etiquetas diferentes
// detectadas durante uma única peça
#define MAX_TAGS_SESSAO 10

#define INVENTORY_INTERVAL 50

// ============================================================
// COMANDOS RFID
// ============================================================

// SET REGION - China1
const uint8_t CMD_SET_REGION[] = {
  0xBB, 0x00, 0x07, 0x00, 0x01,
  0x01, 0x09, 0x7E
};

// SET TX POWER - 30 dBm
const uint8_t CMD_SET_POWER[] = {
  0xBB, 0x00, 0xB6, 0x00, 0x02,
  0x0B, 0xB8, 0x7B, 0x7E
};

// INVENTORY MULTI
const uint8_t CMD_READ_MULTI[] = {
  0xBB, 0x00, 0x27, 0x00, 0x03,
  0x22, 0xFF, 0xFF, 0x4A, 0x7E
};

// ============================================================
// BUFFER RFID
// ============================================================

uint8_t rxBuffer[128];
uint8_t rxIndex = 0;
bool frameActive = false;

// Última intensidade recebida no notice de inventário.
// O valor é exibido como byte bruto, pois a conversão exata para
// dBm depende da tabela usada pelo firmware do YRM1001.
uint8_t ultimoRSSIRaw = 0;

// ============================================================
// TAGS CADASTRADAS
// ============================================================

struct TagSalva {

  uint8_t epc[MAX_EPC_LEN];
  uint8_t len;

  String tipo;
  String tamanho;

  // true = peça já foi revisada com sucesso
  bool pronta;

  String ultimoResultado;
};

TagSalva tagsSalvas[MAX_TAGS_SALVAS];

int numTagsSalvas = 0;

// ============================================================
// NVS
// ============================================================

Preferences prefs;

// ============================================================
// DADOS DO CADASTRO
// ============================================================

String tipoPeca;
String tamanho;

// ============================================================
// TAGS LIDAS DURANTE CADASTRO
// ============================================================

uint8_t epcCadastro[MAX_TAGS_SESSAO][MAX_EPC_LEN];
uint8_t lenCadastro[MAX_TAGS_SESSAO];

int quantidadeTagsCadastro = 0;

unsigned long lastTagTime = 0;

// ============================================================
// ESTADOS
// ============================================================

enum ModoSistema {

  MODO_IDLE,
  MODO_CADASTRO,
  MODO_REVISAO
};

ModoSistema modoAtual = MODO_IDLE;

// ============================================================
// ESTADO LÓGICO DA PEÇA
//
// Esta variável continua sendo usada pela lógica RFID exatamente
// como antes. Agora, porém, ela é atualizada pelo VL53L5CX através
// do módulo IntegracaoSensorRFID.
// ============================================================

// true  = peça presente
// false = peça ausente

bool pecaPresente = false;

// ============================================================
// LOTE DE REVISÃO
// ============================================================

String loteTipo;
String loteTamanho;

bool loteSelecionado = false;

// ============================================================
// ESTADO DA PEÇA ATUAL
// ============================================================

uint8_t epcsSessao[MAX_TAGS_SESSAO][MAX_EPC_LEN];
uint8_t epcSessaoLen[MAX_TAGS_SESSAO];

int quantidadeTagsSessao = 0;

bool resultadoDefinido = false;
bool etiquetaCorreta = false;

String resultadoAtual = "";

// ============================================================
// PROTÓTIPOS
// ============================================================

void mostrarMenu();
void resetSessaoRevisao();
void sairDoModoAtual();
void processarComandoSerial();
void apagarTodasTagsCadastradas();
void processarRecepcaoRFID();
bool lerLinhaSerialCooperativa(String &linha);
void imprimirRSSI(uint8_t rssiRaw);
void processFrame(uint8_t *frame, uint8_t len);

// ============================================================
// BEEP
// ============================================================

void beep(int quantidade) {

  for (int i = 0; i < quantidade; i++) {

    // Temporariamente pelo Serial.
    // Futuramente trocar por GPIO/buzzer.

    Serial.println("BEEP");

    delay(120);
  }
}

// ============================================================
// RFID
// ============================================================

void sendCommand(
  const uint8_t *cmd,
  size_t len
) {

  RFID.write(
    cmd,
    len
  );

  // Mantido igual ao código de teste que apresentou
  // melhor alcance e maior velocidade de leitura.
  delay(100);
}

void sendInventoryCmd() {

  sendCommand(
    CMD_READ_MULTI,
    sizeof(CMD_READ_MULTI)
  );
}

// ============================================================
// LEITURA SERIAL COOPERATIVA
// ============================================================

bool lerLinhaSerialCooperativa(String &linha) {

  linha = "";

  while (true) {

    processarRecepcaoRFID();

    IntegracaoSensorRFID::atualizar(
      modoAtual == MODO_REVISAO,
      sensorSimulado
    );

    while (Serial.available()) {

      char c = Serial.read();

      if (c == '\r') {
        continue;
      }

      if (c == '\n') {
        linha.trim();
        return true;
      }

      linha += c;

      if (linha.length() >= 64) {
        linha.trim();
        return true;
      }
    }

    delay(1);
  }
}

// ============================================================
// EPC
// ============================================================

bool epcIgual(
  uint8_t *epc1,
  uint8_t len1,
  uint8_t *epc2,
  uint8_t len2
) {

  if (len1 != len2)
    return false;

  for (int i = 0; i < len1; i++) {

    if (epc1[i] != epc2[i])
      return false;
  }

  return true;
}

// ============================================================
// EPC -> STRING
// ============================================================

String epcToString(
  uint8_t *epc,
  uint8_t len
) {

  String result = "";

  for (int i = 0; i < len; i++) {

    if (epc[i] < 0x10)
      result += "0";

    result += String(
      epc[i],
      HEX
    );
  }

  result.toUpperCase();

  return result;
}

// ============================================================
// HEX -> INT
// ============================================================

int hexCharToInt(char c) {

  if (c >= '0' && c <= '9')
    return c - '0';

  if (c >= 'A' && c <= 'F')
    return c - 'A' + 10;

  if (c >= 'a' && c <= 'f')
    return c - 'a' + 10;

  return 0;
}

// ============================================================
// STRING HEX -> EPC
// ============================================================

int hexStringToEpc(
  String hex,
  uint8_t *epc
) {

  int len = hex.length() / 2;

  if (len > MAX_EPC_LEN)
    len = MAX_EPC_LEN;

  for (int i = 0; i < len; i++) {

    epc[i] =
      (hexCharToInt(hex[i * 2]) << 4) |
      hexCharToInt(hex[i * 2 + 1]);
  }

  return len;
}

// ============================================================
// ENCONTRAR TAG CADASTRADA
// ============================================================

int findSavedTag(
  uint8_t *epc,
  uint8_t len
) {

  for (
    int i = 0;
    i < numTagsSalvas;
    i++
  ) {

    if (
      epcIgual(
        epc,
        len,
        tagsSalvas[i].epc,
        tagsSalvas[i].len
      )
    ) {

      return i;
    }
  }

  return -1;
}

// ============================================================
// VERIFICAR EPC JÁ NA SESSÃO DE REVISÃO
// ============================================================

bool epcJaNaSessao(
  uint8_t *epc,
  uint8_t len
) {

  for (
    int i = 0;
    i < quantidadeTagsSessao;
    i++
  ) {

    if (
      epcIgual(
        epc,
        len,
        epcsSessao[i],
        epcSessaoLen[i]
      )
    ) {

      return true;
    }
  }

  return false;
}

// ============================================================
// VERIFICAR EPC JÁ NO CADASTRO ATUAL
// ============================================================

bool epcJaNoCadastro(
  uint8_t *epc,
  uint8_t len
) {

  for (
    int i = 0;
    i < quantidadeTagsCadastro;
    i++
  ) {

    if (
      epcIgual(
        epc,
        len,
        epcCadastro[i],
        lenCadastro[i]
      )
    ) {

      return true;
    }
  }

  return false;
}

// ============================================================
// NVS - SALVAR TAG
// ============================================================

void salvarTagNVS(int index) {

  String prefix =
    "tag" + String(index) + "_";

  prefs.putString(
    (prefix + "epc").c_str(),
    epcToString(
      tagsSalvas[index].epc,
      tagsSalvas[index].len
    )
  );

  prefs.putString(
    (prefix + "tipo").c_str(),
    tagsSalvas[index].tipo
  );

  prefs.putString(
    (prefix + "tam").c_str(),
    tagsSalvas[index].tamanho
  );

  prefs.putBool(
    (prefix + "pronta").c_str(),
    tagsSalvas[index].pronta
  );

  prefs.putString(
    (prefix + "resultado").c_str(),
    tagsSalvas[index].ultimoResultado
  );

  prefs.putInt(
    "quantidade",
    numTagsSalvas
  );
}

// ============================================================
// NVS - CARREGAR TAGS
// ============================================================

void carregarTagsNVS() {

  numTagsSalvas =
    prefs.getInt(
      "quantidade",
      0
    );

  if (numTagsSalvas < 0)
    numTagsSalvas = 0;

  if (
    numTagsSalvas >
    MAX_TAGS_SALVAS
  ) {

    numTagsSalvas =
      MAX_TAGS_SALVAS;
  }

  for (
    int i = 0;
    i < numTagsSalvas;
    i++
  ) {

    String prefix =
      "tag" + String(i) + "_";

    String epcHex =
      prefs.getString(
        (prefix + "epc").c_str(),
        ""
      );

    tagsSalvas[i].len =
      hexStringToEpc(
        epcHex,
        tagsSalvas[i].epc
      );

    tagsSalvas[i].tipo =
      prefs.getString(
        (prefix + "tipo").c_str(),
        ""
      );

    tagsSalvas[i].tamanho =
      prefs.getString(
        (prefix + "tam").c_str(),
        ""
      );

    tagsSalvas[i].pronta =
      prefs.getBool(
        (prefix + "pronta").c_str(),
        false
      );

    tagsSalvas[i].ultimoResultado =
      prefs.getString(
        (prefix + "resultado").c_str(),
        ""
      );
  }

  Serial.print(
    "Etiquetas carregadas da memoria: "
  );

  Serial.println(
    numTagsSalvas
  );
}


// ============================================================
// APAGAR TODAS AS TAGS CADASTRADAS
//
// Remove todas as etiquetas, lotes e resultados de revisão
// armazenados no namespace NVS "rfid_sistema".
//
// A calibração do VL53L5CX não é apagada, pois ela não fica
// armazenada neste namespace.
// ============================================================

void apagarTodasTagsCadastradas() {

  if (
    modoAtual !=
    MODO_IDLE
  ) {

    Serial.println(
      "Saia do modo atual antes de apagar as etiquetas."
    );

    return;
  }

  Serial.println();
  Serial.println(
    "========================================"
  );

  Serial.println(
    "ATENCAO: APAGAR TODAS AS ETIQUETAS"
  );

  Serial.println(
    "Esta operacao apagara:"
  );

  Serial.println(
    "- todas as etiquetas cadastradas"
  );

  Serial.println(
    "- todos os lotes"
  );

  Serial.println(
    "- todos os resultados de revisao"
  );

  Serial.println();

  Serial.println(
    "Digite APAGAR para confirmar."
  );

  Serial.println(
    "Digite qualquer outra coisa para cancelar."
  );

  Serial.println(
    "========================================"
  );

  String confirmacao =
    "";

  lerLinhaSerialCooperativa(confirmacao);

  if (
    !confirmacao.equalsIgnoreCase(
      "APAGAR"
    )
  ) {

    Serial.println();
    Serial.println(
      "Operacao cancelada. Nenhum dado foi apagado."
    );

    mostrarMenu();

    return;
  }

  Serial.println();
  Serial.println(
    "Apagando etiquetas da memoria..."
  );

  bool apagou =
    prefs.clear();

  if (
    !apagou
  ) {

    Serial.println(
      "ERRO: nao foi possivel limpar a memoria NVS."
    );

    beep(3);

    return;
  }

  for (
    int i = 0;
    i < MAX_TAGS_SALVAS;
    i++
  ) {

    memset(
      tagsSalvas[i].epc,
      0,
      MAX_EPC_LEN
    );

    tagsSalvas[i].len =
      0;

    tagsSalvas[i].tipo =
      "";

    tagsSalvas[i].tamanho =
      "";

    tagsSalvas[i].pronta =
      false;

    tagsSalvas[i].ultimoResultado =
      "";
  }

  numTagsSalvas =
    0;

  quantidadeTagsCadastro =
    0;

  quantidadeTagsSessao =
    0;

  tipoPeca =
    "";

  tamanho =
    "";

  loteTipo =
    "";

  loteTamanho =
    "";

  loteSelecionado =
    false;

  pecaPresente =
    false;

  resultadoDefinido =
    false;

  etiquetaCorreta =
    false;

  resultadoAtual =
    "";

  IntegracaoSensorRFID::reiniciarSessao();

  Serial.println();
  Serial.println(
    "========================================"
  );

  Serial.println(
    "TODAS AS ETIQUETAS FORAM APAGADAS."
  );

  Serial.println(
    "Banco RFID vazio."
  );

  Serial.println(
    "========================================"
  );

  beep(2);

  mostrarMenu();
}


// ============================================================
// CADASTRO
// ============================================================

void iniciarCadastro() {

  modoAtual =
    MODO_CADASTRO;

  quantidadeTagsCadastro = 0;

  tipoPeca = "";
  tamanho = "";

  Serial.println();
  Serial.println(
    "========== NOVO CADASTRO =========="
  );

  Serial.println(
    "Digite o tipo da peça:"
  );

  String entrada =
    "";

  lerLinhaSerialCooperativa(entrada);

  // Permitir SAIR durante o cadastro
  if (
    entrada.equalsIgnoreCase("sair")
  ) {

    sairDoModoAtual();
    return;
  }

  tipoPeca =
    entrada;

  Serial.println(
    "Digite o tamanho:"
  );

  lerLinhaSerialCooperativa(entrada);

  // Permitir SAIR durante o cadastro
  if (
    entrada.equalsIgnoreCase("sair")
  ) {

    sairDoModoAtual();
    return;
  }

  tamanho =
    entrada;

  Serial.println();

  Serial.print(
    "Tipo: "
  );

  Serial.println(
    tipoPeca
  );

  Serial.print(
    "Tamanho: "
  );

  Serial.println(
    tamanho
  );

  Serial.println();

  Serial.println(
    "Aproxime as etiquetas para cadastro."
  );

  Serial.println(
    "Digite 'salvar' quando terminar."
  );

  Serial.println(
    "Digite 'sair' para cancelar."
  );

  lastTagTime =
    millis();

  sendInventoryCmd();
}

// ============================================================
// SALVAR CADASTRO
// ============================================================

void salvarCadastro() {

  if (
    quantidadeTagsCadastro == 0
  ) {

    Serial.println(
      "Nenhuma etiqueta foi cadastrada."
    );

    return;
  }

  Serial.println();

  Serial.print(
    "Salvando "
  );

  Serial.print(
    quantidadeTagsCadastro
  );

  Serial.println(
    " etiquetas..."
  );

  for (
    int i = 0;
    i < quantidadeTagsCadastro;
    i++
  ) {

    if (
      numTagsSalvas >=
      MAX_TAGS_SALVAS
    ) {

      Serial.println(
        "ERRO: limite de etiquetas atingido."
      );

      break;
    }

    memcpy(
      tagsSalvas[numTagsSalvas].epc,
      epcCadastro[i],
      lenCadastro[i]
    );

    tagsSalvas[numTagsSalvas].len =
      lenCadastro[i];

    tagsSalvas[numTagsSalvas].tipo =
      tipoPeca;

    tagsSalvas[numTagsSalvas].tamanho =
      tamanho;

    tagsSalvas[numTagsSalvas].pronta =
      false;

    tagsSalvas[numTagsSalvas].ultimoResultado =
      "NAO_REVISADA";

    numTagsSalvas++;

    salvarTagNVS(
      numTagsSalvas - 1
    );
  }

  Serial.println(
    "Cadastro concluido."
  );

  quantidadeTagsCadastro = 0;

  tipoPeca = "";
  tamanho = "";

  modoAtual =
    MODO_IDLE;

  Serial.println();

  mostrarMenu();
}

// ============================================================
// PROCESSAR TAG NO CADASTRO
// ============================================================

void processarTagCadastro(
  uint8_t *epc,
  uint8_t len
) {

  if (
    epcJaNoCadastro(
      epc,
      len
    )
  ) {

    return;
  }

  if (
    quantidadeTagsCadastro >=
    MAX_TAGS_SESSAO
  ) {

    Serial.println(
      "Limite da sessão de cadastro atingido."
    );

    return;
  }

  memcpy(
    epcCadastro[quantidadeTagsCadastro],
    epc,
    len
  );

  lenCadastro[quantidadeTagsCadastro] =
    len;

  quantidadeTagsCadastro++;

  lastTagTime =
    millis();

  Serial.print(
    "Etiqueta cadastrada: "
  );

  Serial.println(
    epcToString(
      epc,
      len
    )
  );

  imprimirRSSI(
    ultimoRSSIRaw
  );

  Serial.print(
    "Total nesta sessão: "
  );

  Serial.println(
    quantidadeTagsCadastro
  );
}

// ============================================================
// CONTAR PENDENTES DO LOTE
// ============================================================

int contarPendentesLote(
  String tipo,
  String tamanho
) {

  int contador = 0;

  for (
    int i = 0;
    i < numTagsSalvas;
    i++
  ) {

    if (
      tagsSalvas[i].tipo == tipo &&
      tagsSalvas[i].tamanho == tamanho &&
      !tagsSalvas[i].pronta
    ) {

      contador++;
    }
  }

  return contador;
}

// ============================================================
// CONTAR TOTAL DO LOTE
// ============================================================

int contarTotalLote(
  String tipo,
  String tamanho
) {

  int contador = 0;

  for (
    int i = 0;
    i < numTagsSalvas;
    i++
  ) {

    if (
      tagsSalvas[i].tipo == tipo &&
      tagsSalvas[i].tamanho == tamanho
    ) {

      contador++;
    }
  }

  return contador;
}

// ============================================================
// CONTAR REVISADAS
// ============================================================

int contarRevisadasLote(
  String tipo,
  String tamanho
) {

  int contador = 0;

  for (
    int i = 0;
    i < numTagsSalvas;
    i++
  ) {

    if (
      tagsSalvas[i].tipo == tipo &&
      tagsSalvas[i].tamanho == tamanho &&
      tagsSalvas[i].pronta
    ) {

      contador++;
    }
  }

  return contador;
}

// ============================================================
// VERIFICAR LOTE JÁ LISTADO
// ============================================================

bool loteJaListado(
  String tipo,
  String tamanho,
  String tipos[],
  String tamanhos[],
  int quantidade
) {

  for (
    int i = 0;
    i < quantidade;
    i++
  ) {

    if (
      tipos[i] == tipo &&
      tamanhos[i] == tamanho
    ) {

      return true;
    }
  }

  return false;
}

// ============================================================
// MOSTRAR LOTES
// ============================================================

void mostrarLotesRevisao() {

  Serial.println();
  Serial.println(
    "========================================"
  );

  Serial.println(
    "          LOTES PARA REVISAO"
  );

  Serial.println(
    "========================================"
  );

  String tipos[MAX_LOTES_UNICOS];
  String tamanhos[MAX_LOTES_UNICOS];

  int quantidadeLotes = 0;

  for (
    int i = 0;
    i < numTagsSalvas;
    i++
  ) {

    String tipo =
      tagsSalvas[i].tipo;

    String tam =
      tagsSalvas[i].tamanho;

    if (
      quantidadeLotes >= MAX_LOTES_UNICOS ||
      loteJaListado(
        tipo,
        tam,
        tipos,
        tamanhos,
        quantidadeLotes
      )
    ) {

      continue;
    }

    tipos[quantidadeLotes] =
      tipo;

    tamanhos[quantidadeLotes] =
      tam;

    quantidadeLotes++;
  }

  int numero = 1;

  for (
    int i = 0;
    i < quantidadeLotes;
    i++
  ) {

    int total =
      contarTotalLote(
        tipos[i],
        tamanhos[i]
      );

    int revisadas =
      contarRevisadasLote(
        tipos[i],
        tamanhos[i]
      );

    int pendentes =
      contarPendentesLote(
        tipos[i],
        tamanhos[i]
      );

    // Não mostra lote já concluído
    if (
      pendentes == 0
    )
      continue;

    Serial.print(
      "["
    );

    Serial.print(
      numero
    );

    Serial.print(
      "] "
    );

    Serial.print(
      tipos[i]
    );

    Serial.print(
      " "
    );

    Serial.print(
      tamanhos[i]
    );

    Serial.print(
      " | Total: "
    );

    Serial.print(
      total
    );

    Serial.print(
      " | Revisadas: "
    );

    Serial.print(
      revisadas
    );

    Serial.print(
      " | Pendentes: "
    );

    Serial.println(
      pendentes
    );

    numero++;
  }

  if (
    numero == 1
  ) {

    Serial.println(
      "Todos os lotes foram revisados!"
    );
  }

  Serial.println(
    "========================================"
  );
}

// ============================================================
// SELECIONAR LOTE
// ============================================================

bool selecionarLotePorNumero(
  int escolha
) {

  String tipos[MAX_LOTES_UNICOS];
  String tamanhos[MAX_LOTES_UNICOS];

  int quantidadeLotes = 0;

  for (
    int i = 0;
    i < numTagsSalvas;
    i++
  ) {

    String tipo =
      tagsSalvas[i].tipo;

    String tam =
      tagsSalvas[i].tamanho;

    if (
      quantidadeLotes >= MAX_LOTES_UNICOS ||
      loteJaListado(
        tipo,
        tam,
        tipos,
        tamanhos,
        quantidadeLotes
      )
    ) {

      continue;
    }

    if (
      contarPendentesLote(
        tipo,
        tam
      ) == 0
    ) {

      continue;
    }

    tipos[quantidadeLotes] =
      tipo;

    tamanhos[quantidadeLotes] =
      tam;

    quantidadeLotes++;
  }

  if (
    escolha < 1 ||
    escolha > quantidadeLotes
  ) {

    return false;
  }

  loteTipo =
    tipos[escolha - 1];

  loteTamanho =
    tamanhos[escolha - 1];

  loteSelecionado =
    true;

  return true;
}

// ============================================================
// INICIAR REVISÃO
// ============================================================

void iniciarRevisao() {

  if (
    !IntegracaoSensorRFID::estaCalibrado()
  ) {

    Serial.println();
    Serial.println(
      "Calibre o arco vazio antes de iniciar a revisao."
    );

    Serial.println(
      "Digite: calibrar"
    );

    return;
  }

  if (
    numTagsSalvas == 0
  ) {

    Serial.println(
      "Nenhuma etiqueta cadastrada."
    );

    return;
  }

  mostrarLotesRevisao();

  Serial.println();
  Serial.println(
    "Digite o numero do lote:"
  );

  Serial.println(
    "Digite 'sair' para voltar ao menu."
  );

  String entrada =
    "";

  lerLinhaSerialCooperativa(entrada);

  // SAIR DURANTE SELEÇÃO DO LOTE
  if (
    entrada.equalsIgnoreCase("sair")
  ) {

    sairDoModoAtual();
    return;
  }

  int escolha =
    entrada.toInt();

  if (
    !selecionarLotePorNumero(
      escolha
    )
  ) {

    Serial.println(
      "Lote invalido."
    );

    return;
  }

  modoAtual =
    MODO_REVISAO;

  IntegracaoSensorRFID::reiniciarSessao();

  resetSessaoRevisao();

  int total =
    contarTotalLote(
      loteTipo,
      loteTamanho
    );

  int revisadas =
    contarRevisadasLote(
      loteTipo,
      loteTamanho
    );

  int pendentes =
    contarPendentesLote(
      loteTipo,
      loteTamanho
    );

  Serial.println();
  Serial.println(
    "========================================"
  );

  Serial.println(
    "          REVISAO INICIADA"
  );

  Serial.print(
    "Lote: "
  );

  Serial.print(
    loteTipo
  );

  Serial.print(
    " "
  );

  Serial.println(
    loteTamanho
  );

  Serial.print(
    "Total: "
  );

  Serial.println(
    total
  );

  Serial.print(
    "Ja revisadas: "
  );

  Serial.println(
    revisadas
  );

  Serial.print(
    "Pendentes: "
  );

  Serial.println(
    pendentes
  );

  Serial.println();

  Serial.println(
    "Digite S = peça presente"
  );

  Serial.println(
    "Digite N = peça ausente"
  );

  Serial.println(
    "Digite SAIR = cancelar revisão"
  );

  Serial.println(
    "========================================"
  );
}

// ============================================================
// RESET DA SESSÃO DA PEÇA
// ============================================================

void resetSessaoRevisao() {

  quantidadeTagsSessao = 0;

  resultadoDefinido =
    false;

  etiquetaCorreta =
    false;

  resultadoAtual =
    "";
}

// ============================================================
// FINALIZAR COMPLETAMENTE O MODO REVISÃO
// ============================================================

void encerrarModoRevisao() {

  pecaPresente =
    false;

  IntegracaoSensorRFID::reiniciarSessao();

  resetSessaoRevisao();

  loteTipo = "";
  loteTamanho = "";

  loteSelecionado =
    false;

  modoAtual =
    MODO_IDLE;
}

// ============================================================
// SAIR DO MODO ATUAL
// ============================================================

void sairDoModoAtual() {

  // ----------------------------------------------------------
  // JÁ ESTÁ NO MENU
  // ----------------------------------------------------------

  if (
    modoAtual ==
    MODO_IDLE
  ) {

    pecaPresente =
      false;

    Serial.println();
    Serial.println(
      "O sistema ja esta no menu principal."
    );

    mostrarMenu();

    return;
  }

  // ----------------------------------------------------------
  // CADASTRO
  // ----------------------------------------------------------

  if (
    modoAtual ==
    MODO_CADASTRO
  ) {

    Serial.println();
    Serial.println(
      "========================================"
    );

    Serial.println(
      "CADASTRO CANCELADO."
    );

    Serial.println(
      "As etiquetas desta sessao nao foram salvas."
    );

    Serial.println(
      "========================================"
    );

    quantidadeTagsCadastro =
      0;

    tipoPeca = "";
    tamanho = "";

    pecaPresente =
      false;

    modoAtual =
      MODO_IDLE;

    mostrarMenu();

    return;
  }

  // ----------------------------------------------------------
  // REVISÃO
  // ----------------------------------------------------------

  if (
    modoAtual ==
    MODO_REVISAO
  ) {

    Serial.println();
    Serial.println(
      "========================================"
    );

    Serial.println(
      "REVISAO CANCELADA."
    );

    if (
      loteSelecionado
    ) {

      Serial.print(
        "Lote: "
      );

      Serial.print(
        loteTipo
      );

      Serial.print(
        " "
      );

      Serial.println(
        loteTamanho
      );
    }

    Serial.println(
      "A peça atual nao foi marcada como pronta."
    );

    Serial.println(
      "========================================"
    );

    encerrarModoRevisao();

    mostrarMenu();

    return;
  }
}

// ============================================================
// VERIFICAR SE EPC PERTENCE AO LOTE
// ============================================================

bool epcPertenceAoLote(
  uint8_t *epc,
  uint8_t len
) {

  int indice =
    findSavedTag(
      epc,
      len
    );

  if (
    indice < 0
  )
    return false;

  if (
    tagsSalvas[indice].tipo ==
      loteTipo &&
    tagsSalvas[indice].tamanho ==
      loteTamanho
  ) {

    return true;
  }

  return false;
}

// ============================================================
// PROCESSAR TAG NA REVISÃO
// ============================================================

void processarTagRevisao(
  uint8_t *epc,
  uint8_t len
) {

  // ----------------------------------------------------------
  // REPETIÇÃO DA MESMA ETIQUETA
  // ----------------------------------------------------------

  if (
    epcJaNaSessao(
      epc,
      len
    )
  ) {

    return;
  }

  if (
    quantidadeTagsSessao >=
    MAX_TAGS_SESSAO
  ) {

    return;
  }

  memcpy(
    epcsSessao[quantidadeTagsSessao],
    epc,
    len
  );

  epcSessaoLen[quantidadeTagsSessao] =
    len;

  quantidadeTagsSessao++;

  Serial.println();

  Serial.print(
    "Etiqueta detectada: "
  );

  Serial.println(
    epcToString(
      epc,
      len
    )
  );

  imprimirRSSI(
    ultimoRSSIRaw
  );

  // ----------------------------------------------------------
  // MAIS DE UMA ETIQUETA
  // ----------------------------------------------------------

  if (
    quantidadeTagsSessao > 1
  ) {

    resultadoDefinido =
      true;

    etiquetaCorreta =
      false;

    resultadoAtual =
      "MULTIPLAS_ETIQUETAS";

    Serial.println(
      "ERRO: MAIS DE UMA ETIQUETA DETECTADA!"
    );

    beep(3);

    return;
  }

  // ----------------------------------------------------------
  // VERIFICAR SE EXISTE
  // ----------------------------------------------------------

  int indice =
    findSavedTag(
      epc,
      len
    );

  if (
    indice < 0
  ) {

    resultadoDefinido =
      true;

    etiquetaCorreta =
      false;

    resultadoAtual =
      "ETIQUETA_NAO_CADASTRADA";

    Serial.println(
      "ERRO: ETIQUETA NAO CADASTRADA!"
    );

    beep(3);

    return;
  }

  // ----------------------------------------------------------
  // VERIFICAR SE JÁ FOI REVISADA
  // ----------------------------------------------------------

  if (
    tagsSalvas[indice].pronta
  ) {

    resultadoDefinido =
      true;

    etiquetaCorreta =
      false;

    resultadoAtual =
      "PECA_JA_REVISADA";

    Serial.println(
      "ERRO: ESTA PECA JA FOI REVISADA!"
    );

    beep(3);

    return;
  }

  // ----------------------------------------------------------
  // VERIFICAR LOTE
  // ----------------------------------------------------------

  if (
    !epcPertenceAoLote(
      epc,
      len
    )
  ) {

    resultadoDefinido =
      true;

    etiquetaCorreta =
      false;

    resultadoAtual =
      "ETIQUETA_OUTRO_LOTE";

    Serial.println(
      "ERRO: ETIQUETA DE OUTRO LOTE!"
    );

    Serial.print(
      "Lote selecionado: "
    );

    Serial.print(
      loteTipo
    );

    Serial.print(
      " "
    );

    Serial.println(
      loteTamanho
    );

    Serial.print(
      "Etiqueta pertence a: "
    );

    Serial.print(
      tagsSalvas[indice].tipo
    );

    Serial.print(
      " "
    );

    Serial.println(
      tagsSalvas[indice].tamanho
    );

    beep(3);

    return;
  }

  // ----------------------------------------------------------
  // ETIQUETA CORRETA
  // ----------------------------------------------------------

  resultadoDefinido =
    true;

  etiquetaCorreta =
    true;

  resultadoAtual =
    "ETIQUETA_CORRETA";

  Serial.println(
    "OK: ETIQUETA CORRETA!"
  );

  beep(1);
}

// ============================================================
// FINALIZAR REVISÃO DA PEÇA
// QUANDO A PEÇA SAI DO ARCO
// ============================================================

void finalizarRevisao() {

  Serial.println();
  Serial.println(
    ">>> PEÇA RETIRADA DO ARCO <<<"
  );

  // ----------------------------------------------------------
  // NENHUMA ETIQUETA
  // ----------------------------------------------------------

  if (
    quantidadeTagsSessao == 0
  ) {

    Serial.println(
      "ERRO: NENHUMA ETIQUETA DETECTADA."
    );

    beep(3);

    resetSessaoRevisao();

    return;
  }

  // ----------------------------------------------------------
  // MAIS DE UMA ETIQUETA
  // ----------------------------------------------------------

  if (
    quantidadeTagsSessao > 1
  ) {

    Serial.println(
      "RESULTADO: MULTIPLAS ETIQUETAS."
    );

    beep(3);

    resetSessaoRevisao();

    return;
  }

  // ----------------------------------------------------------
  // RESULTADO INCORRETO
  // ----------------------------------------------------------

  if (
    !etiquetaCorreta
  ) {

    Serial.println(
      "RESULTADO: PEÇA REPROVADA."
    );

    beep(3);

    resetSessaoRevisao();

    return;
  }

  // ----------------------------------------------------------
  // ENCONTRAR TAG
  // ----------------------------------------------------------

  int indice =
    findSavedTag(
      epcsSessao[0],
      epcSessaoLen[0]
    );

  if (
    indice < 0
  ) {

    Serial.println(
      "ERRO INTERNO: etiqueta nao encontrada."
    );

    beep(3);

    resetSessaoRevisao();

    return;
  }

  // ----------------------------------------------------------
  // APROVAR PEÇA
  // ----------------------------------------------------------

  tagsSalvas[indice].pronta =
    true;

  tagsSalvas[indice].ultimoResultado =
    "APROVADA";

  salvarTagNVS(
    indice
  );

  Serial.println();
  Serial.println(
    "************************************"
  );

  Serial.println(
    "        PEÇA APROVADA!"
  );

  Serial.print(
    "Tipo: "
  );

  Serial.println(
    tagsSalvas[indice].tipo
  );

  Serial.print(
    "Tamanho: "
  );

  Serial.println(
    tagsSalvas[indice].tamanho
  );

  Serial.print(
    "EPC: "
  );

  Serial.println(
    epcToString(
      tagsSalvas[indice].epc,
      tagsSalvas[indice].len
    )
  );

  Serial.println(
    "Peça marcada como PRONTA."
  );

  Serial.println(
    "************************************"
  );

  // ----------------------------------------------------------
  // ATUALIZAR CONTADORES DO LOTE
  // ----------------------------------------------------------

  int pendentes =
    contarPendentesLote(
      loteTipo,
      loteTamanho
    );

  int revisadas =
    contarRevisadasLote(
      loteTipo,
      loteTamanho
    );

  int total =
    contarTotalLote(
      loteTipo,
      loteTamanho
    );

  Serial.println();

  Serial.print(
    "Lote: "
  );

  Serial.print(
    loteTipo
  );

  Serial.print(
    " "
  );

  Serial.println(
    loteTamanho
  );

  Serial.print(
    "Total: "
  );

  Serial.println(
    total
  );

  Serial.print(
    "Revisadas: "
  );

  Serial.println(
    revisadas
  );

  Serial.print(
    "Pendentes: "
  );

  Serial.println(
    pendentes
  );

  // ----------------------------------------------------------
  // LOTE FINALIZADO
  // ----------------------------------------------------------

  if (
    pendentes == 0
  ) {

    Serial.println();
    Serial.println(
      "========================================"
    );

    Serial.println(
      "           LOTE FINALIZADO!"
    );

    Serial.print(
      "Lote: "
    );

    Serial.print(
      loteTipo
    );

    Serial.print(
      " "
    );

    Serial.println(
      loteTamanho
    );

    Serial.print(
      "Peças revisadas: "
    );

    Serial.print(
      revisadas
    );

    Serial.print(
      " / "
    );

    Serial.println(
      total
    );

    Serial.println(
      "Todas as peças deste lote foram revisadas."
    );

    Serial.println(
      "Saindo do modo revisão..."
    );

    Serial.println(
      "========================================"
    );

    // IMPORTANTE:
    // Não aguarda uma nova peça.
    // O lote acabou.

    encerrarModoRevisao();

    mostrarMenu();

    return;
  }

  // ----------------------------------------------------------
  // LOTE AINDA POSSUI PEÇAS
  // ----------------------------------------------------------

  Serial.println();

  Serial.print(
    "Ainda faltam "
  );

  Serial.print(
    pendentes
  );

  Serial.println(
    " peça(s) neste lote."
  );

  Serial.println(
    "Aguardando próxima peça..."
  );

  resetSessaoRevisao();
}

// ============================================================
// PONTE DE ESTADO DO SENSOR PARA O RFID
//
// A função foi mantida com a mesma assinatura para preservar toda
// a lógica já validada. Agora ela é chamada automaticamente pelo
// módulo IntegracaoSensorRFID.
// ============================================================

void sensorSimulado(
  bool presente
) {

  // ----------------------------------------------------------
  // PEÇA ENTROU
  // ----------------------------------------------------------

  if (
    presente &&
    !pecaPresente
  ) {

    pecaPresente =
      true;

    resetSessaoRevisao();

    Serial.println();
    Serial.println(
      ">>> SENSOR: PEÇA PRESENTE <<<"
    );

    Serial.println(
      "RFID LIBERADO."
    );

    Serial.println(
      "Aguardando etiqueta..."
    );

    return;
  }

  // ----------------------------------------------------------
  // PEÇA SAIU
  // ----------------------------------------------------------

  if (
    !presente &&
    pecaPresente
  ) {

    pecaPresente =
      false;

    Serial.println();
    Serial.println(
      ">>> SENSOR: PEÇA AUSENTE <<<"
    );

    if (
      modoAtual ==
      MODO_REVISAO
    ) {

      finalizarRevisao();
    }

    return;
  }

  pecaPresente =
    presente;
}

// ============================================================
// RECEBER RFID COM PRIORIDADE
//
// Esta função deve ser chamada várias vezes em cada passagem do
// loop para evitar acúmulo e perda de bytes na UART.
// ============================================================

void processarRecepcaoRFID() {

  while (
    RFID.available()
  ) {

    uint8_t b =
      RFID.read();

    if (
      !frameActive
    ) {

      if (
        b ==
        FRAME_HEAD
      ) {

        frameActive =
          true;

        rxIndex =
          0;

        rxBuffer[
          rxIndex++
        ] = b;
      }

      continue;
    }

    if (
      rxIndex >=
      sizeof(rxBuffer)
    ) {

      frameActive =
        false;

      rxIndex =
        0;

      continue;
    }

    rxBuffer[
      rxIndex++
    ] = b;

    if (
      b ==
      FRAME_TAIL
    ) {

      processFrame(
        rxBuffer,
        rxIndex
      );

      frameActive =
        false;

      rxIndex =
        0;
    }
  }
}


// ============================================================
// MOSTRAR INTENSIDADE DA ETIQUETA
//
// O byte frame[4] é mostrado em hexadecimal e decimal.
// Não é rotulado como dBm sem a tabela oficial de conversão
// específica do firmware do YRM1001.
// ============================================================

void imprimirRSSI(
  uint8_t rssiRaw
) {

  Serial.print(
    "RSSI bruto: 0x"
  );

  if (
    rssiRaw <
    0x10
  ) {

    Serial.print(
      "0"
    );
  }

  Serial.print(
    rssiRaw,
    HEX
  );

  Serial.print(
    " | decimal: "
  );

  Serial.println(
    rssiRaw
  );
}


// ============================================================
// PROCESSAR FRAME RFID
// ============================================================

void processFrame(
  uint8_t *frame,
  uint8_t len
) {

  if (
    len < 10
  )
    return;

  uint8_t cmd =
    frame[1];

  uint8_t type =
    frame[2];

  // Somente notice de tag
  if (
    cmd != 0x02 ||
    type != 0x22
  )
    return;

  uint16_t soma = 0;

  for (
    uint8_t i = 1;
    i < len - 2;
    i++
  ) {
    soma += frame[i];
  }

  const uint8_t checksumEsperado =
    static_cast<uint8_t>(soma & 0xFF);

  if (
    frame[len - 2] != checksumEsperado
  ) {
    return;
  }

  // No frame de inventário usado pelo YRM1001, o byte 4
  // contém a intensidade bruta informada para a etiqueta.
  ultimoRSSIRaw =
    frame[4];

  int epcLen =
    len - 13;

  if (
    epcLen <= 0 ||
    epcLen > MAX_EPC_LEN
  )
    return;

  uint8_t epc[MAX_EPC_LEN];

  for (
    int i = 0;
    i < epcLen;
    i++
  ) {

    epc[i] =
      frame[7 + i];
  }

  // ----------------------------------------------------------
  // CADASTRO
  // ----------------------------------------------------------

  if (
    modoAtual ==
    MODO_CADASTRO
  ) {

    processarTagCadastro(
      epc,
      epcLen
    );

    return;
  }

  // ----------------------------------------------------------
  // REVISÃO
  // ----------------------------------------------------------

  if (
    modoAtual ==
    MODO_REVISAO
  ) {

    // RFID somente com peça presente
    if (
      !pecaPresente
    )
      return;

    processarTagRevisao(
      epc,
      epcLen
    );

    return;
  }
}

// ============================================================
// STATUS
// ============================================================

void mostrarStatus() {

  Serial.println();
  Serial.println(
    "========== STATUS =========="
  );

  Serial.print(
    "Modo: "
  );

  if (
    modoAtual ==
    MODO_IDLE
  ) {

    Serial.println(
      "IDLE"
    );

  } else if (
    modoAtual ==
    MODO_CADASTRO
  ) {

    Serial.println(
      "CADASTRO"
    );

  } else {

    Serial.println(
      "REVISAO"
    );
  }

  Serial.print(
    "Peca presente: "
  );

  Serial.println(
    pecaPresente
      ? "SIM"
      : "NAO"
  );

  Serial.print(
    "Etiquetas cadastradas: "
  );

  Serial.println(
    numTagsSalvas
  );

  if (
    loteSelecionado
  ) {

    Serial.print(
      "Lote: "
    );

    Serial.print(
      loteTipo
    );

    Serial.print(
      " "
    );

    Serial.println(
      loteTamanho
    );

    Serial.print(
      "Total: "
    );

    Serial.println(
      contarTotalLote(
        loteTipo,
        loteTamanho
      )
    );

    Serial.print(
      "Revisadas: "
    );

    Serial.println(
      contarRevisadasLote(
        loteTipo,
        loteTamanho
      )
    );

    Serial.print(
      "Pendentes: "
    );

    Serial.println(
      contarPendentesLote(
        loteTipo,
        loteTamanho
      )
    );
  }

  Serial.println(
    "============================"
  );
}

// ============================================================
// MENU
// ============================================================

void mostrarMenu() {

  Serial.println();
  Serial.println(
    "========================================"
  );

  Serial.println(
    "             MENU RFID"
  );

  Serial.println(
    "========================================"
  );

  Serial.println(
    "cad      -> Novo cadastro"
  );

  Serial.println(
    "salvar   -> Salvar cadastro"
  );

  Serial.println(
    "revisao  -> Escolher lote para revisar"
  );

  Serial.println(
    "lista    -> Mostrar lotes cadastrados"
  );

  Serial.println(
    "apagar   -> Apagar todas as tags cadastradas"
  );

  Serial.println(
    "calibrar -> Calibrar arco vazio"
  );

  Serial.println(
    "sensor   -> Mostrar status do VL53L5CX"
  );

  Serial.println(
    "matriz   -> Mostrar matriz 8x8 do VL53L5CX"
  );

  Serial.println(
    "status   -> Mostrar status"
  );

  Serial.println(
    "menu     -> Mostrar menu"
  );

  Serial.println(
    "sair     -> Sair/cancelar modo atual"
  );

  Serial.println(
    "========================================"
  );
}

// ============================================================
// COMANDOS SERIAL
// ============================================================

void processarComandoSerial() {

  if (
    !Serial.available()
  )
    return;

  String cmd =
    "";

  lerLinhaSerialCooperativa(cmd);

  cmd.toLowerCase();

  // ==========================================================
  // SAIR - PRIMEIRO DE PROPÓSITO
  // ==========================================================

  // Este comando fica ANTES dos demais para ter prioridade.

  if (
    cmd == "sair" ||
    cmd == "cancelar"
  ) {

    sairDoModoAtual();

    return;
  }

  // ==========================================================
  // CADASTRO
  // ==========================================================

  if (
    cmd == "cad"
  ) {

    if (
      modoAtual !=
      MODO_IDLE
    ) {

      Serial.println(
        "Finalize o modo atual primeiro."
      );

      return;
    }

    iniciarCadastro();

    return;
  }

  // ==========================================================
  // SALVAR
  // ==========================================================

  if (
    cmd == "salvar"
  ) {

    if (
      modoAtual ==
      MODO_CADASTRO
    ) {

      salvarCadastro();

    } else {

      Serial.println(
        "Nao existe cadastro em andamento."
      );
    }

    return;
  }

  // ==========================================================
  // LISTA
  // ==========================================================

  if (
    cmd == "lista"
  ) {

    mostrarLotesRevisao();

    return;
  }


  // ==========================================================
  // APAGAR TODAS AS TAGS
  // ==========================================================

  if (
    cmd == "apagar" ||
    cmd == "apagartags" ||
    cmd == "limpar"
  ) {

    apagarTodasTagsCadastradas();

    return;
  }


  // ==========================================================
  // REVISÃO
  // ==========================================================

  if (
    cmd == "revisao"
  ) {

    if (
      modoAtual !=
      MODO_IDLE
    ) {

      Serial.println(
        "Finalize o modo atual primeiro."
      );

      return;
    }

    iniciarRevisao();

    return;
  }

  // ==========================================================
  // CALIBRAR SENSOR TOF
  // ==========================================================

  if (
    cmd == "calibrar" ||
    cmd == "cal"
  ) {

    if (
      modoAtual !=
      MODO_IDLE
    ) {

      Serial.println(
        "Saia do modo atual antes de calibrar."
      );

      return;
    }

    IntegracaoSensorRFID::calibrarArcoVazio();

    return;
  }


  // ==========================================================
  // STATUS DO SENSOR TOF
  // ==========================================================

  if (
    cmd == "sensor" ||
    cmd == "statussensor"
  ) {

    IntegracaoSensorRFID::mostrarStatusSensor();

    return;
  }


  // ==========================================================
  // MATRIZ DO SENSOR TOF
  // ==========================================================

  if (
    cmd == "matriz"
  ) {

    IntegracaoSensorRFID::mostrarMatrizSensor();

    return;
  }


  // ==========================================================
  // STATUS
  // ==========================================================

  if (
    cmd == "status"
  ) {

    mostrarStatus();

    return;
  }

  // ==========================================================
  // MENU
  // ==========================================================

  if (
    cmd == "menu" ||
    cmd == "ajuda"
  ) {

    mostrarMenu();

    return;
  }

  // ==========================================================
  // DESCONHECIDO
  // ==========================================================

  Serial.println(
    "Comando desconhecido."
  );

  Serial.println(
    "Digite 'menu' para ver os comandos."
  );
}

// ============================================================
// SETUP
// ============================================================

void setup() {

  Serial.begin(
    115200
  );

  delay(1000);

  Serial.println();
  Serial.println(
    "========================================"
  );

  Serial.println(
    "ESP32 + RFID UHF"
  );

  Serial.println(
    "Cadastro e Revisao por Lote"
  );

  Serial.println(
    "========================================"
  );

  // ----------------------------------------------------------
  // SENSOR VL53L5CX
  // ----------------------------------------------------------

  if (
    !IntegracaoSensorRFID::iniciar(
      beep,
      processarRecepcaoRFID
    )
  ) {

    Serial.println(
      "ERRO: o sistema continuara sem o sensor ToF."
    );
  }

  // ----------------------------------------------------------
  // NVS
  // ----------------------------------------------------------

  prefs.begin(
    "rfid_sistema",
    false
  );

  carregarTagsNVS();

  // ----------------------------------------------------------
  // RFID
  // ----------------------------------------------------------

  // Buffer maior para absorver respostas do inventário enquanto
  // o ESP32 executa uma leitura I2C do VL53L5CX.
  RFID.setRxBufferSize(
    2048
  );

  RFID.begin(
    115200,
    SERIAL_8N1,
    RFID_RX,
    RFID_TX
  );

  delay(500);

  Serial.println(
    "Configurando regiao."
  );

  sendCommand(
    CMD_SET_REGION,
    sizeof(CMD_SET_REGION)
  );

  Serial.println(
    "Configurando potencia TX."
  );

  sendCommand(
    CMD_SET_POWER,
    sizeof(CMD_SET_POWER)
  );

  Serial.println();

  Serial.println(
    "Cadencia RFID: timer 50 ms + delay 100 ms apos comando."
  );

  Serial.println(
    "TESTE RFID SEMPRE ATIVO: inventario independente do sensor."
  );

  Serial.println(
    "Sistema pronto."
  );

  mostrarMenu();
}

// ============================================================
// LOOP
// ============================================================

void loop() {

  static unsigned long lastInventory =
    0;

  // ==========================================================
  // 1. PRIORIDADE MÁXIMA: RECEBER RFID
  // ==========================================================

  processarRecepcaoRFID();


  // ==========================================================
  // 2. INVENTÁRIO RFID SEMPRE ATIVO - TESTE
  //
  // Neste teste o inventário não depende de cadastro,
  // revisão ou presença da peça. A intenção é comparar o
  // desempenho do YRM1001 com o código simples que apresentou
  // melhor alcance e maior velocidade.
  //
  // Mantemos:
  //   INVENTORY_INTERVAL = 50 ms
  //   delay(100) dentro de sendCommand()
  // ==========================================================

  if (
    millis() -
    lastInventory >=
    INVENTORY_INTERVAL
  ) {

    lastInventory =
      millis();

    sendInventoryCmd();
  }


  // ==========================================================
  // 3. DRENAR NOVAMENTE A UART LOGO APÓS O INVENTÁRIO
  // ==========================================================

  processarRecepcaoRFID();


  // ==========================================================
  // 4. COMANDOS DO OPERADOR
  // ==========================================================

  processarComandoSerial();


  // ==========================================================
  // 5. SENSOR VL53L5CX / LÓGICA DE PRESENÇA
  // ==========================================================

  IntegracaoSensorRFID::atualizar(
    modoAtual == MODO_REVISAO,
    sensorSimulado
  );


  // ==========================================================
  // 6. DRENAR UART RFID ANTES DE ENCERRAR O LOOP
  // ==========================================================

  processarRecepcaoRFID();
}
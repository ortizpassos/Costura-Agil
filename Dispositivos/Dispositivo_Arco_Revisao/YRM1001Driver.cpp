#include "YRM1001Driver.h"

YRM1001Driver::YRM1001Driver(
  HardwareSerial &serial,
  int8_t rxPin,
  int8_t txPin
) :
  _serial(serial),
  _rxPin(rxPin),
  _txPin(txPin) {
}

bool YRM1001Driver::begin(
  uint32_t baud,
  size_t rxBufferSize
) {
  _serial.setRxBufferSize(rxBufferSize);

  _serial.begin(
    baud,
    SERIAL_8N1,
    _rxPin,
    _txPin
  );

  // O YRM1001 precisa estabilizar antes de receber os comandos
  // de região e potência. O código simples que apresentou bom
  // alcance aguardava 500 ms após RFID.begin().
  delay(500);

  // Descarta bytes residuais gerados durante a energização.
  while (_serial.available()) {
    _serial.read();
  }

  _estado = Estado::PRONTO;
  return true;
}

bool YRM1001Driver::configurar(
  uint8_t regionCode,
  uint16_t powerCentiDbm,
  uint32_t timeoutPorComandoMs
) {
  (void)timeoutPorComandoMs;

  _estado = Estado::CONFIGURANDO;

  /*
    Usa exatamente o formato do código simples validado:

      SET REGION:
      BB 00 07 00 01 RR CS 7E

      SET POWER:
      BB 00 B6 00 02 PH PL CS 7E

    O checksum é a soma dos bytes entre BB e CS, mantendo 8 bits.
  */

  const uint8_t comandoRegiao[] = {
    0xBB,
    0x00,
    0x07,
    0x00,
    0x01,
    regionCode,
    static_cast<uint8_t>(
      (0x00 + 0x07 + 0x00 + 0x01 + regionCode) & 0xFF
    ),
    0x7E
  };

  enviarComandoBruto(
    comandoRegiao,
    sizeof(comandoRegiao),
    100
  );

  const uint8_t potenciaAlta =
    static_cast<uint8_t>(powerCentiDbm >> 8);

  const uint8_t potenciaBaixa =
    static_cast<uint8_t>(powerCentiDbm & 0xFF);

  const uint8_t checksumPotencia =
    static_cast<uint8_t>(
      (
        0x00 +
        0xB6 +
        0x00 +
        0x02 +
        potenciaAlta +
        potenciaBaixa
      ) & 0xFF
    );

  const uint8_t comandoPotencia[] = {
    0xBB,
    0x00,
    0xB6,
    0x00,
    0x02,
    potenciaAlta,
    potenciaBaixa,
    checksumPotencia,
    0x7E
  };

  enviarComandoBruto(
    comandoPotencia,
    sizeof(comandoPotencia),
    100
  );

  _regiao = regionCode;
  _potenciaCentiDbm = powerCentiDbm;
  _estado = Estado::PRONTO;

  return true;
}

bool YRM1001Driver::iniciarInventario(
  uint16_t ciclos
) {
  if (
    _estado == Estado::ERRO ||
    _estado == Estado::DESLIGADO ||
    _estado == Estado::CONFIGURANDO
  ) {
    return false;
  }

  if (_estado == Estado::INVENTARIANDO) {
    return true;
  }

  _ciclosInventario = ciclos;
  _ultimoComandoInventarioMs = 0;

  _janelaEstatisticasMs = millis();
  _inventariosNaJanela = 0;
  _tagsNaJanela = 0;
  _somaRssiJanela = 0;

  _stats.inventariosPorSegundo = 0;
  _stats.tagsPorSegundo = 0;
  _stats.rssiMedioDbm = 0;

  _estado = Estado::INVENTARIANDO;
  _stats.iniciosInventario++;

  // Primeira varredura imediatamente.
  enviarInventarioAgora();

  return true;
}

bool YRM1001Driver::pararInventario(
  uint32_t timeoutMs
) {
  if (_estado != Estado::INVENTARIANDO) {
    return true;
  }

  const bool sucesso = enviarEEsperarResposta(
    0x28,
    nullptr,
    0,
    timeoutMs
  );

  _estado = Estado::PRONTO;
  _ultimoComandoInventarioMs = 0;

  if (sucesso) {
    _stats.paradasInventario++;
  }

  return sucesso;
}

void YRM1001Driver::definirIntervaloInventario(
  uint16_t intervaloMs
) {
  if (intervaloMs < 10) {
    intervaloMs = 10;
  }

  if (intervaloMs > 1000) {
    intervaloMs = 1000;
  }

  _intervaloInventarioMs = intervaloMs;
}

uint16_t YRM1001Driver::intervaloInventario() const {
  return _intervaloInventarioMs;
}

void YRM1001Driver::atualizar() {
  // Primeiro processa tudo que já chegou.
  receberBytes();

  atualizarEstatisticasPorSegundo();

  if (_estado != Estado::INVENTARIANDO) {
    return;
  }

  const uint32_t agora = millis();

  if (
    agora - _ultimoComandoInventarioMs >=
    _intervaloInventarioMs
  ) {
    enviarInventarioAgora();

    // Processa qualquer resposta que já esteja disponível.
    receberBytes();
  }
}

void YRM1001Driver::enviarInventarioAgora() {
  const uint8_t parametros[] = {
    0x22,
    static_cast<uint8_t>(_ciclosInventario >> 8),
    static_cast<uint8_t>(_ciclosInventario & 0xFF)
  };

  enviarFrame(
    0x00,
    0x27,
    parametros,
    sizeof(parametros)
  );

  _ultimoComandoInventarioMs = millis();
  _stats.comandosInventarioEnviados++;
  _inventariosNaJanela++;
}

void YRM1001Driver::atualizarEstatisticasPorSegundo() {
  const uint32_t agora = millis();

  if (_janelaEstatisticasMs == 0) {
    _janelaEstatisticasMs = agora;
    return;
  }

  const uint32_t decorrido =
    agora - _janelaEstatisticasMs;

  if (decorrido < 1000) {
    return;
  }

  _stats.inventariosPorSegundo =
    static_cast<uint16_t>(
      (
        static_cast<uint32_t>(_inventariosNaJanela) *
        1000UL
      ) /
      decorrido
    );

  _stats.tagsPorSegundo =
    static_cast<uint16_t>(
      (
        static_cast<uint32_t>(_tagsNaJanela) *
        1000UL
      ) /
      decorrido
    );

  if (_tagsNaJanela > 0) {
    _stats.rssiMedioDbm =
      static_cast<int16_t>(
        _somaRssiJanela /
        static_cast<int32_t>(_tagsNaJanela)
      );
  } else {
    _stats.rssiMedioDbm = 0;
  }

  _inventariosNaJanela = 0;
  _tagsNaJanela = 0;
  _somaRssiJanela = 0;
  _janelaEstatisticasMs = agora;
}

void YRM1001Driver::definirCallbackTag(
  TagCallback callback
) {
  _tagCallback = callback;
}

YRM1001Driver::Estado
YRM1001Driver::estado() const {
  return _estado;
}

bool YRM1001Driver::pronto() const {
  return
    _estado == Estado::PRONTO ||
    _estado == Estado::INVENTARIANDO;
}

bool YRM1001Driver::inventariando() const {
  return _estado == Estado::INVENTARIANDO;
}

uint8_t YRM1001Driver::regiaoConfigurada() const {
  return _regiao;
}

uint16_t YRM1001Driver::potenciaCentiDbm() const {
  return _potenciaCentiDbm;
}

YRM1001Driver::Estatisticas
YRM1001Driver::estatisticas() const {
  return _stats;
}

void YRM1001Driver::resetarEstatisticas() {
  memset(&_stats, 0, sizeof(_stats));
}

void YRM1001Driver::mostrarStatus(
  Stream &saida
) const {
  saida.println();
  saida.println(F("========== YRM1001 =========="));

  saida.print(F("Estado: "));
  saida.println(nomeEstado());

  saida.print(F("Regiao: 0x"));
  saida.println(_regiao, HEX);

  saida.print(F("Potencia: "));
  saida.print(
    _potenciaCentiDbm / 100.0f,
    2
  );
  saida.println(F(" dBm"));

  saida.print(F("Bytes recebidos: "));
  saida.println(_stats.bytesRecebidos);

  saida.print(F("Frames validos: "));
  saida.println(_stats.framesValidos);

  saida.print(F("Frames invalidos: "));
  saida.println(_stats.framesInvalidos);

  saida.print(F("Tags recebidas: "));
  saida.println(_stats.tagsRecebidas);

  saida.print(F("Erros de protocolo: "));
  saida.println(_stats.errosProtocolo);

  saida.print(F("Intervalo inventario: "));
  saida.print(_intervaloInventarioMs);
  saida.println(F(" ms"));

  saida.print(F("Comandos inventario: "));
  saida.println(_stats.comandosInventarioEnviados);

  saida.print(F("Inventarios/s: "));
  saida.println(_stats.inventariosPorSegundo);

  saida.print(F("Tags/s: "));
  saida.println(_stats.tagsPorSegundo);

  saida.print(F("RSSI medio: "));
  if (_stats.tagsPorSegundo > 0) {
    saida.print(_stats.rssiMedioDbm);
    saida.println(F(" dBm"));
  } else {
    saida.println(F("--"));
  }

  saida.print(F("Inicios/paradas: "));
  saida.print(_stats.iniciosInventario);
  saida.print(F(" / "));
  saida.println(_stats.paradasInventario);

  saida.println(F("============================="));
}

void YRM1001Driver::enviarComandoBruto(
  const uint8_t *comando,
  size_t tamanho,
  uint16_t esperaMs
) {
  _serial.write(
    comando,
    tamanho
  );

  if (esperaMs > 0) {
    delay(esperaMs);
  }
}


void YRM1001Driver::enviarFrame(
  uint8_t tipo,
  uint8_t comando,
  const uint8_t *parametros,
  uint16_t tamanhoParametros
) {
  const uint8_t checksum = calcularChecksum(
    tipo,
    comando,
    tamanhoParametros,
    parametros
  );

  _serial.write(FRAME_HEAD);
  _serial.write(tipo);
  _serial.write(comando);
  _serial.write(
    static_cast<uint8_t>(
      tamanhoParametros >> 8
    )
  );
  _serial.write(
    static_cast<uint8_t>(
      tamanhoParametros & 0xFF
    )
  );

  if (
    parametros != nullptr &&
    tamanhoParametros > 0
  ) {
    _serial.write(
      parametros,
      tamanhoParametros
    );
  }

  _serial.write(checksum);
  _serial.write(FRAME_TAIL);
}

uint8_t YRM1001Driver::calcularChecksum(
  uint8_t tipo,
  uint8_t comando,
  uint16_t tamanhoParametros,
  const uint8_t *parametros
) const {
  uint16_t soma = 0;

  soma += tipo;
  soma += comando;
  soma += static_cast<uint8_t>(
    tamanhoParametros >> 8
  );
  soma += static_cast<uint8_t>(
    tamanhoParametros & 0xFF
  );

  if (parametros != nullptr) {
    for (
      uint16_t i = 0;
      i < tamanhoParametros;
      i++
    ) {
      soma += parametros[i];
    }
  }

  return static_cast<uint8_t>(
    soma & 0xFF
  );
}

bool YRM1001Driver::enviarEEsperarResposta(
  uint8_t comando,
  const uint8_t *parametros,
  uint16_t tamanhoParametros,
  uint32_t timeoutMs
) {
  _aguardandoResposta = true;
  _comandoEsperado = comando;
  _respostaRecebida = false;
  _respostaSucesso = false;

  enviarFrame(
    0x00,
    comando,
    parametros,
    tamanhoParametros
  );

  const uint32_t inicio = millis();

  while (
    !_respostaRecebida &&
    millis() - inicio < timeoutMs
  ) {
    receberBytes();
    delay(1);
  }

  _aguardandoResposta = false;

  return
    _respostaRecebida &&
    _respostaSucesso;
}

void YRM1001Driver::receberBytes() {
  while (_serial.available()) {
    const uint8_t byteRecebido =
      _serial.read();

    _stats.bytesRecebidos++;

    if (!_recebendoFrame) {
      if (byteRecebido == FRAME_HEAD) {
        _recebendoFrame = true;
        _frameLen = 0;
        _frame[_frameLen++] = byteRecebido;
      }

      continue;
    }

    if (_frameLen >= FRAME_BUFFER_SIZE) {
      _recebendoFrame = false;
      _frameLen = 0;
      _stats.framesInvalidos++;
      continue;
    }

    _frame[_frameLen++] = byteRecebido;

    /*
      Parser compatível com o código de teste validado:
      o frame termina ao receber 0x7E.
    */
    if (byteRecebido == FRAME_TAIL) {
      processarFrameRecebido();
      _recebendoFrame = false;
      _frameLen = 0;
    }
  }
}


void YRM1001Driver::processarFrameRecebido() {
  if (_frameLen < 10) {
    _stats.framesInvalidos++;
    return;
  }

  /*
    Mantém exatamente a interpretação do código que apresentou
    melhor alcance:

      frame[1] = cmd/tipo principal (0x02)
      frame[2] = notice de inventário (0x22)
      frame[4] = RSSI
      frame[7] = início do EPC
      EPC len  = frame total - 13
  */
  if (
    _frame[1] == 0x02 &&
    _frame[2] == 0x22
  ) {
    _stats.framesValidos++;
    tratarTag();
    return;
  }

  // Respostas de configuração/parada não interferem no inventário.
  _stats.framesValidos++;
}

bool YRM1001Driver::validarFrame() const {
  if (_frameLen < 7) {
    return false;
  }

  if (
    _frame[0] != FRAME_HEAD ||
    _frame[_frameLen - 1] != FRAME_TAIL
  ) {
    return false;
  }

  const uint16_t tamanhoParametros =
    (
      static_cast<uint16_t>(_frame[3]) << 8
    ) |
    _frame[4];

  const size_t tamanhoEsperado =
    1 + 1 + 1 + 2 +
    tamanhoParametros +
    1 + 1;

  if (_frameLen != tamanhoEsperado) {
    return false;
  }

  const uint8_t checksumRecebido =
    _frame[_frameLen - 2];

  const uint8_t checksumCalculado =
    calcularChecksum(
      _frame[1],
      _frame[2],
      tamanhoParametros,
      tamanhoParametros > 0
        ? &_frame[5]
        : nullptr
    );

  return checksumRecebido == checksumCalculado;
}

void YRM1001Driver::tratarTag() {
  if (_frameLen < 13) {
    _stats.framesInvalidos++;
    return;
  }

  const int epcLenCalculado =
    static_cast<int>(_frameLen) - 13;

  if (
    epcLenCalculado <= 0 ||
    epcLenCalculado > MAX_EPC_LEN
  ) {
    _stats.framesInvalidos++;
    return;
  }

  TagLida tag{};

  // Exatamente como no código simples validado.
  tag.rssiRaw = _frame[4];
  tag.rssiDbm =
    static_cast<int8_t>(
      tag.rssiRaw
    );

  tag.epcLen =
    static_cast<uint8_t>(
      epcLenCalculado
    );

  memcpy(
    tag.epc,
    &_frame[7],
    tag.epcLen
  );

  // Mantidos como zero nesta variante compatível.
  tag.pc = 0;
  tag.crc = 0;
  tag.timestampMs = millis();

  _stats.tagsRecebidas++;
  _tagsNaJanela++;
  _somaRssiJanela += tag.rssiDbm;

  if (_tagCallback != nullptr) {
    _tagCallback(tag);
  }
}

void YRM1001Driver::tratarRespostaComando() {
  const uint8_t comando =
    _frame[2];

  const uint16_t tamanhoParametros =
    (
      static_cast<uint16_t>(_frame[3]) << 8
    ) |
    _frame[4];

  bool sucesso = true;

  if (tamanhoParametros > 0) {
    sucesso = _frame[5] == 0x00;
  }

  if (
    _aguardandoResposta &&
    comando == _comandoEsperado
  ) {
    _respostaRecebida = true;
    _respostaSucesso = sucesso;
  }
}

void YRM1001Driver::tratarErroProtocolo() {
  _stats.errosProtocolo++;

  if (_aguardandoResposta) {
    _respostaRecebida = true;
    _respostaSucesso = false;
  }
}

const char *YRM1001Driver::nomeEstado() const {
  switch (_estado) {
    case Estado::DESLIGADO:
      return "DESLIGADO";

    case Estado::CONFIGURANDO:
      return "CONFIGURANDO";

    case Estado::PRONTO:
      return "PRONTO";

    case Estado::INVENTARIANDO:
      return "INVENTARIANDO";

    case Estado::ERRO:
      return "ERRO";
  }

  return "DESCONHECIDO";
}

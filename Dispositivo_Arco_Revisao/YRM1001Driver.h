#pragma once
#include <Arduino.h>
#include <HardwareSerial.h>

class YRM1001Driver {
public:
  static constexpr uint8_t MAX_EPC_LEN = 12;

  enum class Estado : uint8_t {
    DESLIGADO,
    CONFIGURANDO,
    PRONTO,
    INVENTARIANDO,
    ERRO
  };

  struct TagLida {
    uint8_t epc[MAX_EPC_LEN];
    uint8_t epcLen;
    uint8_t rssiRaw;
    int8_t rssiDbm;
    uint16_t pc;
    uint16_t crc;
    uint32_t timestampMs;
  };

  struct Estatisticas {
    uint32_t bytesRecebidos;
    uint32_t framesValidos;
    uint32_t framesInvalidos;
    uint32_t tagsRecebidas;
    uint32_t errosProtocolo;
    uint32_t iniciosInventario;
    uint32_t paradasInventario;
    uint32_t comandosInventarioEnviados;

    uint16_t inventariosPorSegundo;
    uint16_t tagsPorSegundo;

    int16_t rssiMedioDbm;
  };

  using TagCallback = void (*)(const TagLida &tag);

  YRM1001Driver(HardwareSerial &serial, int8_t rxPin, int8_t txPin);

  bool begin(uint32_t baud = 115200, size_t rxBufferSize = 2048);
  /**
   * Configura região e potência usando os mesmos frames e tempos
   * do código de teste que apresentou melhor alcance.
   *
   * Não depende de ACK do firmware.
   */
  bool configurar(uint8_t regionCode, uint16_t powerCentiDbm,
                  uint32_t timeoutPorComandoMs = 1200);

  /**
   * Habilita o modo lógico de inventário contínuo.
   *
   * Como o firmware deste YRM1001 não permanece varrendo de forma
   * confiável após um único comando 0x27, o driver renova o comando
   * periodicamente, sem delay e sem bloquear o loop.
   */
  bool iniciarInventario(uint16_t ciclos = 0xFFFF);
  bool pararInventario(uint32_t timeoutMs = 500);

  /**
   * Define o intervalo de renovação do inventário em milissegundos.
   * Faixa permitida: 10 a 1000 ms.
   */
  void definirIntervaloInventario(uint16_t intervaloMs);
  uint16_t intervaloInventario() const;

  /**
   * Processa a UART e renova o inventário enquanto o estado
   * estiver INVENTARIANDO, sem usar delay().
   */
  void atualizar();
  void definirCallbackTag(TagCallback callback);

  Estado estado() const;
  bool pronto() const;
  bool inventariando() const;

  uint8_t regiaoConfigurada() const;
  uint16_t potenciaCentiDbm() const;

  Estatisticas estatisticas() const;
  void resetarEstatisticas();
  void mostrarStatus(Stream &saida) const;

private:
  static constexpr uint8_t FRAME_HEAD = 0xBB;
  static constexpr uint8_t FRAME_TAIL = 0x7E;
  static constexpr size_t FRAME_BUFFER_SIZE = 128;

  HardwareSerial &_serial;
  int8_t _rxPin;
  int8_t _txPin;

  Estado _estado = Estado::DESLIGADO;
  TagCallback _tagCallback = nullptr;

  uint8_t _frame[FRAME_BUFFER_SIZE]{};
  size_t _frameLen = 0;
  bool _recebendoFrame = false;

  uint8_t _regiao = 0;
  uint16_t _potenciaCentiDbm = 0;
  Estatisticas _stats{};

  uint16_t _ciclosInventario = 0xFFFF;
  uint16_t _intervaloInventarioMs = 100;
  uint32_t _ultimoComandoInventarioMs = 0;

  uint32_t _janelaEstatisticasMs = 0;
  uint16_t _inventariosNaJanela = 0;
  uint16_t _tagsNaJanela = 0;
  int32_t _somaRssiJanela = 0;

  bool _aguardandoResposta = false;
  uint8_t _comandoEsperado = 0;
  bool _respostaRecebida = false;
  bool _respostaSucesso = false;

  void enviarFrame(uint8_t tipo, uint8_t comando,
                   const uint8_t *parametros,
                   uint16_t tamanhoParametros);

  void enviarComandoBruto(
    const uint8_t *comando,
    size_t tamanho,
    uint16_t esperaMs = 0
  );

  uint8_t calcularChecksum(uint8_t tipo, uint8_t comando,
                           uint16_t tamanhoParametros,
                           const uint8_t *parametros) const;

  bool enviarEEsperarResposta(uint8_t comando,
                              const uint8_t *parametros,
                              uint16_t tamanhoParametros,
                              uint32_t timeoutMs);

  void receberBytes();
  void enviarInventarioAgora();
  void atualizarEstatisticasPorSegundo();
  void processarFrameRecebido();
  bool validarFrame() const;
  void tratarTag();
  void tratarRespostaComando();
  void tratarErroProtocolo();
  const char *nomeEstado() const;
};

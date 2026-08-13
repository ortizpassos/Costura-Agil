// ================================================================
// ALTERAÇÕES EM:
// frontend/src/app/producao/producao.ts
// ================================================================

// 1) Substitua o tipo ArtigoForm pelo seguinte:

type ArtigoForm = {
  codigo: string;
  nome: string;
  operacao: string;
  cliente: string;
  dataInclusao: string;
  valor: number | null;
  quantidade: number | null;
  status: string;
  rfidEnabled: boolean;
};

// 2) Adicione estas propriedades dentro de ProducaoComponent:

modalRFIDAberto = false;
artigoRFIDSelecionado: Artigo | null = null;
rfidCarregando = false;
rfidEtiquetasLidas = 0;
rfidQuantidade = 0;
rfidScanStatus = 'nao_aplicavel';
rfidTags: { epc: string; scannedAt?: string }[] = [];

// 3) Em cadastrarArtigo(), acrescente rfidEnabled ao objeto "artigo":

const artigo = {
  codigo: this.novoArtigo.codigo,
  nome: this.novoArtigo.nome,
  operacao: this.novoArtigo.operacao,
  cliente: this.novoArtigo.cliente,
  dataInclusao: this.novoArtigo.dataInclusao,
  valor: Number(this.novoArtigo.valor ?? 0),
  quantidade: Number(this.novoArtigo.quantidade ?? 0),
  status:
    this.artigoEditando?.status ||
    this.novoArtigo.status ||
    'pendente',

  rfidEnabled: this.novoArtigo.rfidEnabled === true
};

// 4) Dentro do next de cadastrarArtigo(), ANTES de fechar/resetar,
// guarde se o artigo é RFID:
//
// const eraNovo = !this.artigoEditando;
// const deveAbrirRFID = eraNovo && artigoSalvo.rfidEnabled === true;
//
// Depois do cadastro, se deveAbrirRFID:
//
// if (deveAbrirRFID) {
//   this.abrirModalRFID(artigoSalvo);
//   return;
// }
//
// Caso não seja RFID, mantenha o fluxo atual.

// Sugestão de implementação completa do next:
next: (artigoSalvo: Artigo) => {
  const eraNovo = !this.artigoEditando;
  const deveAbrirRFID =
    eraNovo && artigoSalvo.rfidEnabled === true;

  this.fecharModalArtigo();
  this.carregarArtigos();
  this.novoArtigo = this.criarArtigoPadrao();
  this.artigoEditando = null;

  if (deveAbrirRFID) {
    this.abrirModalRFID(artigoSalvo);
    return;
  }

  if (eraNovo) {
    const colocarEmProducao = window.confirm(
      `Artigo "${artigoSalvo.nome}" cadastrado com sucesso!\n\n` +
      `Deseja colocar este artigo em produção agora?`
    );

    if (colocarEmProducao && artigoSalvo._id) {
      this.iniciarProducaoArtigo(artigoSalvo);
    }
  }
}

// 5) Substitua criarArtigoPadrao():

private criarArtigoPadrao(): ArtigoForm {
  const hoje = new Date().toISOString().split('T')[0];

  return {
    codigo: '',
    nome: '',
    operacao: '',
    cliente: '',
    dataInclusao: hoje,
    valor: null,
    quantidade: null,
    status: 'pendente',
    rfidEnabled: false
  };
}

// 6) Em editarArtigo(), acrescente:

rfidEnabled: artigo.rfidEnabled === true

// Exemplo:
this.novoArtigo = {
  codigo: artigo.codigo,
  nome: artigo.nome,
  operacao: artigo.operacao,
  cliente: artigo.cliente,
  dataInclusao:
    artigo.dataInclusao?.substring(0, 10) ||
    new Date().toISOString().split('T')[0],
  valor: artigo.valor ?? null,
  quantidade: artigo.quantidade ?? null,
  status: artigo.status || 'pendente',
  rfidEnabled: artigo.rfidEnabled === true
};

// 7) Em reabrirProducaoArtigo(), acrescente:
rfidEnabled: artigo.rfidEnabled === true

// 8) Adicione os métodos abaixo dentro da classe:

abrirModalRFID(artigo: Artigo) {
  if (!artigo._id) return;

  this.artigoRFIDSelecionado = artigo;
  this.modalRFIDAberto = true;
  this.carregarStatusRFID();
}

fecharModalRFID() {
  this.modalRFIDAberto = false;
  this.artigoRFIDSelecionado = null;
  this.rfidEtiquetasLidas = 0;
  this.rfidQuantidade = 0;
  this.rfidScanStatus = 'nao_aplicavel';
  this.rfidTags = [];
  this.carregarArtigos();
}

carregarStatusRFID() {
  const id = this.artigoRFIDSelecionado?._id;
  if (!id) return;

  this.rfidCarregando = true;

  this.artigosService.obterStatusRFID(id).subscribe({
    next: (status) => {
      this.rfidCarregando = false;
      this.rfidEtiquetasLidas =
        status.etiquetasLidas || 0;
      this.rfidQuantidade =
        status.quantidade || 0;
      this.rfidScanStatus =
        status.rfidScanStatus || 'aguardando';
      this.rfidTags =
        status.tags || [];
    },
    error: (err) => {
      this.rfidCarregando = false;
      console.error(
        'Erro ao carregar RFID:',
        err
      );
    }
  });
}

iniciarEscaneamentoRFID() {
  const id = this.artigoRFIDSelecionado?._id;
  if (!id) return;

  const possuiLeituras =
    this.rfidEtiquetasLidas > 0;

  let preservar = false;

  if (possuiLeituras) {
    preservar = window.confirm(
      `Este artigo já possui ${this.rfidEtiquetasLidas} etiqueta(s).\n\n` +
      `OK = continuar as leituras existentes\n` +
      `Cancelar = apagar e iniciar novamente`
    );
  }

  this.rfidCarregando = true;

  this.artigosService
    .iniciarLeituraRFID(id, preservar)
    .subscribe({
      next: () => {
        this.rfidCarregando = false;
        this.carregarStatusRFID();

        alert(
          'Sessão RFID iniciada.\n\n' +
          'O dispositivo de cadastro RFID poderá agora enviar as etiquetas.'
        );
      },
      error: (err) => {
        this.rfidCarregando = false;
        console.error(err);
        alert(
          err?.error?.message ||
          'Erro ao iniciar leitura RFID.'
        );
      }
    });
}

finalizarEscaneamentoRFID() {
  const id = this.artigoRFIDSelecionado?._id;
  if (!id) return;

  this.artigosService
    .finalizarLeituraRFID(id)
    .subscribe({
      next: () => {
        this.carregarStatusRFID();
        this.carregarArtigos();
        alert('Leitura RFID concluída.');
      },
      error: (err) => {
        console.error(err);

        alert(
          err?.error?.message ||
          'Não foi possível concluir a leitura RFID.'
        );
      }
    });
}

removerTagRFID(epc: string) {
  const id = this.artigoRFIDSelecionado?._id;
  if (!id) return;

  if (!window.confirm(`Remover a etiqueta ${epc}?`)) {
    return;
  }

  this.artigosService
    .removerTagRFID(id, epc)
    .subscribe({
      next: () => this.carregarStatusRFID(),
      error: (err) => {
        console.error(err);
        alert('Erro ao remover etiqueta.');
      }
    });
}

get percentualRFID(): number {
  if (!this.rfidQuantidade) return 0;

  return Math.min(
    100,
    Math.round(
      (this.rfidEtiquetasLidas /
        this.rfidQuantidade) *
      100
    )
  );
}

formatarStatusRFID(status?: string): string {
  const mapa: Record<string, string> = {
    nao_aplicavel: 'Não aplicável',
    aguardando: 'Aguardando leitura',
    em_leitura: 'Em leitura',
    concluido: 'Concluído'
  };

  return mapa[status || 'aguardando'] ||
    'Aguardando leitura';
}

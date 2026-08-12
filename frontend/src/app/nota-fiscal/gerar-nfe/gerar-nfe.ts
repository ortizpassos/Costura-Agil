import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NfeService, NfeResponse } from '../../services/nfe.service';

interface Produto {
  codigo: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

@Component({
  selector: 'app-gerar-nfe',
  standalone: true,
  templateUrl: './gerar-nfe.html',
  styleUrls: ['./gerar-nfe.scss'],
  imports: [CommonModule, ReactiveFormsModule]
})
export class GerarNfeComponent {
  nfeForm: FormGroup;
  produtos: Produto[] = [];
  loading = false;
  successMessage = '';
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private nfeService: NfeService,
    private router: Router
  ) {
    this.nfeForm = this.fb.group({
      // Dados do Emitente
      emitenteCnpj: ['', [Validators.required, Validators.pattern(/^\d{14}$/)]],
      emitenteRazaoSocial: ['', Validators.required],
      emitenteNomeFantasia: [''],
      emitenteInscricaoEstadual: [''],
      emitenteEndereco: ['', Validators.required],
      emitenteCidade: ['', Validators.required],
      emitenteUF: ['', [Validators.required, Validators.pattern(/^[A-Z]{2}$/)]],
      emitenteCEP: ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],

      // Dados do Destinatário
      destinatarioCnpj: ['', [Validators.required, Validators.pattern(/^\d{14}$/)]],
      destinatarioRazaoSocial: ['', Validators.required],
      destinatarioEndereco: ['', Validators.required],
      destinatarioCidade: ['', Validators.required],
      destinatarioUF: ['', [Validators.required, Validators.pattern(/^[A-Z]{2}$/)]],
      destinatarioCEP: ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],

      // Dados da NFe
      numero: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
      serie: ['1', [Validators.required, Validators.pattern(/^\d+$/)]],
      dataEmissao: [new Date().toISOString().split('T')[0], Validators.required],
      naturezaOperacao: ['', Validators.required],
      tipoOperacao: ['1'], // 0=Entrada, 1=Saída
      finalidade: ['1'], // 1=Normal, 2=Complementar, 3=Ajuste, 4=Devolução
      modelo: ['55'], // 55=NFe, 65=NFCe

      // Produto atual
      produtoCodigo: ['', Validators.required],
      produtoDescricao: ['', Validators.required],
      produtoQuantidade: [1, [Validators.required, Validators.min(0.001)]],
      produtoValorUnitario: [0, [Validators.required, Validators.min(0)]],
      produtoCFOP: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
      produtoNCM: ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
      produtoCST: ['', Validators.required]
    });
  }

  adicionarProduto(): void {
    if (this.nfeForm.valid) {
      const produto: Produto = {
        codigo: this.nfeForm.value.produtoCodigo,
        descricao: this.nfeForm.value.produtoDescricao,
        quantidade: this.nfeForm.value.produtoQuantidade,
        valorUnitario: this.nfeForm.value.produtoValorUnitario,
        valorTotal: this.nfeForm.value.produtoQuantidade * this.nfeForm.value.produtoValorUnitario
      };

      this.produtos.push(produto);

      // Limpar campos do produto
      this.nfeForm.patchValue({
        produtoCodigo: '',
        produtoDescricao: '',
        produtoQuantidade: 1,
        produtoValorUnitario: 0,
        produtoCFOP: '',
        produtoNCM: '',
        produtoCST: ''
      });
    }
  }

  removerProduto(index: number): void {
    this.produtos.splice(index, 1);
  }

  calcularTotalProdutos(): number {
    return this.produtos.reduce((total, produto) => total + produto.valorTotal, 0);
  }

  gerarXML(): string {
    const formValue = this.nfeForm.value;

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<NFe xmlns="http://www.portalfiscal.inf.br/nfe">\n';
    xml += '  <infNFe versao="4.00" Id="NFe">\n';

    // Identificação da NFe
    xml += '    <ide>\n';
    xml += `      <cUF>${this.getCodigoUF(formValue.emitenteUF)}</cUF>\n`;
    xml += `      <cNF>${formValue.numero.padStart(8, '0')}</cNF>\n`;
    xml += `      <natOp>${formValue.naturezaOperacao}</natOp>\n`;
    xml += `      <mod>${formValue.modelo}</mod>\n`;
    xml += `      <serie>${formValue.serie}</serie>\n`;
    xml += `      <nNF>${formValue.numero}</nNF>\n`;
    xml += `      <dhEmi>${formValue.dataEmissao}T12:00:00-03:00</dhEmi>\n`;
    xml += `      <tpNF>${formValue.tipoOperacao}</tpNF>\n`;
    xml += `      <idDest>1</idDest>\n`;
    xml += `      <finNFe>${formValue.finalidade}</finNFe>\n`;
    xml += `      <tpImp>1</tpImp>\n`;
    xml += `      <tpEmis>1</tpEmis>\n`;
    xml += `      <cDV>0</cDV>\n`;
    xml += `      <tpAmb>2</tpAmb>\n`; // 2=Homologação
    xml += `      <procEmi>0</procEmi>\n`;
    xml += `      <verProc>1.0.0</verProc>\n`;
    xml += '    </ide>\n';

    // Emitente
    xml += '    <emit>\n';
    xml += `      <CNPJ>${formValue.emitenteCnpj}</CNPJ>\n`;
    xml += `      <xNome>${formValue.emitenteRazaoSocial}</xNome>\n`;
    if (formValue.emitenteNomeFantasia) {
      xml += `      <xFant>${formValue.emitenteNomeFantasia}</xFant>\n`;
    }
    xml += `      <enderEmit>\n`;
    xml += `        <xLgr>${formValue.emitenteEndereco}</xLgr>\n`;
    xml += `        <nro>123</nro>\n`;
    xml += `        <xBairro>Centro</xBairro>\n`;
    xml += `        <cMun>${this.getCodigoMunicipio(formValue.emitenteCidade, formValue.emitenteUF)}</cMun>\n`;
    xml += `        <xMun>${formValue.emitenteCidade}</xMun>\n`;
    xml += `        <UF>${formValue.emitenteUF}</UF>\n`;
    xml += `        <CEP>${formValue.emitenteCEP}</CEP>\n`;
    xml += `        <cPais>1058</cPais>\n`;
    xml += `        <xPais>BRASIL</xPais>\n`;
    xml += `      </enderEmit>\n`;
    if (formValue.emitenteInscricaoEstadual) {
      xml += `      <IE>${formValue.emitenteInscricaoEstadual}</IE>\n`;
    }
    xml += `      <CRT>1</CRT>\n`; // Regime tributário
    xml += '    </emit>\n';

    // Destinatário
    xml += '    <dest>\n';
    xml += `      <CNPJ>${formValue.destinatarioCnpj}</CNPJ>\n`;
    xml += `      <xNome>${formValue.destinatarioRazaoSocial}</xNome>\n`;
    xml += `      <enderDest>\n`;
    xml += `        <xLgr>${formValue.destinatarioEndereco}</xLgr>\n`;
    xml += `        <nro>456</nro>\n`;
    xml += `        <xBairro>Centro</xBairro>\n`;
    xml += `        <cMun>${this.getCodigoMunicipio(formValue.destinatarioCidade, formValue.destinatarioUF)}</cMun>\n`;
    xml += `        <xMun>${formValue.destinatarioCidade}</xMun>\n`;
    xml += `        <UF>${formValue.destinatarioUF}</UF>\n`;
    xml += `        <CEP>${formValue.destinatarioCEP}</CEP>\n`;
    xml += `        <cPais>1058</cPais>\n`;
    xml += `        <xPais>BRASIL</xPais>\n`;
    xml += `      </enderDest>\n`;
    xml += `      <indIEDest>1</indIEDest>\n`;
    xml += `      <email>destinatario@email.com</email>\n`;
    xml += '    </dest>\n';

    // Detalhes dos produtos
    this.produtos.forEach((produto, index) => {
      xml += `    <det nItem="${index + 1}">\n`;
      xml += '      <prod>\n';
      xml += `        <cProd>${produto.codigo}</cProd>\n`;
      xml += `        <cEAN></cEAN>\n`;
      xml += `        <xProd>${produto.descricao}</xProd>\n`;
      xml += `        <NCM>${formValue.produtoNCM}</NCM>\n`;
      xml += `        <CFOP>${formValue.produtoCFOP}</CFOP>\n`;
      xml += `        <uCom>UN</uCom>\n`;
      xml += `        <qCom>${produto.quantidade.toFixed(4)}</qCom>\n`;
      xml += `        <vUnCom>${produto.valorUnitario.toFixed(10)}</vUnCom>\n`;
      xml += `        <vProd>${produto.valorTotal.toFixed(2)}</vProd>\n`;
      xml += `        <cEANTrib></cEANTrib>\n`;
      xml += `        <uTrib>UN</uTrib>\n`;
      xml += `        <qTrib>${produto.quantidade.toFixed(4)}</qTrib>\n`;
      xml += `        <vUnTrib>${produto.valorUnitario.toFixed(10)}</vUnTrib>\n`;
      xml += `        <indTot>1</indTot>\n`;
      xml += '      </prod>\n';

      // Impostos (simplificado)
      xml += '      <imposto>\n';
      xml += '        <ICMS>\n';
      xml += `          <ICMS${formValue.produtoCST}>\n`;
      xml += `            <orig>0</orig>\n`;
      xml += `            <CST>${formValue.produtoCST}</CST>\n`;
      xml += `            <modBC>3</modBC>\n`;
      xml += `            <vBC>${produto.valorTotal.toFixed(2)}</vBC>\n`;
      xml += `            <pICMS>18.00</pICMS>\n`;
      xml += `            <vICMS>${(produto.valorTotal * 0.18).toFixed(2)}</vICMS>\n`;
      xml += `          </ICMS${formValue.produtoCST}>\n`;
      xml += '        </ICMS>\n';
      xml += '        <IPI>\n';
      xml += '          <IPINT>\n';
      xml += '            <CST>53</CST>\n';
      xml += '          </IPINT>\n';
      xml += '        </IPI>\n';
      xml += '        <PIS>\n';
      xml += '          <PISNT>\n';
      xml += '            <CST>04</CST>\n';
      xml += '          </PISNT>\n';
      xml += '        </PIS>\n';
      xml += '        <COFINS>\n';
      xml += '          <COFINSNT>\n';
      xml += '            <CST>04</CST>\n';
      xml += '          </COFINSNT>\n';
      xml += '        </COFINS>\n';
      xml += '      </imposto>\n';
      xml += '    </det>\n';
    });

    // Totais
    const totalProdutos = this.calcularTotalProdutos();
    const totalICMS = totalProdutos * 0.18;

    xml += '    <total>\n';
    xml += '      <ICMSTot>\n';
    xml += `        <vBC>${totalProdutos.toFixed(2)}</vBC>\n`;
    xml += `        <vICMS>${totalICMS.toFixed(2)}</vICMS>\n`;
    xml += `        <vICMSDes>0.00</vICMSDes>\n`;
    xml += `        <vBCST>0.00</vBCST>\n`;
    xml += `        <vST>0.00</vST>\n`;
    xml += `        <vProd>${totalProdutos.toFixed(2)}</vProd>\n`;
    xml += `        <vFrete>0.00</vFrete>\n`;
    xml += `        <vSeg>0.00</vSeg>\n`;
    xml += `        <vDesc>0.00</vDesc>\n`;
    xml += `        <vII>0.00</vII>\n`;
    xml += `        <vIPI>0.00</vIPI>\n`;
    xml += `        <vIPIDevol>0.00</vIPIDevol>\n`;
    xml += `        <vPIS>0.00</vPIS>\n`;
    xml += `        <vCOFINS>0.00</vCOFINS>\n`;
    xml += `        <vOutro>0.00</vOutro>\n`;
    xml += `        <vNF>${totalProdutos.toFixed(2)}</vNF>\n`;
    xml += `        <vTotTrib>${(totalICMS + totalProdutos * 0.09).toFixed(2)}</vTotTrib>\n`;
    xml += '      </ICMSTot>\n';
    xml += '    </total>\n';

    // Transporte
    xml += '    <transp>\n';
    xml += '      <modFrete>9</modFrete>\n';
    xml += '    </transp>\n';

    // Cobrança
    xml += '    <cobr>\n';
    xml += '      <fat>\n';
    xml += `        <nFat>${formValue.numero}</nFat>\n`;
    xml += `        <vOrig>${totalProdutos.toFixed(2)}</vOrig>\n`;
    xml += `        <vDesc>0.00</vDesc>\n`;
    xml += `        <vLiq>${totalProdutos.toFixed(2)}</vLiq>\n`;
    xml += '      </fat>\n';
    xml += '    </cobr>\n';

    // Informações adicionais
    xml += '    <infIntermed>\n';
    xml += '      <CNPJ>12345678000123</CNPJ>\n';
    xml += '      <idCadIntTran>123456</idCadIntTran>\n';
    xml += '    </infIntermed>\n';

    xml += '    <infAdic>\n';
    xml += '      <infCpl>Nota fiscal gerada pelo sistema Costura Ágil</infCpl>\n';
    xml += '    </infAdic>\n';

    xml += '  </infNFe>\n';
    xml += '</NFe>\n';

    return xml;
  }

  private getCodigoUF(uf: string): string {
    const ufMap: { [key: string]: string } = {
      'AC': '12', 'AL': '27', 'AP': '16', 'AM': '13', 'BA': '29', 'CE': '23',
      'DF': '53', 'ES': '32', 'GO': '52', 'MA': '21', 'MT': '51', 'MS': '50',
      'MG': '31', 'PA': '15', 'PB': '25', 'PR': '41', 'PE': '26', 'PI': '22',
      'RJ': '33', 'RN': '24', 'RS': '43', 'RO': '11', 'RR': '14', 'SC': '42',
      'SP': '35', 'SE': '28', 'TO': '17'
    };
    return ufMap[uf] || '35'; // SP por padrão
  }

  private getCodigoMunicipio(cidade: string, uf: string): string {
    // Simplificado - em produção, usar tabela completa de municípios
    const municipioMap: { [key: string]: string } = {
      'São Paulo': '3550308',
      'Rio de Janeiro': '3304557',
      'Belo Horizonte': '3106200'
    };
    return municipioMap[cidade] || '3550308'; // São Paulo por padrão
  }

  onSubmit(): void {
    if (this.nfeForm.valid && this.produtos.length > 0) {
      this.loading = true;
      this.successMessage = '';
      this.errorMessage = '';

      const xml = this.gerarXML();

      this.nfeService.gerarNfe(xml).subscribe({
        next: (response: NfeResponse) => {
          this.loading = false;
          if (response.result) {
            this.successMessage = response.result;
            // Limpar formulário após sucesso
            this.nfeForm.reset();
            this.produtos = [];
          } else if (response.error) {
            this.errorMessage = response.error;
          }
        },
        error: (error) => {
          this.loading = false;
          this.errorMessage = 'Erro ao gerar NFe: ' + (error.error?.error || error.message);
        }
      });
    } else {
      this.errorMessage = 'Preencha todos os campos obrigatórios e adicione pelo menos um produto.';
    }
  }

  voltar(): void {
    this.router.navigate(['/nota-fiscal']);
  }
}

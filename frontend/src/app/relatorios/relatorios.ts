import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../shared/sidebar/sidebar';
import { RelatoriosService } from '../services/relatorios.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-relatorios',
  standalone: true,
  templateUrl: './relatorios.html',
  styleUrls: ['./relatorios.css'],
  imports: [CommonModule, FormsModule, SidebarComponent]
})
export class RelatoriosComponent implements OnInit {
  filtroDataInicio: string = '';
  filtroDataFim: string = '';
  filtroFuncionario: string = '';
  filtroArtigo: string = '';
  relatorios: any[] = [];
  totalProducao: number = 0;
  
  // Estatísticas
  estatisticas = {
    totalProducao: 0,
    funcionariosAtivos: 0,
    artigosEmProducao: 0,
    percentualAtingido: 0
  };

  constructor(private relatoriosService: RelatoriosService) {}

  ngOnInit() {
    this.buscarRelatorios();
    this.buscarEstatisticas();
  }

  buscarRelatorios() {
    this.relatoriosService.buscarRelatorios({
      dataInicio: this.filtroDataInicio,
      dataFim: this.filtroDataFim,
      funcionario: this.filtroFuncionario,
      artigo: this.filtroArtigo
    }).subscribe({
      next: (dados) => {
        this.relatorios = dados.map(r => ({
          data: r.dia,
          funcionario: r.funcionario || '-',
          artigo: r.artigo || '-',
          artigoCodigo: r.artigoCodigo || '',
          producao: r.totalProducao || 0,
          tempoReal: this.formatarTempo(r.tempoRealArtigo || 0),
          tempoMedio: this.formatarTempoMedia(r.tempoMedioPeca || 0)
        }));
        
        this.totalProducao = this.relatorios.reduce((acc, r) => acc + (r.producao || 0), 0);
      },
      error: (err) => {
        console.error('Erro ao buscar relatórios:', err);
        this.relatorios = [];
        this.totalProducao = 0;
      }
    });
  }
  
  buscarEstatisticas() {
    this.relatoriosService.buscarEstatisticas({
      dataInicio: this.filtroDataInicio,
      dataFim: this.filtroDataFim
    }).subscribe({
      next: (dados) => {
        this.estatisticas = dados;
      },
      error: (err) => {
        console.error('Erro ao buscar estatísticas:', err);
      }
    });
  }
  
  aplicarFiltros() {
    this.buscarRelatorios();
    this.buscarEstatisticas();
  }

  formatarTempo(segundos: number): string {
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    return `${horas}h ${minutos}min`;
  }

  formatarTempoMedia(segundos: number): string {
    if (segundos < 60) {
      return `${Math.round(segundos)}s`;
    }
    const minutos = Math.floor(segundos / 60);
    const segs = Math.round(segundos % 60);
    return `${minutos}min ${segs}s`;
  }

  exportarPDF() {
    if (this.relatorios.length === 0) {
      alert('Não há dados para exportar');
      return;
    }

    const doc = new jsPDF();
    
    // Título
    doc.setFontSize(18);
    doc.setTextColor(13, 110, 253);
    doc.text('Relatório de Produção', 14, 20);
    
    // Informações do período
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    let yPos = 30;
    
    if (this.filtroDataInicio || this.filtroDataFim) {
      const periodo = `Período: ${this.filtroDataInicio ? new Date(this.filtroDataInicio).toLocaleDateString('pt-BR') : 'Início'} até ${this.filtroDataFim ? new Date(this.filtroDataFim).toLocaleDateString('pt-BR') : 'Hoje'}`;
      doc.text(periodo, 14, yPos);
      yPos += 6;
    }
    
    if (this.filtroFuncionario) {
      doc.text(`Funcionário: ${this.filtroFuncionario}`, 14, yPos);
      yPos += 6;
    }
    
    if (this.filtroArtigo) {
      doc.text(`Artigo: ${this.filtroArtigo}`, 14, yPos);
      yPos += 6;
    }
    
    // Total produzido
    doc.setFontSize(12);
    doc.setTextColor(13, 110, 253);
    doc.text(`Total Produzido no Período: ${this.totalProducao}`, 14, yPos + 6);
    
    // Tabela
    autoTable(doc, {
      startY: yPos + 14,
      head: [['Data', 'Funcionário', 'Artigo', 'Código', 'Produção', 'Tempo Total', 'Tempo Médio/Peça']],
      body: this.relatorios.map(r => [
        new Date(r.data).toLocaleDateString('pt-BR'),
        r.funcionario,
        r.artigo,
        r.artigoCodigo,
        r.producao.toString(),
        r.tempoReal,
        r.tempoMedio
      ]),
      headStyles: {
        fillColor: [13, 110, 253],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 9,
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 30 },
        2: { cellWidth: 40 },
        3: { cellWidth: 18 },
        4: { cellWidth: 18, halign: 'center', fontStyle: 'bold', textColor: [13, 110, 253] },
        5: { cellWidth: 22 },
        6: { cellWidth: 22 }
      }
    });
    
    // Rodapé
    const pageCount = (doc as any).internal.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text(
        `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
        14,
        doc.internal.pageSize.height - 10
      );
      doc.text(
        `Página ${i} de ${pageCount}`,
        doc.internal.pageSize.width - 30,
        doc.internal.pageSize.height - 10
      );
    }
    
    // Salvar PDF
    const nomeArquivo = `relatorio-producao-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(nomeArquivo);
  }
}

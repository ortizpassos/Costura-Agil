

// Removido import duplicado
import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { SidebarComponent } from '../shared/sidebar/sidebar';
import { RouterOutlet, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { DispositivosService, Dispositivo } from '../services/dispositivos';
import { HttpClient } from '@angular/common/http';
import { SocketService } from '../services/socket.service';
import { CommonModule } from '@angular/common';
import Chart from 'chart.js/auto';
import { SidebarService } from '../services/sidebar.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [SidebarComponent, RouterOutlet, CommonModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class Dashboard implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('producaoChart', { static: false }) producaoChartRef!: ElementRef<HTMLCanvasElement>;
  static formatarDataHora(data: string | Date): string {
    const dt = new Date(data);
    const dia = dt.getDate().toString().padStart(2, '0');
    const mes = (dt.getMonth() + 1).toString().padStart(2, '0');
    const ano = dt.getFullYear().toString().slice(-2);
    const hora = dt.getHours().toString().padStart(2, '0');
    const min = dt.getMinutes().toString().padStart(2, '0');
    return `${dia}/${mes}/${ano} ${hora}:${min}`;
  }
  producaoPorDia: { [key: string]: number } = {};
  chart: any;
  dispositivos: Dispositivo[] = [];
  producaoHoje: number = 0;
  online: number = 0; // dispositivos em produção
  offline: number = 0;
  alertas: any[] = [];
  dispositivosTable: any[] = [];

  private sidebarSubscription: Subscription = new Subscription();

  constructor(
    private authService: AuthService,
    private router: Router,
    private dispositivosService: DispositivosService,
  private http: HttpClient,
  private socketService: SocketService,
  private sidebarService: SidebarService
  ) {}

  ngOnInit() {
    this.sidebarSubscription = this.sidebarService.sidebarOpen$.subscribe(isOpen => {
      // Opcional: lógica adicional se necessário
    });

    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
    // Buscar dispositivos
    this.loadDispositivos();

    // Atualização em tempo real: status dos dispositivos
    this.socketService.onDeviceStatusUpdate().subscribe(() => {
      this.loadDispositivos();
    });

    // Atualização em tempo real: produção
    this.socketService.onProductionUpdate().subscribe(() => {
      this.loadProducao();
      this.loadDispositivos(); // Atualiza KPI produção do dia em tempo real
    });
    // Buscar produção do dia (caso precise de endpoint separado)
    this.loadProducao();
    // Buscar alertas (placeholder)
    this.alertas = [
      { mensagem: 'Temperatura alta', tipo: 'warning' },
      { mensagem: 'Dispositivo offline', tipo: 'danger' },
      { mensagem: 'Manutenção programada', tipo: 'info' }
    ];
  }

  loadDispositivos() {
    this.dispositivosService.listarDispositivos().subscribe((data: Dispositivo[]) => {
      this.dispositivos = data;
      // online agora representa dispositivos em produção
      this.online = data.filter(d => d.status === 'em_producao').length;
      this.offline = data.filter(d => d.status === 'offline').length;
      this.dispositivosTable = data.map(d => ({
        nome: d.nome,
        status: d.status,
        ultimaAtualizacao: d.ultimaAtualizacao ? Dashboard.formatarDataHora(d.ultimaAtualizacao) : '-'
      }));
      // Produção do dia (soma dos dispositivos) - valor real do ESP32
      this.producaoHoje = data.reduce((acc, d) => acc + (d.producaoAtual || 0), 0);
    });
  }

  loadProducao() {
    // Obter token do localStorage
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Apenas atualiza o gráfico, produção do dia já é calculada em loadDispositivos
    const apiUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:3001/api/producao'
      : 'https://monitor-ellas-backend.onrender.com/api/producao';
    this.http.get<any[]>(apiUrl, { headers }).subscribe({
      next: (producao) => {
        console.log('Dados de produção recebidos:', producao);
        if (Array.isArray(producao)) {
        // Agrupa produção por dia (últimos 7 dias)
        const dias: string[] = [];
        const hoje = new Date();
        for (let i = 6; i >= 0; i--) {
          const d = new Date(hoje);
          d.setDate(hoje.getDate() - i);
          dias.push(d.toISOString().slice(0, 10));
        }
        this.producaoPorDia = {};
        dias.forEach(d => this.producaoPorDia[d] = 0);
        producao.forEach(p => {
          const dia = (new Date(p.dataHora || p.data)).toISOString().slice(0, 10);
          if (this.producaoPorDia[dia] !== undefined) {
            this.producaoPorDia[dia] += p.quantidade || 0;
          }
        });
        console.log('producaoPorDia após processamento:', this.producaoPorDia);
        // Atualiza gráfico se já renderizado
        if (this.chart) {
          this.chart.data.labels = dias.map(d => {
            const dateObj = new Date(d + 'T12:00:00'); // Adiciona hora meio-dia para evitar problemas de timezone
            const dia = String(dateObj.getDate()).padStart(2, '0');
            const mes = String(dateObj.getMonth() + 1).padStart(2, '0');
            return `${dia}/${mes}`;
          });
          this.chart.data.datasets[0].data = dias.map(d => this.producaoPorDia[d]);
          this.chart.update();
        }
      }
      },
      error: (err) => {
        console.error('Erro ao carregar produção:', err);
      }
    });
  }

  ngAfterViewInit() {
    // Aguarda um momento para garantir que os dados foram carregados
    setTimeout(() => {
      this.initChart();
    }, 500);
  }

  initChart() {
    const ctx = this.producaoChartRef?.nativeElement;
    console.log('initChart - canvas:', ctx);
    console.log('producaoPorDia ao criar gráfico:', this.producaoPorDia);
    if (ctx) {
      const dias: string[] = [];
      const hoje = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(hoje);
        d.setDate(hoje.getDate() - i);
        dias.push(d.toISOString().slice(0, 10));
      }
      const dados = dias.map(d => this.producaoPorDia[d] || 0);
      console.log('Dias:', dias);
      console.log('Dados do gráfico:', dados);
      try {
        this.chart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: dias.map(d => {
              const dateObj = new Date(d + 'T12:00:00'); // Adiciona hora meio-dia para evitar problemas de timezone
              const dia = String(dateObj.getDate()).padStart(2, '0');
              const mes = String(dateObj.getMonth() + 1).padStart(2, '0');
              return `${dia}/${mes}`;
            }),
            datasets: [{
              label: 'Produção Total',
              data: dados,
              backgroundColor: '#0d6efd',
              borderColor: '#0d6efd',
              borderWidth: 2,
              hoverBackgroundColor: '#084298',
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: { display: false },
            },
            scales: {
              x: { grid: { display: false } },
              y: { 
                beginAtZero: true, 
                grid: { color: '#f0f4fa' },
                ticks: {
                  stepSize: 1
                }
              }
            }
          }
        });
        console.log('Chart inicializado:', this.chart);
      } catch (error) {
        console.error('Erro ao inicializar Chart:', error);
      }
    } else {
      console.error('Canvas não encontrado para o gráfico!');
    }
  }

  ngOnDestroy() {
    this.sidebarSubscription.unsubscribe();
  }
}

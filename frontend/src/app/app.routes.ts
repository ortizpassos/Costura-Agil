import { Routes } from '@angular/router';
import { authGuard } from './services/auth.guard';
import { redirectIfAuthenticatedGuard } from './services/redirect-home.guard';
import { AdminGuard } from './services/admin.guard';

export const routes: Routes = [
		{
			path: 'financeiro',
			canActivate: [authGuard],
			loadComponent: () => import('./financeiro/financeiro').then(m => m.Financeiro)
		},
		{
			path: 'nota-fiscal',
			canActivate: [authGuard],
			children: [
				{
					path: '',
					loadComponent: () => import('./nota-fiscal/nota-fiscal').then(m => m.NotaFiscal)
				},
				{
					path: 'gerar',
					loadComponent: () => import('./nota-fiscal/gerar-nfe/gerar-nfe').then(m => m.GerarNfeComponent)
				},
				{
					path: 'consultar',
					loadComponent: () => import('./nota-fiscal/consultar-nfe/consultar-nfe').then(m => m.ConsultarNfeComponent)
				}
			]
		},
	{
		path: '',
		canActivate: [redirectIfAuthenticatedGuard],
		loadChildren: () => import('./home/home-module').then(m => m.HomeModule)
	},
	{
		path: 'login',
		loadChildren: () => import('./login/login-module').then(m => m.LoginModule)
	},
	{
		path: 'cadastro',
		loadChildren: () => import('./cadastro/cadastro-module').then(m => m.CadastroModule)
	},
	{
		path: 'funcionarios',
		canActivate: [authGuard],
		loadChildren: () => import('./funcionarios/funcionarios-module').then(m => m.FuncionariosModule)
	},
	{
		path: 'dispositivos',
		canActivate: [authGuard],
		loadChildren: () => import('./dispositivos/dispositivos-module').then(m => m.DispositivosModule)
	},
	{
		path: 'dashboard',
		canActivate: [authGuard],
		loadChildren: () => import('./dashboard/dashboard-module').then(m => m.DashboardModule)    
	},
	{
		path: 'producao',
		canActivate: [authGuard],
		loadComponent: () => import('./producao/producao').then(m => m.ProducaoComponent)
	},
	{
		path: 'relatorios',
		canActivate: [authGuard],
		loadComponent: () => import('./relatorios/relatorios').then(m => m.RelatoriosComponent)
	},
	{
		path: 'display',
		canActivate: [authGuard],
		loadComponent: () => import('./display/display').then(m => m.DisplayComponent)
	},
	{
		path: 'admin',
		canActivate: [AdminGuard],
		loadComponent: () => import('./admin/admin').then(m => m.Admin)
	},
	{
		path: 'configuracoes',
		canActivate: [authGuard],
		loadChildren: () => import('./configuracoes/configuracoes-module').then(m => m.ConfiguracoesModule)
	},
	{
		path: 'sobre',
		loadComponent: () => import('./sobre/sobre').then(m => m.SobreComponent)
	},
	{
		path: 'servicos',
		loadComponent: () => import('./servicos/servicos').then(m => m.ServicosComponent)
	}
];

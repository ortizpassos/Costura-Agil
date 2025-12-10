import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./configuracoes').then(m => m.Configuracoes)
  }
];
import { Routes } from '@angular/router';
import { DispositivosList } from './dispositivos-list/dispositivos-list';
import { DispositivosForm } from './dispositivos-form/dispositivos-form';

export const routes: Routes = [
  { path: '', component: DispositivosList },
  { path: 'novo', component: DispositivosForm }
];

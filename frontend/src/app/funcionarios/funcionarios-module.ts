import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { routes } from './funcionarios.routes';

@NgModule({
  imports: [
    CommonModule,
    RouterModule.forChild(routes)
  ]
})
export class FuncionariosModule { }

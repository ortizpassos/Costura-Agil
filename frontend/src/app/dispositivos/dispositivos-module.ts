import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { routes } from './dispositivos.routes';

@NgModule({
  imports: [
    CommonModule,
    RouterModule.forChild(routes)
  ]
})
export class DispositivosModule { }

import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CADASTRO_ROUTES } from './cadastro.routes';
import { CadastroComponent } from './cadastro';

@NgModule({
  imports: [
  RouterModule.forChild(CADASTRO_ROUTES)
  ]
})
export class CadastroModule {}

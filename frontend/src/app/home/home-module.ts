import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { routes } from './home.routes';

@NgModule({
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    HttpClientModule
  ]
})
export class HomeModule {}

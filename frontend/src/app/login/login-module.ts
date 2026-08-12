import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LOGIN_ROUTES } from './login.routes';
import { HttpClientModule } from '@angular/common/http';


@NgModule({
  imports: [
    RouterModule.forChild(LOGIN_ROUTES),
    HttpClientModule
  ]
})
export class LoginModule {}

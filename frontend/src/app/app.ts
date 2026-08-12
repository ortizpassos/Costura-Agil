import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { NavbarComponent } from "./shared/navbar/navbar";
import { FooterComponent } from "./shared/footer/footer";
import { ProducaoComponent } from './producao/producao';



@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HttpClientModule, NavbarComponent, FooterComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App {
  protected readonly title = signal('production-monitor-frontend-angular');
}

import { Component } from '@angular/core';
import { SidebarComponent } from '../shared/sidebar/sidebar';
import { FooterComponent } from '../shared/footer/footer';
import { OverviewComponent } from "../overview/overview";

@Component({
  selector: 'app-financeiro',
  standalone: true,
  templateUrl: './financeiro.html',
  styleUrls: ['./financeiro.css'],
  imports: [SidebarComponent, OverviewComponent]
})
export class Financeiro {}

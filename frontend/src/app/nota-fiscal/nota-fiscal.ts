import { Component } from '@angular/core';
import { SidebarComponent } from '../shared/sidebar/sidebar';


@Component({
  selector: 'app-nota-fiscal',
  standalone: true,
  templateUrl: './nota-fiscal.html',
  styleUrls: ['./nota-fiscal.css'],
  imports: [SidebarComponent]
})
export class NotaFiscal {}

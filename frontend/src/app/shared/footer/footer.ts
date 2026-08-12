import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  standalone: true,
  templateUrl: './footer.html',
  styles: [
    `.app-footer { background: #f8f9fa; border-top: 1px solid rgba(0,0,0,0.05); color: #6c757d; } .app-footer .container { max-width: 1100px; } .app-footer a { color: inherit; }`
  ],
  imports: [],
})
export class FooterComponent {}

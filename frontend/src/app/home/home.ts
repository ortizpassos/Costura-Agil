import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { NavbarComponent } from '../shared/navbar/navbar';
import { FooterComponent } from '../shared/footer/footer';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class Home {
  // keep references to standalone components so Angular recognizes them as used
  // (they are declared in template via selectors)
  private _navbar = NavbarComponent;
  private _footer = FooterComponent;

  constructor(private router: Router) {}

  irParaLogin() {
    this.router.navigate(['/login']);
  }

  irParaCadastro() {
    this.router.navigate(['/cadastro']);
  }

  enviarWhatsApp(event: Event) {
    event.preventDefault();
  const nome = (document.getElementById('nome') as HTMLInputElement)?.value || '';
  const mensagem = (document.getElementById('mensagem') as HTMLTextAreaElement)?.value || '';
  const texto = `Olá, me chamo ${nome}. ${mensagem}`;
    const url = `https://wa.me/5547999876298?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  }
}






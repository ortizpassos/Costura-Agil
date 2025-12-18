// Função para mostrar/ocultar seções
function showSection(sectionId) {
  // Ocultar todas as seções
  const sections = document.querySelectorAll('section');
  sections.forEach(section => {
    section.classList.add('d-none');
  });

  // Mostrar a seção selecionada
  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.classList.remove('d-none');
  }

  // Atualizar o menu ativo - remover classe active de todos os links
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.classList.remove('active');
  });

  // Adicionar classe active ao link selecionado
  const activeLink = document.getElementById('nav-' + sectionId);
  if (activeLink) {
    activeLink.classList.add('active');
  }
}

// Inicializar mostrando o dashboard por padrão
document.addEventListener('DOMContentLoaded', function() {
  showSection('dashboard');
});

// Função para mostrar modal de desenvolvimento
function showDesenvolvimentoModal(event) {
  // Prevenir comportamento padrão se event existir
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  
  const modal = document.getElementById('desenvolvimentoModal');
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Prevenir scroll do body
  }
  return false; // Prevenir propagação do evento
}

// Função para esconder modal de desenvolvimento
function hideDesenvolvimentoModal() {
  const modal = document.getElementById('desenvolvimentoModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto'; // Restaurar scroll do body
  }
}

// Fechar modal ao clicar no overlay
document.addEventListener('DOMContentLoaded', function() {
  const modal = document.getElementById('desenvolvimentoModal');
  if (modal) {
    modal.addEventListener('click', function(event) {
      if (event.target === modal) {
        hideDesenvolvimentoModal();
      }
    });
  }
  
  // Fechar modal com tecla ESC
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
      hideDesenvolvimentoModal();
    }
  });
});
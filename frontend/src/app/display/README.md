# Página Display - Monitor de Produção em Tempo Real

## 📺 Visão Geral
Página full-screen otimizada para exibição em monitores/TVs na fábrica, mostrando em tempo real:
- Status de todos os dispositivos
- Funcionários ativos
- Produção atual de cada dispositivo
- Última atualização

## 🎯 Características

### Visual Profissional
- Gradiente roxo/azul moderno
- Cards com glassmorphism
- Animações suaves e pulsantes
- Design responsivo

### Dados em Tempo Real
- Atualização automática via Socket.IO
- Data/hora ao vivo (atualiza a cada segundo)
- KPIs dinâmicos:
  - Total produzido hoje
  - Dispositivos ativos vs total
  
### Tabela de Produção
- **Dispositivo**: Nome e token
- **Funcionário**: Quem está operando
- **Status**: Online, Produzindo, Ocioso, Offline (com cores)
- **Produção Atual**: Valor destacado
- **Última Atualização**: Horário preciso

### Status Visuais
- 🟢 **Online**: Verde
- 🔵 **Produzindo**: Azul (com animação pulsante)
- 🟠 **Ocioso**: Laranja
- 🔴 **Offline**: Vermelho

## 🚀 Como Usar

### Acesso
Navegue para `/display` ou clique no botão "Display" (📺) na sidebar.

### Modo Full Screen
Para exibir em monitor/TV:
1. Pressione **F11** no navegador para tela cheia
2. Ou clique com botão direito > "Tela cheia"

### Atualização Automática
- Dispositivos são recarregados a cada 5 minutos
- Socket.IO atualiza em tempo real quando há mudanças
- Data/hora atualiza a cada segundo

## 🎨 Responsividade
- **Desktop**: Layout completo com 2 KPIs lado a lado
- **Tablet**: Layout adaptado
- **Mobile**: Layout em coluna única

## 🔧 Configuração
Certifique-se de que:
- Backend está rodando (Socket.IO ativo)
- Usuário está autenticado
- Dispositivos estão cadastrados

## 📝 Notas
- Página ideal para ser deixada aberta em monitor dedicado
- Não possui sidebar para maximizar espaço
- Atualiza automaticamente sem necessidade de refresh

# Sistema de Mensageria NFe com RabbitMQ

Este documento explica como usar a comunicação assíncrona entre o backend Node.js e o serviço Java NFe através do RabbitMQ.

## 🏗️ Arquitetura

```
Backend Node.js ──RabbitMQ──> Serviço Java NFe
      │                           │
      └─ Request Queue            └─ Consome mensagens
      ┌─ Response Queue ──────────┐
      │                           │
      └─ Processa respostas       └─ Produz respostas
```

## 🚀 Como Usar

### 1. Iniciar RabbitMQ

```bash
# Usando Docker Compose
docker-compose up -d rabbitmq

# Ou instalar localmente
# Windows: chocolatey install rabbitmq
# Linux/Mac: brew install rabbitmq
```

### 2. Iniciar Serviços

```bash
# Terminal 1: Serviço Java NFe
cd java-nfe-service
mvn spring-boot:run

# Terminal 2: Backend Node.js
cd backend
npm start
```

### 3. Testar Comunicação

```bash
# Executar testes de mensageria
cd backend
node test/nfe-messaging-test.js
```

## 📡 APIs Disponíveis

### Status do Serviço SEFAZ
```http
GET /api/nfe/status
```

### Gerar NFe
```http
POST /api/nfe/gerar
Content-Type: application/json

{
  "xml": "<nfe>XML da NFe aqui</nfe>"
}
```

### Consultar NFe
```http
POST /api/nfe/consultar
Content-Type: application/json

{
  "chave": "12345678901234567890123456789012345678901234"
}
```

### Cancelar NFe
```http
POST /api/nfe/cancelar
Content-Type: application/json

{
  "chave": "12345678901234567890123456789012345678901234",
  "justificativa": "Motivo do cancelamento"
}
```

### Carta de Correção Eletrônica
```http
POST /api/nfe/cce
Content-Type: application/json

{
  "chave": "12345678901234567890123456789012345678901234",
  "correcao": "Texto da correção"
}
```

## 🔧 Configuração

### RabbitMQ (application.properties)
```properties
spring.rabbitmq.host=localhost
spring.rabbitmq.port=5672
spring.rabbitmq.username=guest
spring.rabbitmq.password=guest

nfe.queue.request=nfe.request.queue
nfe.queue.response=nfe.response.queue
nfe.exchange=nfe.exchange
```

### Docker Compose
```yaml
version: '3.8'
services:
  rabbitmq:
    image: rabbitmq:3-management-alpine
    ports:
      - "5672:5672"   # AMQP
      - "15672:15672" # Management UI
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest
```

## 📋 Estrutura das Mensagens

### Requisição
```json
{
  "operation": "status|gerar|consultar|cancelar|cce",
  "correlationId": "uuid-v4",
  "timestamp": "2025-12-17T02:00:00.000Z",
  "xml": "...",           // apenas para gerar
  "chave": "...",         // para consultar/cancelar/cce
  "justificativa": "...", // apenas para cancelar
  "correcao": "..."       // apenas para cce
}
```

### Resposta
```json
{
  "success": true|false,
  "message": "Mensagem de sucesso",  // quando success=true
  "error": "Mensagem de erro"        // quando success=false
}
```

## 🧪 Testes

### Teste Manual via API
```bash
# Status
curl -X GET http://localhost:3001/api/nfe/status

# Gerar NFe
curl -X POST http://localhost:3001/api/nfe/gerar \
  -H "Content-Type: application/json" \
  -d '{"xml":"<nfe>test</nfe>"}'
```

### Teste Automatizado
```bash
cd backend
node test/nfe-messaging-test.js
```

## 🔍 Monitoramento

### RabbitMQ Management UI
- URL: http://localhost:15672
- Usuário: guest
- Senha: guest

### Logs
- Backend: Verificar console do Node.js
- Java Service: Verificar logs do Spring Boot

## 🚨 Troubleshooting

### Erro de Conexão RabbitMQ
```
✅ Verificar se RabbitMQ está rodando
✅ Verificar credenciais no application.properties
✅ Verificar portas (5672 para AMQP)
```

### Mensagens não Processadas
```
✅ Verificar se filas existem no Management UI
✅ Verificar bindings entre exchange e filas
✅ Verificar logs dos consumidores
```

### Timeout nas Requisições
```
✅ Aumentar timeout no NfeMessagingService
✅ Verificar se serviço Java está respondendo
✅ Verificar conectividade de rede
```

## 🔄 Próximos Passos

1. **Implementar Autenticação**: Adicionar JWT nas mensagens
2. **Retry Policy**: Implementar retentativas automáticas
3. **Dead Letter Queue**: Para mensagens não processadas
4. **Monitoramento**: Métricas e alertas
5. **Load Balancing**: Múltiplas instâncias do serviço Java

## 📚 Referências

- [RabbitMQ Documentation](https://www.rabbitmq.com/documentation.html)
- [Spring AMQP](https://docs.spring.io/spring-amqp/docs/current/reference/html/)
- [AMQP 0-9-1 Protocol](https://www.rabbitmq.com/amqp-0-9-1-reference.html)
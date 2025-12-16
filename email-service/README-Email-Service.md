# Email Service - Costura Ágil

Este serviço é responsável pelo envio de e-mails automáticos no sistema Costura Ágil, como confirmação de cadastro, verificação de e-mail e notificações de produção.

## Objetivo
Centralizar e desacoplar o envio de e-mails do backend principal, permitindo escalabilidade e manutenção independente.

## Tecnologias Utilizadas
- Java 17
- Spring Boot
- Spring Mail
- RabbitMQ (opcional, para mensageria)
- Docker (opcional)

## Como funciona
- O backend publica eventos de e-mail (ex: verificação de conta) em uma fila (RabbitMQ ou HTTP).
- O email-service consome esses eventos, monta e envia o e-mail para o destinatário.
- Suporta templates de e-mail e variáveis dinâmicas.

## Configuração
- Configure as credenciais SMTP em `src/main/resources/application.yml`:

```yaml
spring:
    mail:
    host: smtp.seuprovedor.com
    port: 587
    username: seu_usuario
    password: sua_senha
    properties:
    mail:
    smtp:
    auth: true
    starttls:
    enable: true
```

- Ajuste o remetente e templates conforme necessário.

## Como rodar
1. Instale Java 17 e Maven.
2. Compile o projeto:
   ```powershell
   mvn clean package -DskipTests
   ```
3. Execute o serviço:
   ```powershell
   java -jar target/email-service-0.0.1.jar
   ```

## Integração
- O backend envia eventos de e-mail para o email-service via RabbitMQ ou HTTP.
- O email-service envia o e-mail e pode retornar status de sucesso/erro.

## Testando
- Use ferramentas como Mailtrap ou Ethereal para testes sem enviar e-mails reais.
- Verifique os logs para status de envio.

---
Para dúvidas ou sugestões, consulte o repositório principal 
package com.monitorellas.mq;

import com.monitorellas.mail.MailService;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class EmailListener {

    private final MailService mailService;

    @Value("${spring.application.name}")
    private String appName;

    public EmailListener(MailService mailService) {
        this.mailService = mailService;
    }

    @RabbitListener(queues = "${app.mq.queue}")
    public void onOperacaoCreated(@Payload Map<String, Object> payload) {
        String type = (String) payload.get("type");
        if (type == null) return;
        switch (type) {
            case "email.verificacao" -> handleEmailVerificacao(payload);
            default -> {
            }
        }
    }

    private void handleEmailVerificacao(Map<String, Object> payload) {
        String to = (String) payload.get("usuarioEmail");
        if (to == null || to.isBlank()) return;
        String codigo = (String) payload.get("codigo");
        String expiresAt = (String) payload.get("expiresAt");
        String subject = "[" + appName + "] Verificação de e-mail";
        String body = "Olá,\n\n" +
                "Recebemos seu cadastro. Para ativar sua conta, utilize o código abaixo:\n\n" +
                "Código: " + codigo + "\n\n" +
                "Este código expira em: " + expiresAt + " (30 minutos).\n" +
                "Se você não solicitou este cadastro, ignore este e-mail.\n\n" +
                "Equipe " + appName + "\n";
        mailService.send(to, subject, body);
    }
}

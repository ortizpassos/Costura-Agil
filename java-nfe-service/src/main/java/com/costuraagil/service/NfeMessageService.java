package com.costuraagil.service;

import com.costuraagil.nfe.NfeClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class NfeMessageService {

    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;
    private final NfeClient nfeClient;

    @Value("${nfe.exchange}")
    private String exchangeName;

    public NfeMessageService(RabbitTemplate rabbitTemplate, ObjectMapper objectMapper, NfeClient nfeClient) {
        this.rabbitTemplate = rabbitTemplate;
        this.objectMapper = objectMapper;
        this.nfeClient = nfeClient;
    }

    @RabbitListener(queues = "${nfe.queue.request}")
    public void handleNfeRequest(String message) {
        try {
            JsonNode request = objectMapper.readTree(message);
            String operation = request.get("operation").asText();
            String correlationId = request.get("correlationId").asText();

            String response = processNfeOperation(operation, request);

            // Enviar resposta de volta
            rabbitTemplate.convertAndSend(exchangeName, "nfe.response", response,
                messagePostProcessor -> {
                    messagePostProcessor.getMessageProperties().setCorrelationId(correlationId);
                    return messagePostProcessor;
                });

        } catch (Exception e) {
            System.err.println("Erro ao processar mensagem NFe: " + e.getMessage());
        }
    }

    private String processNfeOperation(String operation, JsonNode request) {
        try {
            switch (operation.toLowerCase()) {
                case "status":
                    String statusXml = nfeClient.statusServico();
                    return createSuccessResponse(statusXml);
                case "gerar":
                    return processGerarRequest(request);
                case "consultar":
                    return processConsultarRequest(request);
                case "cancelar":
                    return processCancelarRequest(request);
                case "cce":
                    return processCceRequest(request);
                default:
                    return createErrorResponse("Operação não suportada: " + operation);
            }
        } catch (Exception e) {
            return createErrorResponse("Erro interno: " + e.getMessage());
        }
    }

    private String processGerarRequest(JsonNode request) {
        String xml = request.get("xml").asText();
        if (xml == null || xml.trim().isEmpty()) {
            return createErrorResponse("XML da NFe é obrigatório");
        }

        try {
            String retornoXml = nfeClient.enviarNfe(xml);
            return createSuccessResponse(retornoXml);
        } catch (Exception e) {
            return createErrorResponse("Erro ao enviar NFe: " + e.getMessage());
        }
    }

    private String processConsultarRequest(JsonNode request) {
        String chave = request.get("chave").asText();
        if (chave == null || chave.length() != 44) {
            return createErrorResponse("Chave de acesso deve ter 44 caracteres");
        }

        try {
            String retornoXml = nfeClient.consultar(chave);
            return createSuccessResponse(retornoXml);
        } catch (Exception e) {
            return createErrorResponse("Erro ao consultar NFe: " + e.getMessage());
        }
    }

    private String processCancelarRequest(JsonNode request) {
        String chave = request.get("chave").asText();
        String justificativa = request.get("justificativa").asText();

        if (chave == null || chave.length() != 44) {
            return createErrorResponse("Chave de acesso deve ter 44 caracteres");
        }

        if (justificativa == null || justificativa.length() < 15) {
            return createErrorResponse("Justificativa deve ter pelo menos 15 caracteres");
        }

        try {
            String retornoXml = nfeClient.cancelar(chave, justificativa);
            return createSuccessResponse(retornoXml);
        } catch (Exception e) {
            return createErrorResponse("Erro ao cancelar NFe: " + e.getMessage());
        }
    }

    private String processCceRequest(JsonNode request) {
        String chave = request.get("chave").asText();
        String correcao = request.get("correcao").asText();

        if (chave == null || chave.length() != 44) {
            return createErrorResponse("Chave de acesso deve ter 44 caracteres");
        }

        try {
            String retornoXml = nfeClient.enviarCce(chave, correcao);
            return createSuccessResponse(retornoXml);
        } catch (Exception e) {
            return createErrorResponse("Erro ao enviar CC-e: " + e.getMessage());
        }
    }

    private String createSuccessResponse(String message) {
        return "{\"success\": true, \"message\": \"" + message + "\"}";
    }

    private String createErrorResponse(String error) {
        return "{\"success\": false, \"error\": \"" + error + "\"}";
    }
}
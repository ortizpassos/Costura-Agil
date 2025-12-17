package com.costuraagil.service;

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

    @Value("${nfe.exchange}")
    private String exchangeName;

    public NfeMessageService(RabbitTemplate rabbitTemplate, ObjectMapper objectMapper) {
        this.rabbitTemplate = rabbitTemplate;
        this.objectMapper = objectMapper;
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
                    return processStatusRequest();
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

    private String processStatusRequest() {
        // Simulação de consulta de status do serviço SEFAZ em homologação
        return createSuccessResponse("Status do serviço SEFAZ Homologação: Serviço em Operação");
    }

    private String processGerarRequest(JsonNode request) {
        String xml = request.get("xml").asText();
        if (xml == null || xml.trim().isEmpty()) {
            return createErrorResponse("XML da NFe é obrigatório");
        }

        // Simular processamento
        String numeroRecibo = "123456789012345"; // Simulado
        return createSuccessResponse("NFe enviada para homologação com sucesso. Recibo: " + numeroRecibo);
    }

    private String processConsultarRequest(JsonNode request) {
        String chave = request.get("chave").asText();
        if (chave == null || chave.length() != 44) {
            return createErrorResponse("Chave de acesso deve ter 44 caracteres");
        }

        // Simular resposta
        String respostaXml = "<retConsSitNFe><infProt><chNFe>" + chave + "</chNFe><nProt>123456789012345</nProt><digVal>ABC123</digVal></infProt></retConsSitNFe>";
        return createSuccessResponse("Consulta realizada em homologação: " + respostaXml);
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

        return createSuccessResponse("NFe cancelada em homologação com sucesso. Chave: " + chave);
    }

    private String processCceRequest(JsonNode request) {
        String chave = request.get("chave").asText();
        String correcao = request.get("correcao").asText();

        if (chave == null || chave.length() != 44) {
            return createErrorResponse("Chave de acesso deve ter 44 caracteres");
        }

        return createSuccessResponse("CC-e enviada para homologação com sucesso. Chave: " + chave);
    }

    private String createSuccessResponse(String message) {
        return "{\"success\": true, \"message\": \"" + message + "\"}";
    }

    private String createErrorResponse(String error) {
        return "{\"success\": false, \"error\": \"" + error + "\"}";
    }
}
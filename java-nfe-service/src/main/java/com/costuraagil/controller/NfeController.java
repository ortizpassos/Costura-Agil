package com.costuraagil.controller;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Autowired;
import com.costuraagil.nfe.NfeClient;
import java.util.*;

@RestController
@RequestMapping("/api/nfe")
public class NfeController {

    @Autowired
    private NfeClient nfeClient;

    @GetMapping("/status")
    public ResponseEntity<String> getStatus() {
        try {
            String status = nfeClient.statusServico();
            return ResponseEntity.ok("Status do serviço SEFAZ: " + status);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Erro ao consultar status: " + e.getMessage());
        }
    }

    @PostMapping("/gerar")
    public ResponseEntity<String> gerarNfe(@RequestBody String xml) {
        try {
            if (xml == null || xml.trim().isEmpty()) {
                return ResponseEntity.badRequest().body("XML da NFe é obrigatório");
            }

            String retorno = nfeClient.enviarNfe(xml);
            return ResponseEntity.ok("NFe enviada com sucesso: " + retorno);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Erro ao gerar NFe: " + e.getMessage());
        }
    }

    @PostMapping("/consultar")
    public ResponseEntity<String> consultarNfe(@RequestParam String chave) {
        try {
            if (chave == null || chave.length() != 44) {
                return ResponseEntity.badRequest().body("Chave de acesso deve ter 44 caracteres");
            }

            String retorno = nfeClient.consultar(chave);
            return ResponseEntity.ok("Consulta realizada: " + retorno);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Erro ao consultar NFe: " + e.getMessage());
        }
    }

    @PostMapping("/cancelar")
    public ResponseEntity<String> cancelarNfe(@RequestParam String chave, @RequestParam String justificativa) {
        try {
            if (chave == null || chave.length() != 44) {
                return ResponseEntity.badRequest().body("Chave de acesso deve ter 44 caracteres");
            }

            if (justificativa == null || justificativa.length() < 15) {
                return ResponseEntity.badRequest().body("Justificativa deve ter pelo menos 15 caracteres");
            }

            String retorno = nfeClient.cancelar(chave, justificativa);
            return ResponseEntity.ok("NFe cancelada com sucesso: " + retorno);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Erro ao cancelar NFe: " + e.getMessage());
        }
    }

    @PostMapping("/cce")
    public ResponseEntity<String> cartaCorrecao(@RequestParam String chave, @RequestParam String correcao) {
        try {
            if (chave == null || chave.length() != 44) {
                return ResponseEntity.badRequest().body("Chave de acesso deve ter 44 caracteres");
            }

            String retorno = nfeClient.enviarCce(chave, correcao);
            return ResponseEntity.ok("CC-e enviada com sucesso: " + retorno);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Erro ao enviar CC-e: " + e.getMessage());
        }
    }

    @GetMapping("/recebidas")
    public ResponseEntity<String> consultarNotasRecebidas(@RequestParam String cnpj,
                                                         @RequestParam(required = false) String dataInicio,
                                                         @RequestParam(required = false) String dataFim) {
        try {
            // Simulação de consulta de notas fiscais recebidas em homologação
            // Em produção: isso consultaria o webservice de distribuição DFe
            // String retorno = NfeDistribuicaoDFe.consultaNFeDest(config, cnpj, AmbienteEnum.HOMOLOGACAO);

            if (cnpj == null || cnpj.length() != 14) {
                return ResponseEntity.badRequest().body("CNPJ deve ter 14 caracteres");
            }

            // Dados simulados baseados nos arquivos XML de exemplo
            List<Map<String, Object>> notas = new ArrayList<>();

            // Nota 1: baseada no arquivo Nfe42251210787210000125550010005589381170411109.xml
            Map<String, Object> nota1 = new HashMap<>();
            nota1.put("chave", "42251210787210000125550010005589381170411109");
            nota1.put("numero", "558938");
            nota1.put("serie", "1");
            nota1.put("dataEmissao", "2025-12-11T07:08:38-03:00");
            nota1.put("emitente", "LAPIN INDUSTRIA TEXTIL LTDA");
            nota1.put("valorTotal", 2240.00);
            nota1.put("status", "Autorizada");
            notas.add(nota1);

            // Nota 2: baseada no arquivo Nfe42251210787210000125550010005587011982664531 (1).xml
            Map<String, Object> nota2 = new HashMap<>();
            nota2.put("chave", "42251210787210000125550010005587011982664531");
            nota2.put("numero", "558701");
            nota2.put("serie", "1");
            nota2.put("dataEmissao", "2025-12-10T08:15:22-03:00");
            nota2.put("emitente", "FORNECEDOR EXEMPLO S.A.");
            nota2.put("valorTotal", 1850.00);
            nota2.put("status", "Autorizada");
            notas.add(nota2);

            // Nota 3: outra nota de exemplo
            Map<String, Object> nota3 = new HashMap<>();
            nota3.put("chave", "42251210787210000125550010005587021982664532");
            nota3.put("numero", "558702");
            nota3.put("serie", "1");
            nota3.put("dataEmissao", "2025-12-09T14:30:15-03:00");
            nota3.put("emitente", "MATERIAL TEXTIL DISTRIBUIDORA");
            nota3.put("valorTotal", 3200.00);
            nota3.put("status", "Autorizada");
            notas.add(nota3);

            // Se datas foram fornecidas, filtrar os resultados
            if (dataInicio != null && !dataInicio.isEmpty() && dataFim != null && !dataFim.isEmpty()) {
                try {
                    // Parse das datas
                    java.time.LocalDate inicio = java.time.LocalDate.parse(dataInicio);
                    java.time.LocalDate fim = java.time.LocalDate.parse(dataFim);

                    // Filtrar notas por data
                    List<Map<String, Object>> notasFiltradas = new ArrayList<>();
                    for (Map<String, Object> nota : notas) {
                        String dataEmissaoStr = (String) nota.get("dataEmissao");
                        if (dataEmissaoStr != null && !dataEmissaoStr.isEmpty()) {
                            try {
                                // Extrair apenas a data (YYYY-MM-DD) da string
                                String dataOnly = dataEmissaoStr.split("T")[0];
                                java.time.LocalDate dataEmissao = java.time.LocalDate.parse(dataOnly);
                                if (!dataEmissao.isBefore(inicio) && !dataEmissao.isAfter(fim)) {
                                    notasFiltradas.add(nota);
                                }
                            } catch (Exception e) {
                                // Se não conseguir parsear a data, incluir a nota
                                notasFiltradas.add(nota);
                            }
                        }
                    }
                    notas = notasFiltradas;
                } catch (Exception e) {
                    System.err.println("Erro ao filtrar por data: " + e.getMessage());
                }
            }

            // Converter para JSON
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            String respostaJson = mapper.writeValueAsString(notas);

            return ResponseEntity.ok(respostaJson);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Erro ao consultar notas recebidas: " + e.getMessage());
        }
    }
}
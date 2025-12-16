package com.example.javanfespringboot;

import br.com.swconsultoria.nfe.exception.NfeException;
import br.com.swconsultoria.nfe.schema_4.retConsStatServ.TRetConsStatServ;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/nfe")
public class NfeController {

    private final NfeService nfeService;

    public NfeController(NfeService nfeService) {
        this.nfeService = nfeService;
    }

    @GetMapping("/status-servico")
    public ResponseEntity<?> getStatusServico() {
        try {
            TRetConsStatServ retorno = nfeService.consultarStatusServico();
            
            String status = String.format("Status da SEFAZ: %s - %s", retorno.getCStat(), retorno.getXMotivo());
            
            return ResponseEntity.ok(status);
        } catch (NfeException e) {
            return ResponseEntity.internalServerError().body("Erro ao consultar status do serviço: " + e.getMessage());
        }
    }
}

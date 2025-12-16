package com.example.javanfespringboot;

import br.com.swconsultoria.nfe.dom.ConfiguracoesNfe;
import br.com.swconsultoria.nfe.dom.enuns.ServicosEnum;
import br.com.swconsultoria.nfe.exception.NfeException;
import br.com.swconsultoria.nfe.schema_4.retConsStatServ.TRetConsStatServ;
import br.com.swconsultoria.nfe.util.StatusServicoUtil;
import org.springframework.stereotype.Service;

@Service
public class NfeService {

    private final ConfiguracoesNfe configuracoesNfe;

    public NfeService(ConfiguracoesNfe configuracoesNfe) {
        this.configuracoesNfe = configuracoesNfe;
    }

    /**
     * Consulta o status do serviço da SEFAZ.
     * @return TRetConsStatServ objeto com o retorno da consulta.
     * @throws NfeException se ocorrer um erro na comunicação.
     */
    public TRetConsStatServ consultarStatusServico() throws NfeException {
        // O método statusServico utiliza as configurações injetadas
        return StatusServicoUtil.statusServico(configuracoesNfe, ServicosEnum.NFE);
    }
}

package com.costuraagil.nfe;

import br.com.swconsultoria.nfe.Nfe;
import br.com.swconsultoria.nfe.dom.ConfiguracoesNfe;
import br.com.swconsultoria.nfe.schema_4.enviNFe.TEnviNFe;
import br.com.swconsultoria.nfe.schema_4.retConsSitNFe.TRetConsSitNFe;
import br.com.swconsultoria.nfe.schema_4.retConsStatServ.TRetConsStatServ;
import br.com.swconsultoria.nfe.schema_4.retEnviNFe.TRetEnviNFe;
import br.com.swconsultoria.nfe.util.ConstantesUtil;
import br.com.swconsultoria.nfe.util.XmlNfeUtil;
import org.springframework.stereotype.Component;

import java.io.FileInputStream;
import java.security.KeyStore;

@Component
public class SefazNfeClient implements NfeClient {

    private final ConfiguracoesNfe config;

    public SefazNfeClient(NfeProperties props) throws Exception {
        // Carregar keystore
        KeyStore keyStore = KeyStore.getInstance("PKCS12");
        try (FileInputStream fis = new FileInputStream(props.getKeystorePath())) {
            keyStore.load(fis, props.getKeystorePassword().toCharArray());
        }

        // Configurar NFe
        this.config = ConfiguracoesNfe.criarConfiguracoes(
            props.getEnvironment().equals("producao") ? ConstantesUtil.NFE : ConstantesUtil.NFE_HOMOLOGACAO,
            ConstantesUtil.VERSAO.NFE_4_00,
            keyStore,
            props.getKeystorePassword(),
            "path/to/schemas" // TODO: ajustar caminho dos schemas XSD
        );
        // TODO: configurar UF, etc. se necessário
    }

    @Override
    public String statusServico() throws Exception {
        TRetConsStatServ retorno = Nfe.statusServico(config, ConstantesUtil.NFE);
        return XmlNfeUtil.objectToXml(retorno);
    }

    @Override
    public String enviarNfe(String xml) throws Exception {
        TEnviNFe enviNFe = XmlNfeUtil.xmlToObject(xml, TEnviNFe.class);
        TRetEnviNFe retorno = Nfe.enviarNfe(config, ConstantesUtil.NFE, enviNFe);
        return XmlNfeUtil.objectToXml(retorno);
    }

    @Override
    public String consultar(String chave) throws Exception {
        TRetConsSitNFe retorno = Nfe.consultaXml(config, chave, ConstantesUtil.NFE);
        return XmlNfeUtil.objectToXml(retorno);
    }

    @Override
    public String cancelar(String chave, String justificativa) throws Exception {
        // Assumindo protocolo fixo para exemplo; em produção, obter do envio anterior
        String protocolo = "123456789012345"; // TODO: obter dinamicamente
        String retorno = Nfe.eventoCancelamento(config, ConstantesUtil.NFE, chave, justificativa, 1, protocolo);
        return retorno;
    }

    @Override
    public String enviarCce(String chave, String correcao) throws Exception {
        String retorno = Nfe.eventoCce(config, ConstantesUtil.NFE, chave, correcao, 1);
        return retorno;
    }
}

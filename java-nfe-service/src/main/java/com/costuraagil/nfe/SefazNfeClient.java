package com.costuraagil.nfe;

import org.springframework.stereotype.Component;

@Component
public class SefazNfeClient implements NfeClient {

    private final NfeProperties props;

    public SefazNfeClient(NfeProperties props) throws Exception {
        this.props = props;

        // Simulação simples - não requer dependências externas
        System.out.println("Cliente NFe inicializado em modo SIMULAÇÃO (sem dependências externas)");
    }

    @Override
    public String statusServico() throws Exception {
        if ("producao".equals(props.getEnvironment())) {
            // TODO: Implementar chamada real para SEFAZ produção
            throw new Exception("Status do serviço em produção ainda não implementado");
        } else {
            // Modo simulação/homologação
            return "<retConsStatServ><tpAmb>2</tpAmb><verAplic>1.0.0</verAplic><cStat>107</cStat><xMotivo>Serviço em Operação</xMotivo></retConsStatServ>";
        }
    }

    @Override
    public String enviarNfe(String xml) throws Exception {
        if ("producao".equals(props.getEnvironment())) {
            // TODO: Implementar envio real de NFe para produção
            throw new Exception("Emissão de NFe em produção ainda não implementada");
        } else {
            // Modo simulação/homologação
            String numeroRecibo = "123456789012345";
            return "<retEnviNFe><tpAmb>2</tpAmb><verAplic>1.0.0</verAplic><cStat>103</cStat><xMotivo>Lote recebido com sucesso</xMotivo><infRec><nRec>" + numeroRecibo + "</nRec></infRec></retEnviNFe>";
        }
    }

    @Override
    public String consultar(String chave) throws Exception {
        if ("producao".equals(props.getEnvironment())) {
            // TODO: Implementar consulta real de NFe em produção
            throw new Exception("Consulta de NFe em produção ainda não implementada");
        } else {
            // Modo simulação/homologação
            return "<retConsSitNFe><tpAmb>2</tpAmb><verAplic>1.0.0</verAplic><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo><infProt><chNFe>" + chave + "</chNFe><nProt>123456789012345</nProt></infProt></retConsSitNFe>";
        }
    }

    @Override
    public String cancelar(String chave, String justificativa) throws Exception {
        if ("producao".equals(props.getEnvironment())) {
            // TODO: Implementar cancelamento real de NFe em produção
            throw new Exception("Cancelamento de NFe em produção ainda não implementado");
        } else {
            // Modo simulação/homologação
            return "<retCancNFe><tpAmb>2</tpAmb><verAplic>1.0.0</verAplic><cStat>101</cStat><xMotivo>Cancelamento de NF-e homologado</xMotivo></retCancNFe>";
        }
    }

    @Override
    public String enviarCce(String chave, String correcao) throws Exception {
        if ("producao".equals(props.getEnvironment())) {
            // TODO: Implementar CC-e real em produção
            throw new Exception("CC-e em produção ainda não implementado");
        } else {
            // Modo simulação/homologação
            return "<retCCe><tpAmb>2</tpAmb><verAplic>1.0.0</verAplic><cStat>135</cStat><xMotivo>Evento registrado e vinculado a NF-e</xMotivo></retCCe>";
        }
    }
}

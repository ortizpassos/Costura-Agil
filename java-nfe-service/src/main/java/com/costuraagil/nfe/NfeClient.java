package com.costuraagil.nfe;

public interface NfeClient {
    String statusServico() throws Exception;
    String enviarNfe(String xml) throws Exception;
    String consultar(String chave) throws Exception;
    String cancelar(String chave, String justificativa) throws Exception;
    String enviarCce(String chave, String correcao) throws Exception;
}

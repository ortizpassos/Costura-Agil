package com.example.javanfespringboot;

import br.com.swconsultoria.nfe.dom.ConfiguracoesNfe;
import br.com.swconsultoria.nfe.dom.enuns.AmbienteEnum;
import br.com.swconsultoria.nfe.dom.enuns.DocumentoEnum;
import br.com.swconsultoria.nfe.dom.enuns.ServicosEnum;
import br.com.swconsultoria.nfe.dom.enuns.UF;
import br.com.swconsultoria.nfe.exception.NfeException;
import br.com.swconsultoria.nfe.util.LoggerUtil;
import br.com.swconsultoria.nfe.util.RetornoUtil;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.security.KeyStore;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;
import java.util.logging.Level;

@Configuration
public class NfeConfig {

    @Value("${br.com.swconsultoria.nfe.schema.path}")
    private String schemaPath;

    // TODO: Substituir pelos dados reais do seu certificado
    private static final String CERTIFICADO_PATH = "caminho/para/seu/certificado.pfx";
    private static final String CERTIFICADO_SENHA = "sua_senha";

    @Bean
    public ConfiguracoesNfe configuracoesNfe() throws NfeException {
        try {
            // 1. Carregar o Certificado
            // Em um ambiente real, você carregaria o certificado de um local seguro.
            // Para este exemplo, estamos simulando o carregamento.
            // O Java_NFe suporta InputStream, o que é ideal para Spring Boot.
            // InputStream is = new FileInputStream(CERTIFICADO_PATH);
            
            // Simulação de KeyStore (substitua pelo seu KeyStore real)
            KeyStore keyStore = KeyStore.getInstance("PKCS12");
            // keyStore.load(is, CERTIFICADO_SENHA.toCharArray());
            
            // 2. Configurar o Log
            LoggerUtil.log(NfeConfig.class, Level.INFO, "Iniciando Configurações NFe...");

            // 3. Criar e Retornar as Configurações
            ConfiguracoesNfe config = ConfiguracoesNfe.builder()
                    .withAmbiente(AmbienteEnum.HOMOLOGACAO) // Mudar para PRODUCAO quando for o caso
                    .withCUF(UF.SP) // Mudar para a UF do emitente
                    .withCertificado(keyStore, CERTIFICADO_SENHA)
                    .withSchemaPath(schemaPath)
                    .withContribuinteCidadao(false) // Opcional
                    .build();

            // 4. Iniciar as Configurações
            br.com.swconsultoria.nfe.util.WebServiceUtil.iniciaConfiguracao(config);

            LoggerUtil.log(NfeConfig.class, Level.INFO, "Configurações NFe Concluídas.");

            return config;

        } catch (KeyStoreException | NoSuchAlgorithmException | CertificateException | IOException e) {
            LoggerUtil.log(NfeConfig.class, Level.SEVERE, "Erro ao configurar Java_NFe: " + e.getMessage());
            throw new NfeException("Erro ao configurar Java_NFe: " + e.getMessage(), e);
        }
    }
}

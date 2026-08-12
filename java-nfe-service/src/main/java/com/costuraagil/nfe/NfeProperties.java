package com.costuraagil.nfe;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "nfe")
public class NfeProperties {
    private String keystorePath;
    private String keystorePassword;
    private String environment; // homologacao | producao
    private String sefazEndpoint; // endpoint genérico; por UF pode ser mapa
    private String uf;
    private String cnpj;

    // getters / setters
    public String getKeystorePath() { return keystorePath; }
    public void setKeystorePath(String keystorePath) { this.keystorePath = keystorePath; }
    public String getKeystorePassword() { return keystorePassword; }
    public void setKeystorePassword(String keystorePassword) { this.keystorePassword = keystorePassword; }
    public String getEnvironment() { return environment; }
    public void setEnvironment(String environment) { this.environment = environment; }
    public String getSefazEndpoint() { return sefazEndpoint; }
    public void setSefazEndpoint(String sefazEndpoint) { this.sefazEndpoint = sefazEndpoint; }
    public String getUf() { return uf; }
    public void setUf(String uf) { this.uf = uf; }
    public String getCnpj() { return cnpj; }
    public void setCnpj(String cnpj) { this.cnpj = cnpj; }
}

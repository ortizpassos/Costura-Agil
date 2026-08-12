# Configuração para Emissão Real de NFe

## Status Atual da Implementação

### ✅ Implementado
- **Modo Homologação/Simulação**: Funcionando corretamente
- **Estrutura de Configuração**: Preparada para produção
- **Validação de Ambiente**: Detecta automaticamente homologação vs produção
- **Tratamento de Erros**: Implementado para diferentes cenários

### 🚧 Pendente para Produção
- **Integração Real com SEFAZ**: Requer implementação completa da biblioteca java-nfe
- **Parsing XML de NFe**: Conversão de String XML para objetos da biblioteca
- **Certificado Digital**: Configuração e carregamento de certificados A1/A3
- **Tratamento de Eventos**: Cancelamento e Carta de Correção

## Pré-requisitos

### 1. Certificado Digital
Para emitir NFe em produção, você precisa de um certificado digital A1 (.pfx) válido.

**Como obter:**
- Contrate um certificado digital junto a uma Autoridade Certificadora credenciada pela ICP-Brasil
- Certificado deve ser do tipo A1 (arquivo) ou A3 (token/cartão)
- Para A1: arquivo .pfx contendo chave privada e pública

### 2. Cadastro na SEFAZ
- Empresa deve estar cadastrada na SEFAZ do estado
- Possuir CSC (Código de Segurança do Contribuinte) válido
- Configurar CSC no sistema (se necessário)

## Configuração

### 1. Arquivo de Propriedades de Produção
Edite o arquivo `src/main/resources/application-prod.properties`:

```properties
# Configurações para ambiente de produção
server.port=8082

# Configurações NFe Produção
nfe.environment=producao
nfe.uf=SP
nfe.cnpj=10787210000125

# IMPORTANTE: Configure o caminho correto para seu certificado A1 (.pfx)
nfe.keystorePath=C:/caminho/para/certificado.pfx

# IMPORTANTE: Configure a senha do seu certificado
nfe.keystorePassword=sua_senha_aqui

# Logs mais detalhados em produção
logging.level.br.com.swconsultoria=DEBUG
logging.level.com.costuraagil=INFO
```

### 2. Executar em Produção
Para executar o serviço em modo produção:

```bash
# Compilar
mvn clean package -DskipTests

# Executar com perfil de produção
java -jar target/java-nfe-service-0.0.1-SNAPSHOT.jar --spring.profiles.active=prod
```

Ou definir a variável de ambiente:
```bash
set SPRING_PROFILES_ACTIVE=prod
java -jar target/java-nfe-service-0.0.1-SNAPSHOT.jar
```

## Testes

### 1. Status do Serviço (Funcionando)
Teste se a SEFAZ está respondendo:
```bash
curl http://localhost:8082/api/nfe/status
```

### 2. Emissão de NFe (Simulação - Pendente Produção)
Para emitir uma NFe real, será necessário implementar o parsing XML:
```bash
curl -X POST http://localhost:8082/api/nfe/gerar \
  -H "Content-Type: application/xml" \
  -d @nota-fiscal.xml
```

## Próximos Passos para Implementação Completa

### 1. Implementar Parsing XML
```java
// Exemplo de implementação futura
@Override
public String enviarNfe(String xml) throws Exception {
    if ("producao".equals(props.getEnvironment()) || "homologacao".equals(props.getEnvironment())) {
        try {
            // Parse XML string para objeto TEnviNFe
            TEnviNFe enviNFe = XmlNfeUtil.xmlToEnviNFe(xml);
            TRetEnviNFe retorno = Nfe.enviarNfe(configuracoesNfe, enviNFe, DocumentoEnum.NFE);
            return XmlNfeUtil.objectToXml(retorno);
        } catch (NfeException e) {
            throw new Exception("Erro ao enviar NFe: " + e.getMessage(), e);
        }
    }
    // ... resto do código
}
```

### 2. Implementar Cancelamento Real
```java
@Override
public String cancelar(String chave, String justificativa) throws Exception {
    if ("producao".equals(props.getEnvironment()) || "homologacao".equals(props.getEnvironment())) {
        try {
            TEnvEvento envEvento = EventoUtil.criarEventoCancelamento(chave, justificativa, configuracoesNfe);
            TRetEnvEvento retorno = Nfe.cancelarNfe(configuracoesNfe, envEvento, false, DocumentoEnum.NFE);
            return XmlNfeUtil.objectToXml(retorno);
        } catch (NfeException e) {
            throw new Exception("Erro ao cancelar NFe: " + e.getMessage(), e);
        }
    }
    // ... modo simulação
}
```

### 3. Implementar Carta de Correção
```java
@Override
public String enviarCce(String chave, String correcao) throws Exception {
    if ("producao".equals(props.getEnvironment()) || "homologacao".equals(props.getEnvironment())) {
        try {
            TEnvEvento envEvento = EventoUtil.criarCce(chave, correcao, configuracoesNfe);
            TRetEnvEvento retorno = Nfe.cce(configuracoesNfe, envEvento, false, DocumentoEnum.NFE);
            return XmlNfeUtil.objectToXml(retorno);
        } catch (NfeException e) {
            throw new Exception("Erro ao enviar CC-e: " + e.getMessage(), e);
        }
    }
    // ... modo simulação
}
```

## Segurança

- **Nunca** commite arquivos de certificado no Git
- Mantenha o certificado em local seguro
- Use senhas fortes
- Configure permissões adequadas no arquivo do certificado

## Troubleshooting

### Erro: "Caminho do certificado é obrigatório para produção"
- Verifique se `nfe.keystorePath` está configurado corretamente
- Certifique-se de que o arquivo .pfx existe no caminho especificado

### Erro: "Erro ao carregar certificado"
- Verifique se a senha está correta
- Certifique-se de que o certificado não expirou
- Verifique se o arquivo não está corrompido

### Erro: "Rejeição 225: Certificado transmissor inválido"
- Certificado pode ter expirado
- CNPJ do certificado pode não corresponder ao CNPJ da empresa
- Certificado pode não ser válido para NFe

### Erro: "Rejeição 226: Certificado transmissor inexistente na base de dados"
- Empresa pode não estar cadastrada na SEFAZ
- Certificado pode não estar autorizado para a empresa

## Ambiente de Homologação

Para testes em homologação (ambiente de testes da SEFAZ):

```properties
nfe.environment=homologacao
nfe.keystorePath=  # Opcional em homologação
nfe.keystorePassword=  # Opcional em homologação
```

**Nota:** Mesmo em homologação, alguns estados podem exigir certificado válido.

## Suporte

Para dúvidas sobre certificados digitais:
- Entre em contato com sua Autoridade Certificadora
- Consulte a documentação da SEFAZ do seu estado
- Verifique o manual da biblioteca java-nfe: https://github.com/Samuel-Oliveira/Java_NFe

## Status da Implementação

- ✅ Modo simulação funcionando
- ✅ Estrutura preparada para produção
- ✅ Validação de configuração implementada
- 🚧 Integração real com SEFAZ pendente
- 🚧 Parsing XML pendente
- 🚧 Certificado digital pendente
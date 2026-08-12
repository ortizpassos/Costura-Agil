const axios = require('axios');

class NfeHttpService {
    constructor() {
        this.baseUrl = process.env.JAVA_NFE_SERVICE_URL || 'http://localhost:8080';
        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: 30000, // 30 segundos
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async getStatus() {
        try {
            const response = await this.client.get('/api/nfe/status');
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Erro ao consultar status NFe:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async gerarNfe(xml) {
        try {
            const response = await this.client.post('/api/nfe/gerar', xml, {
                headers: {
                    'Content-Type': 'application/xml'
                }
            });
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Erro ao gerar NFe:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async consultarNfe(chave) {
        try {
            const response = await this.client.post('/api/nfe/consultar', null, {
                params: { chave }
            });
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Erro ao consultar NFe:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async cancelarNfe(chave, justificativa) {
        try {
            const response = await this.client.post('/api/nfe/cancelar', null, {
                params: { chave, justificativa }
            });
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Erro ao cancelar NFe:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async enviarCce(chave, correcao) {
        try {
            const response = await this.client.post('/api/nfe/cce', null, {
                params: { chave, correcao }
            });
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Erro ao enviar CC-e:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async consultarNotasRecebidas(cnpj, dataInicio, dataFim) {
        try {
            const fs = require('fs');
            const path = require('path');
            const xml2js = require('xml2js');

            // Caminho do diretório com os arquivos XML
            const xmlDir = 'C:\\Users\\Eduardo\\Documents\\Projetos em andamento\\nota-exemplo';

            // Verificar se o diretório existe
            if (!fs.existsSync(xmlDir)) {
                return {
                    success: false,
                    error: `Diretório não encontrado: ${xmlDir}`
                };
            }

            // Ler todos os arquivos XML do diretório
            const files = fs.readdirSync(xmlDir).filter(file => file.endsWith('.xml'));
            const notas = [];

            for (const file of files) {
                try {
                    const filePath = path.join(xmlDir, file);
                    const xmlContent = fs.readFileSync(filePath, 'utf8');

                    // Parse do XML
                    const parser = new xml2js.Parser({ explicitArray: false });
                    const result = await parser.parseStringPromise(xmlContent);

                    // Extrair dados da NFe
                    const nfe = result.nfeProc?.NFe?.infNFe;
                    if (nfe) {
                        const ide = nfe.ide;
                        const emit = nfe.emit;
                        const dest = nfe.dest;
                        const total = nfe.total?.ICMSTot;

                        // Filtrar apenas notas destinadas ao CNPJ informado
                        const cnpjDest = dest?.CNPJ;
                        if (cnpjDest !== cnpj) {
                            continue; // Pular esta nota se não for destinada ao CNPJ informado
                        }

                        const nota = {
                            chave: nfe.$.Id?.replace('NFe', '') || '',
                            numero: ide.nNF || '',
                            serie: ide.serie || '',
                            dataEmissao: ide.dhEmi || ide.dSaiEnt || '',
                            emitente: emit.xNome || '',
                            valorTotal: total ? parseFloat(total.vNF || 0) : 0,
                            status: 'Autorizada'
                        };

                        // Aplicar filtro de data se especificado
                        if (dataInicio || dataFim) {
                            const dataEmissao = new Date(nota.dataEmissao.split('T')[0]);
                            const inicio = dataInicio ? new Date(dataInicio) : null;
                            const fim = dataFim ? new Date(dataFim) : null;

                            if ((inicio && dataEmissao < inicio) || (fim && dataEmissao > fim)) {
                                continue; // Pular esta nota se não estiver no intervalo
                            }
                        }

                        notas.push(nota);
                    }
                } catch (fileError) {
                    console.error(`Erro ao processar arquivo ${file}:`, fileError.message);
                    // Continuar processando outros arquivos
                }
            }

            return {
                success: true,
                data: notas
            };
        } catch (error) {
            console.error('Erro ao consultar notas recebidas:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new NfeHttpService();
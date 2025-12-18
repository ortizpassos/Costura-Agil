#!/usr/bin/env node

/**
 * Script de teste para comunicação NFe via mensageria RabbitMQ
 * Este script demonstra como o sistema funcionaria com RabbitMQ
 */

const amqp = require('amqplib');
const { v4: uuidv4 } = require('uuid');

class NfeMessagingTest {
    constructor() {
        this.connection = null;
        this.channel = null;
    }

    async connect() {
        try {
            console.log('🔄 Conectando ao RabbitMQ...');
            this.connection = await amqp.connect('amqp://guest:guest@localhost:5672');
            this.channel = await this.connection.createChannel();

            // Declarar exchange e filas
            await this.channel.assertExchange('nfe.exchange', 'direct', { durable: true });
            await this.channel.assertQueue('nfe.request.queue', { durable: true });
            await this.channel.assertQueue('nfe.response.queue', { durable: true });

            await this.channel.bindQueue('nfe.request.queue', 'nfe.exchange', 'nfe.request');
            await this.channel.bindQueue('nfe.response.queue', 'nfe.exchange', 'nfe.response');

            console.log('✅ Conectado ao RabbitMQ');
        } catch (error) {
            console.error('❌ Erro ao conectar ao RabbitMQ:', error.message);
            console.log('💡 Para executar este teste, inicie o RabbitMQ:');
            console.log('   docker-compose up -d rabbitmq');
            console.log('   ou instale RabbitMQ localmente');
            throw error;
        }
    }

    async simulateJavaService() {
        console.log('🚀 Iniciando simulação do serviço Java NFe...');

        // Consumir mensagens de requisição
        await this.channel.consume('nfe.request.queue', async (msg) => {
            if (msg) {
                try {
                    const request = JSON.parse(msg.content.toString());
                    console.log('📨 Recebida requisição NFe:', request.operation);

                    const response = await this.processNfeRequest(request);

                    // Enviar resposta
                    this.channel.publish('nfe.exchange', 'nfe.response',
                        Buffer.from(JSON.stringify(response)), {
                        correlationId: request.correlationId,
                        persistent: true
                    });

                    console.log('📤 Enviada resposta NFe:', response.success ? 'SUCCESS' : 'ERROR');
                } catch (error) {
                    console.error('❌ Erro ao processar requisição:', error);
                }

                this.channel.ack(msg);
            }
        });

        console.log('🎯 Serviço Java NFe simulado está ouvindo...');
    }

    async processNfeRequest(request) {
        const { operation, correlationId } = request;

        // Simular processamento do serviço Java
        await new Promise(resolve => setTimeout(resolve, 100)); // Simular latência

        switch (operation) {
            case 'status':
                return {
                    success: true,
                    message: 'Status do serviço SEFAZ Homologação: Serviço em Operação'
                };

            case 'gerar':
                return {
                    success: true,
                    message: 'NFe enviada para homologação com sucesso. Recibo: 123456789012345'
                };

            case 'consultar':
                return {
                    success: true,
                    message: 'Consulta realizada em homologação: <retConsSitNFe><infProt><chNFe>' +
                            request.chave + '</chNFe><nProt>123456789012345</nProt></infProt></retConsSitNFe>'
                };

            case 'cancelar':
                return {
                    success: true,
                    message: 'NFe cancelada em homologação com sucesso. Chave: ' + request.chave
                };

            case 'cce':
                return {
                    success: true,
                    message: 'CC-e enviada para homologação com sucesso. Chave: ' + request.chave
                };

            default:
                return {
                    success: false,
                    error: 'Operação não suportada: ' + operation
                };
        }
    }

    async testBackendRequests() {
        console.log('🧪 Iniciando testes de requisições do backend...');

        const operations = [
            { operation: 'status' },
            { operation: 'gerar', xml: '<nfe>XML_EXEMPLO</nfe>' },
            { operation: 'consultar', chave: '12345678901234567890123456789012345678901234' },
            { operation: 'cancelar', chave: '12345678901234567890123456789012345678901234', justificativa: 'Cancelamento por teste' },
            { operation: 'cce', chave: '12345678901234567890123456789012345678901234', correcao: 'Correção de teste' }
        ];

        for (const op of operations) {
            await this.sendTestRequest(op);
            await new Promise(resolve => setTimeout(resolve, 500)); // Pausa entre testes
        }
    }

    async sendTestRequest(operationData) {
        const correlationId = uuidv4();
        const message = {
            ...operationData,
            correlationId,
            timestamp: new Date().toISOString()
        };

        console.log(`📤 Enviando ${operationData.operation}...`);

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                console.log(`⏰ Timeout para ${operationData.operation}`);
                resolve();
            }, 5000);

            // Consumir resposta específica
            const consumerTag = `test-${correlationId}`;
            this.channel.consume('nfe.response.queue', (msg) => {
                if (msg && msg.properties.correlationId === correlationId) {
                    const response = JSON.parse(msg.content.toString());
                    console.log(`✅ Resposta ${operationData.operation}:`, response.success ? 'SUCCESS' : 'ERROR');
                    if (response.message) console.log(`   📄 ${response.message.substring(0, 100)}...`);
                    if (response.error) console.log(`   ❌ ${response.error}`);

                    this.channel.cancel(consumerTag);
                    clearTimeout(timeout);
                    resolve();
                }
            }, { consumerTag });

            // Enviar requisição
            this.channel.publish('nfe.exchange', 'nfe.request',
                Buffer.from(JSON.stringify(message)), {
                correlationId,
                persistent: true
            });
        });
    }

    async disconnect() {
        if (this.channel) await this.channel.close();
        if (this.connection) await this.connection.close();
        console.log('🔌 Desconectado do RabbitMQ');
    }

    async runTests() {
        try {
            await this.connect();
            await this.simulateJavaService();

            // Aguardar um pouco para o serviço estar pronto
            await new Promise(resolve => setTimeout(resolve, 1000));

            await this.testBackendRequests();

            console.log('🎉 Todos os testes concluídos!');
        } catch (error) {
            console.error('❌ Erro durante os testes:', error.message);
        } finally {
            await this.disconnect();
        }
    }
}

// Executar testes se chamado diretamente
if (require.main === module) {
    const test = new NfeMessagingTest();
    test.runTests().then(() => {
        console.log('🏁 Teste finalizado');
        process.exit(0);
    }).catch((error) => {
        console.error('💥 Erro fatal:', error);
        process.exit(1);
    });
}

module.exports = NfeMessagingTest;
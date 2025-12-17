const amqp = require('amqplib');
const { v4: uuidv4 } = require('uuid');

class NfeMessagingService {
    constructor() {
        this.connection = null;
        this.channel = null;
        this.responsePromises = new Map();
        this.isConnected = false;
    }

    async connect() {
        try {
            if (this.isConnected) return;

            this.connection = await amqp.connect('amqp://guest:guest@localhost:5672');
            this.channel = await this.connection.createChannel();

            // Declarar exchange e filas
            await this.channel.assertExchange('nfe.exchange', 'direct', { durable: true });

            await this.channel.assertQueue('nfe.request.queue', { durable: true });
            await this.channel.assertQueue('nfe.response.queue', { durable: true });

            await this.channel.bindQueue('nfe.request.queue', 'nfe.exchange', 'nfe.request');
            await this.channel.bindQueue('nfe.response.queue', 'nfe.exchange', 'nfe.response');

            // Consumir respostas
            await this.channel.consume('nfe.response.queue', (msg) => {
                if (msg) {
                    const correlationId = msg.properties.correlationId;
                    const promise = this.responsePromises.get(correlationId);

                    if (promise) {
                        const response = JSON.parse(msg.content.toString());
                        promise.resolve(response);
                        this.responsePromises.delete(correlationId);
                    }

                    this.channel.ack(msg);
                }
            });

            this.isConnected = true;
            console.log('✅ Conectado ao RabbitMQ para NFe');
        } catch (error) {
            console.error('❌ Erro ao conectar ao RabbitMQ:', error);
            throw error;
        }
    }

    async sendNfeRequest(operation, data = {}) {
        if (!this.isConnected) {
            await this.connect();
        }

        const correlationId = uuidv4();
        const message = {
            operation,
            correlationId,
            timestamp: new Date().toISOString(),
            ...data
        };

        return new Promise((resolve, reject) => {
            // Timeout de 30 segundos
            const timeout = setTimeout(() => {
                this.responsePromises.delete(correlationId);
                reject(new Error('Timeout aguardando resposta do serviço NFe'));
            }, 30000);

            this.responsePromises.set(correlationId, {
                resolve: (response) => {
                    clearTimeout(timeout);
                    resolve(response);
                },
                reject: (error) => {
                    clearTimeout(timeout);
                    reject(error);
                }
            });

            this.channel.publish('nfe.exchange', 'nfe.request', Buffer.from(JSON.stringify(message)), {
                correlationId,
                persistent: true
            });
        });
    }

    async getStatus() {
        return this.sendNfeRequest('status');
    }

    async gerarNfe(xml) {
        return this.sendNfeRequest('gerar', { xml });
    }

    async consultarNfe(chave) {
        return this.sendNfeRequest('consultar', { chave });
    }

    async cancelarNfe(chave, justificativa) {
        return this.sendNfeRequest('cancelar', { chave, justificativa });
    }

    async enviarCce(chave, correcao) {
        return this.sendNfeRequest('cce', { chave, correcao });
    }

    async disconnect() {
        if (this.channel) {
            await this.channel.close();
        }
        if (this.connection) {
            await this.connection.close();
        }
        this.isConnected = false;
        console.log('🔌 Desconectado do RabbitMQ');
    }
}

module.exports = new NfeMessagingService();
#!/usr/bin/env node

/**
 * Teste das APIs NFe via HTTP (fallback quando RabbitMQ não está disponível)
 * Este script testa as rotas HTTP do backend que fazem proxy para o serviço Java
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api/nfe';

class NfeApiTest {
    async testStatus() {
        console.log('🧪 Testando GET /api/nfe/status');
        try {
            const response = await axios.get(`${BASE_URL}/status`);
            console.log('✅ Status:', response.status);
            console.log('📄 Resposta:', response.data);
        } catch (error) {
            console.log('❌ Erro:', error.response?.status, error.message);
        }
    }

    async testGerar() {
        console.log('🧪 Testando POST /api/nfe/gerar');
        try {
            const response = await axios.post(`${BASE_URL}/gerar`, {
                xml: '<nfe><infNFe><ide><cUF>35</cUF><cNF>00000001</cNF></ide></infNFe></nfe>'
            });
            console.log('✅ Status:', response.status);
            console.log('📄 Resposta:', response.data);
        } catch (error) {
            console.log('❌ Erro:', error.response?.status, error.message);
        }
    }

    async testConsultar() {
        console.log('🧪 Testando POST /api/nfe/consultar');
        try {
            const response = await axios.post(`${BASE_URL}/consultar`, {
                chave: '35151234567890123456789012345678901234567890'
            });
            console.log('✅ Status:', response.status);
            console.log('📄 Resposta:', response.data);
        } catch (error) {
            console.log('❌ Erro:', error.response?.status, error.message);
        }
    }

    async testCancelar() {
        console.log('🧪 Testando POST /api/nfe/cancelar');
        try {
            const response = await axios.post(`${BASE_URL}/cancelar`, {
                chave: '35151234567890123456789012345678901234567890',
                justificativa: 'Cancelamento solicitado pelo usuário para testes de integração'
            });
            console.log('✅ Status:', response.status);
            console.log('📄 Resposta:', response.data);
        } catch (error) {
            console.log('❌ Erro:', error.response?.status, error.message);
        }
    }

    async testCce() {
        console.log('🧪 Testando POST /api/nfe/cce');
        try {
            const response = await axios.post(`${BASE_URL}/cce`, {
                chave: '35151234567890123456789012345678901234567890',
                correcao: 'Correção: Alterar valor do ICMS de 100,00 para 150,00'
            });
            console.log('✅ Status:', response.status);
            console.log('📄 Resposta:', response.data);
        } catch (error) {
            console.log('❌ Erro:', error.response?.status, error.message);
        }
    }

    async runAllTests() {
        console.log('🚀 Iniciando testes das APIs NFe via HTTP\n');

        // Verificar se backend está rodando
        try {
            await axios.get('http://localhost:3001/api/test');
        } catch (error) {
            console.log('❌ Backend não está respondendo. Inicie com: npm start\n');
            return;
        }

        console.log('✅ Backend está rodando\n');

        await this.testStatus();
        console.log('');

        await this.testGerar();
        console.log('');

        await this.testConsultar();
        console.log('');

        await this.testCancelar();
        console.log('');

        await this.testCce();
        console.log('');

        console.log('🎉 Todos os testes concluídos!');
        console.log('\n💡 Nota: Se as respostas indicarem erro de conexão com RabbitMQ,');
        console.log('   isso é esperado quando o serviço Java não está usando mensageria.');
        console.log('   Para testar mensageria completa, execute:');
        console.log('   docker-compose up -d rabbitmq');
        console.log('   mvn spring-boot:run (java-nfe-service)');
        console.log('   node test/nfe-messaging-test.js');
    }
}

// Executar testes se chamado diretamente
if (require.main === module) {
    const test = new NfeApiTest();
    test.runAllTests().catch((error) => {
        console.error('💥 Erro fatal:', error);
        process.exit(1);
    });
}

module.exports = NfeApiTest;
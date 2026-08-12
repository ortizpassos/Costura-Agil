const axios = require('axios');

async function testEndpoint() {
    try {
        console.log('Testando endpoint /api/nfe/recebidas...');
        const response = await axios.get('http://localhost:8082/api/nfe/recebidas', {
            params: { cnpj: '12345678901234' },
            timeout: 5000
        });
        console.log('✅ Sucesso!');
        console.log('Status:', response.status);
        console.log('Dados:', response.data);
    } catch (error) {
        console.error('❌ Erro:', error.message);
        if (error.code) console.error('Código:', error.code);
    }
}

testEndpoint();
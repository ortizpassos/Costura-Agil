const http = require('http');

async function testarLogin() {
  const data = JSON.stringify({
    email: 'Admin',
    senha: 'Rexc180523knd!'
  });

  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => {
      body += chunk;
    });
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Resposta:', body);
    });
  });

  req.on('error', (e) => {
    console.error('Erro:', e);
  });

  req.write(data);
  req.end();
}

testarLogin();
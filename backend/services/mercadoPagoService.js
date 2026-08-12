const https = require('https');
const crypto = require('crypto');

const MP_HOST = 'api.mercadopago.com';

function getAccessToken() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    const err = new Error('MERCADOPAGO_ACCESS_TOKEN não configurado no backend.');
    err.code = 'MP_NOT_CONFIGURED';
    throw err;
  }
  return token;
}

function requestMercadoPago(method, path, body, extraHeaders = {}) {
  const accessToken = getAccessToken();
  const payload = body ? JSON.stringify(body) : null;

  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${accessToken}`,
    ...extraHeaders
  };

  if (payload) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(payload);
  }

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: MP_HOST,
      port: 443,
      path,
      method,
      headers,
      timeout: 15000
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed = {};
        try {
          parsed = data ? JSON.parse(data) : {};
        } catch (e) {
          return reject(new Error(`Resposta inválida do Mercado Pago (${res.statusCode}): ${data.slice(0, 300)}`));
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          return resolve(parsed);
        }

        const message = parsed.message || parsed.error || `HTTP ${res.statusCode}`;
        const err = new Error(`Mercado Pago: ${message}`);
        err.statusCode = res.statusCode;
        err.response = parsed;
        reject(err);
      });
    });

    req.on('timeout', () => req.destroy(new Error('Timeout ao conectar ao Mercado Pago.')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function createPixPayment({ deviceId, amount }) {
  const payerEmail = process.env.MERCADOPAGO_PAYER_EMAIL;
  const payerCpf = (process.env.MERCADOPAGO_PAYER_CPF || '').replace(/\D/g, '');

  if (!payerEmail || payerCpf.length !== 11) {
    const err = new Error('Configure MERCADOPAGO_PAYER_EMAIL e MERCADOPAGO_PAYER_CPF (11 dígitos) no backend.');
    err.code = 'MP_PAYER_NOT_CONFIGURED';
    throw err;
  }

  const externalReference = `device_activation:${deviceId}`;
  const body = {
    transaction_amount: Number(amount),
    description: `Ativacao dispositivo ${deviceId}`,
    payment_method_id: 'pix',
    external_reference: externalReference,
    payer: {
      email: payerEmail,
      identification: {
        type: 'CPF',
        number: payerCpf
      }
    }
  };

  return requestMercadoPago('POST', '/v1/payments', body, {
    'X-Idempotency-Key': crypto.randomUUID()
  });
}

async function getPayment(paymentId) {
  return requestMercadoPago('GET', `/v1/payments/${encodeURIComponent(paymentId)}`);
}

module.exports = {
  createPixPayment,
  getPayment
};

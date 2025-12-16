# Backend - Sistema Financeiro

API Node.js + Express + MongoDB com autenticação JWT.

## Setup
1. Copie `.env.example` para `.env` e ajuste variáveis.
2. Instale dependências:
```
npm install
```
3. Inicie:
```
npm run dev
```

## Rotas
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- GET /api/protected/ping

### Entidades (todas requerem Bearer token)
- GET /api/categories
- POST /api/categories { nome }
- DELETE /api/categories/:id

- GET /api/payment-methods
- POST /api/payment-methods { nome }
- DELETE /api/payment-methods/:id

- GET /api/receipt-methods
- POST /api/receipt-methods { nome }
- DELETE /api/receipt-methods/:id

- GET /api/expenses
- POST /api/expenses { descricao, valor, dataCompra, dataVencimento, ... }
- PUT /api/expenses/:id
- DELETE /api/expenses/:id
- POST /api/expenses/:id/toggle-paid
	- Filtros: ?from=YYYY-MM-DD&to=YYYY-MM-DD&search=texto (aplica em dataVencimento e regex em descricao)

- GET /api/receipts
- POST /api/receipts { descricao, valor, dataRecebimento, ... }
- PUT /api/receipts/:id
- DELETE /api/receipts/:id
	- Filtros: ?from=&to=&search= (filtra por dataRecebimento e regex em descricao)

- GET /api/sales
- POST /api/sales { descricao, valor, dataVenda, ... }
- PUT /api/sales/:id
- DELETE /api/sales/:id
	- Filtros: ?from=&to=&search=

### Sincronização Offline
- POST /api/sync
	- Corpo:
```json
{
	"categories": [{"id":"cat_local123","nome":"Administrativo"}],
	"paymentMethods": [],
	"receiptMethods": [],
	"expenses": [{"id":"dsp_local1","descricao":"Conta Luz","valor":500,"dataCompra":"2025-01-01","dataVencimento":"2025-01-01","pago":false}],
	"receipts": [],
	"sales": []
}
```
	- Resposta:
```json
{
	"categories": [{"localId":"cat_local123","newId":"65f..."}],
	"expenses": [{"localId":"dsp_local1","newId":"65f..."}],
	...
}
```
O front-end atual identifica itens offline por `_localOnly` e ids com prefixos (`cat_`, `fp_`, `dsp_`, etc.). Após sincronizar, substitui o id local pelo novo e remove `_localOnly`.

Envie o token JWT no header:
```
Authorization: Bearer <token>
```

## Tecnologias
- express
- mongoose
- jsonwebtoken
- bcryptjs
- morgan
- cors

## Próximos passos sugeridos
- Paginação e filtros server-side (query params ex: ?from=YYYY-MM-DD&to=YYYY-MM-DD)
- Adicionar paginação e filtros server-side.
- Implementar refresh tokens.
- Rate limiting e Helmet para segurança.

## Migração / Sincronização Local
O front-end mantém cache local (localStorage) como fallback quando a API não responde ou usuário está offline.
Campos criados offline possuem ids com prefixos (ex: cat_, fp_, dsp_) e o atributo `_localOnly`.
Uma estratégia futura: endpoint de sincronização que aceita lote de itens `_localOnly` para persistir e retornar ids definitivos.

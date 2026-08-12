# Backend - Instruções rápidas

1. Copie o arquivo de exemplo de variáveis de ambiente:

```powershell
cd backend
cp .env.example .env
```

2. Ajuste as variáveis em `.env` (p.ex. `MONGO_URI`, `JWT_SECRET`).

3. Instale dependências e rode o servidor:

```powershell
npm install
npm start
```

Observações:
- Não comite o `.env` em repositórios públicos.
- O servidor usará a porta `PORT` definida no `.env` ou `3001` por padrão.

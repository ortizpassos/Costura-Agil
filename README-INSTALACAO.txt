INTEGRACAO MERCADO PAGO - COSTURA AGIL

1. Copie os 3 arquivos da pasta backend/ para as pastas correspondentes da branch backend do seu repositorio.
2. Edite backend/app.js conforme PATCH-app.js.txt.
3. Confirme as variaveis no Render.
4. Commit/push na branch usada pelo Render e aguarde o deploy.
5. Teste:
   https://monitor-ellas-backend.onrender.com/api/device/activation/config

Resposta esperada:
{"amount":1,"currency":"BRL"}

Se retornar Cannot GET, a rota ainda nao foi registrada no app.js do codigo efetivamente implantado.

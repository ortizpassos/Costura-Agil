// Execute dentro da pasta backend: node BACKEND_INTEGRACAO/scripts/aplicar-integracao.js
// Este script copia os arquivos da integração e adiciona as duas linhas necessárias ao app.js.
const fs = require('fs');
const path = require('path');

const backendDir = process.cwd();
const integrationDir = path.resolve(__dirname, '..');

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function copy(relSrc, relDst) {
  const src = path.join(integrationDir, relSrc);
  const dst = path.join(backendDir, relDst);
  ensureDir(path.dirname(dst));
  fs.copyFileSync(src, dst);
  console.log('Copiado:', relDst);
}

copy('models/DeviceActivation.js', 'models/DeviceActivation.js');
copy('services/mercadoPagoService.js', 'services/mercadoPagoService.js');
copy('routes/deviceActivationRoutes.js', 'routes/deviceActivationRoutes.js');

const appPath = path.join(backendDir, 'app.js');
let app = fs.readFileSync(appPath, 'utf8');

if (!app.includes("require('./routes/deviceActivationRoutes')")) {
  const anchor = "const nfeRoutes = require('./routes/nfeRoutes');";
  if (!app.includes(anchor)) throw new Error('Âncora nfeRoutes não encontrada em app.js.');
  app = app.replace(anchor, anchor + "\nconst deviceActivationRoutes = require('./routes/deviceActivationRoutes');");
}

if (!app.includes("app.use('/api/device/activation', deviceActivationRoutes);")) {
  const anchor = "app.use('/api/nfe', nfeRoutes);";
  if (!app.includes(anchor)) throw new Error('Âncora /api/nfe não encontrada em app.js.');
  app = app.replace(anchor, anchor + "\napp.use('/api/device/activation', deviceActivationRoutes);");
}

fs.writeFileSync(appPath, app);
console.log('app.js atualizado com /api/device/activation');
console.log('Integração concluída. Configure as variáveis de ambiente no Render antes de reiniciar.');

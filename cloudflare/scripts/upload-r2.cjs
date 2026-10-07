const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const imagesDir = path.join(__dirname, '../migrated_data/images/recibos');
const files = fs.readdirSync(imagesDir);

console.log(`Encontradas ${files.length} imágenes para subir a R2...`);

for (let i = 0; i < files.length; i++) {
  const file = files[i];
  const fullPath = path.join(imagesDir, file);
  const r2Key = `recibos/${file}`;
  
  console.log(`[${i + 1}/${files.length}] Subiendo ${r2Key}...`);
  try {
    const cmd = `npx wrangler r2 object put "goparking-media/${r2Key}" --file="${fullPath}" --remote`;
    execSync(cmd, { stdio: 'inherit' });
  } catch (err) {
    console.error(`Error subiendo ${r2Key}:`, err.message);
  }
}

console.log('✅ ¡Todas las imágenes fueron subidas a Cloudflare R2!');

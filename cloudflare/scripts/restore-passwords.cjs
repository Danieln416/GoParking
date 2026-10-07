const fs = require('fs');

async function main() {
  const res = await fetch('https://docs.google.com/spreadsheets/d/1cnRWOd9LCBP7YwTa1htz2hj7q-zcRZvy/gviz/tq?tqx=out:csv&sheet=usuarios');
  const csv = await res.text();
  
  // Parse CSV rows safely
  const lines = csv.split('\n').filter(Boolean);
  const parseLine = (line) => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        result.push(cur.replace(/^"|"$/g, ''));
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.replace(/^"|"$/g, ''));
    return result;
  };

  const headers = parseLine(lines[0]);
  const idIdx = headers.indexOf('id');
  const pwdIdx = headers.indexOf('contrasena');
  const emailIdx = headers.indexOf('correo');
  const nameIdx = headers.indexOf('nombre');

  let sql = '-- Restaurar contrasenas originales de Google Sheets\n';
  let count = 0;
  for (let i = 1; i < lines.length; i++) {
    const row = parseLine(lines[i]);
    const id = row[idIdx];
    const pwd = row[pwdIdx];
    const email = row[emailIdx];
    const name = row[nameIdx];
    if (id && pwd) {
      sql += `UPDATE usuarios SET contrasena = '${pwd}' WHERE id = '${id}';\n`;
      count++;
    }
  }

  fs.writeFileSync('cloudflare/restore_original_passwords.sql', sql, 'utf8');
  console.log(`SQL generado con éxito para ${count} usuarios.`);
}

main().catch(console.error);

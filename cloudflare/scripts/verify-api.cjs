const baseUrl = 'https://goparking-api.daniram-parking.workers.dev';

async function testAll() {
  console.log('--- TEST 1: getUsuarios ---');
  const r1 = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getUsuarios' })
  });
  const users = await r1.json();
  console.log('Usuarios count:', users.data ? users.data.length : 'Error', users.data?.[0]?.nombre);

  console.log('\n--- TEST 2: login Admin ---');
  const r2 = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', correo: 'Daniram01031@gmail.com', contrasena: '123456' })
  });
  const loginRes = await r2.json();
  console.log('Login result:', JSON.stringify(loginRes));

  console.log('\n--- TEST 3: getRecibos ---');
  const r3 = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getRecibos', userId: 'all' })
  });
  const recibos = await r3.json();
  console.log('Recibos count:', recibos.data ? recibos.data.length : 'Error');

  console.log('\n--- TEST 4: getCuentasPago ---');
  const r4 = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getCuentasPago' })
  });
  const cuentas = await r4.json();
  console.log('Cuentas count:', cuentas.data ? cuentas.data.length : 'Error', cuentas.data?.[0]?.nombre);

  console.log('\n--- TEST 5: Media R2 QR ---');
  const r5 = await fetch(baseUrl + '/media/qr/cuenta-nequi-1.png');
  console.log('QR Image status:', r5.status, 'Content-Length:', r5.headers.get('content-length'));

  console.log('\n--- TEST 6: Media R2 Recibo ---');
  const sampleKey = recibos.data?.[0]?.r2_key;
  if (sampleKey) {
    const r6 = await fetch(baseUrl + '/media/' + sampleKey);
    console.log(`Recibo (${sampleKey}) status:`, r6.status, 'Content-Length:', r6.headers.get('content-length'));
  }
}

testAll().catch(console.error);

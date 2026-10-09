const bcrypt = require('bcryptjs');

if (!process.stdin.isTTY || !process.stdin.setRawMode) {
  console.error('Ejecuta este comando desde un terminal interactivo.');
  process.exit(1);
}

process.stdout.write('Contrasena nueva (entrada oculta): ');
process.stdin.setRawMode(true);
process.stdin.resume();
let password = '';
process.stdin.on('data', async (chunk) => {
  const key = chunk.toString('utf8');
  if (key === '\u0003') process.exit(130);
  if (key === '\r' || key === '\n') {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdout.write('\n');
    try {
      if (Buffer.byteLength(password) < 12) throw new Error('Usa al menos 12 bytes.');
      process.stdout.write(`${await bcrypt.hash(password, 12)}\n`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'No se pudo crear el hash.');
      process.exitCode = 1;
    } finally {
      password = '';
    }
    return;
  }
  if (key === '\u007f' || key === '\b') password = password.slice(0, -1);
  else if (key.length === 1 && key >= ' ') password += key;
});
/**
 * Validação isolada dos helpers de safety pós-fix 3 camadas (18/05).
 * Confirma:
 *  - isAmbienteReal() lê AMBIENTE_REAL corretamente
 *  - ehEmailFake() detecta padrões fake conhecidos
 *  - ehTelefoneFake() detecta padrões fake conhecidos
 */
require('dotenv').config();
const { isAmbienteReal } = require('../dist/src/common/safety/ambiente');
const { ehEmailFake, ehTelefoneFake, podeEnviarEmDev } = require('../dist/src/common/safety/whitelist-teste');

console.log('AMBIENTE_REAL env:', process.env.AMBIENTE_REAL);
console.log('isAmbienteReal():', isAmbienteReal());
console.log('');
const emails = {
  'derli-m80uuy-removido@removido.invalid': true,
  'test@example.com': true,
  'fake@gmail.com': true,
  'noreply@cooperebr.com': true,
  'lucbragatto@gmail.com': false,
  'lucbragatto+homologado@gmail.com': false,
  'algo@cooperebr.com.br': false,
};
console.log('=== ehEmailFake (esperado vs real) ===');
for (const [e, exp] of Object.entries(emails)) {
  const r = ehEmailFake(e);
  console.log(`  ${r === exp ? 'OK ' : 'FAIL'} ${e} -> exp=${exp} got=${r}`);
}
console.log('');
const tels = {
  '+5511000000000': true,
  '+5511999990000': true,
  '+5511199988xxxx': true,  // prefixo 551199988
  '+5527981341348': false,
  '27981341348': false,
  '+5511987654321': false,
  '+551100000000': true,  // 6+ zeros
  'INATIVO-1234': true,
  '': true,  // vazio = fail-safe
  '+551112345': true,  // muito curto
};
console.log('=== ehTelefoneFake (esperado vs real) ===');
for (const [t, exp] of Object.entries(tels)) {
  const r = ehTelefoneFake(t);
  console.log(`  ${r === exp ? 'OK ' : 'FAIL'} '${t}' -> exp=${exp} got=${r}`);
}
console.log('');
console.log('=== podeEnviarEmDev (com AMBIENTE_REAL=false) ===');
console.log(`  WA '27981341348' (whitelist): ${podeEnviarEmDev('27981341348', 'WA')}`);
console.log(`  WA '+5511999990000' (fake): ${podeEnviarEmDev('+5511999990000', 'WA')}`);
console.log(`  EMAIL 'lucbragatto+homologado@gmail.com' (whitelist): ${podeEnviarEmDev('lucbragatto+homologado@gmail.com', 'EMAIL')}`);
console.log(`  EMAIL 'lucbragatto+fase4banco@gmail.com' (NÃO whitelist): ${podeEnviarEmDev('lucbragatto+fase4banco@gmail.com', 'EMAIL')}`);

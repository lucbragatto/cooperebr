import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const hoje = new Date('2026-04-01T00:00:00-03:00');

// Busca todos os números únicos que receberam mensagem hoje
const msgs = await prisma.mensagemWhatsapp.findMany({
  where: { createdAt: { gte: hoje }, direcao: 'SAIDA' },
  select: { telefone: true },
});

const numeros = [...new Set(msgs.map(m => m.telefone))];
console.log(`Enviando desculpas para ${numeros.length} números...`);

const mensagem = `Olá! 👋

Pedimos desculpas pela mensagem enviada anteriormente.

Estamos passando por melhorias em nossos sistemas e a mensagem foi enviada por engano. Por gentileza, desconsidere o conteúdo anterior.

Em breve retornaremos com novidades! 🌱⚡

Atenciosamente,
*Equipe CoopereBR*`;

let ok = 0;
let erro = 0;

for (const numero of numeros) {
  try {
    const res = await fetch('http://localhost:3002/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: numero + '@s.whatsapp.net', text: mensagem }),

    });
    if (res.ok) {
      console.log(`✅ ${numero}`);
      ok++;
    } else {
      const txt = await res.text();
      console.log(`❌ ${numero}: ${txt}`);
      erro++;
    }
    // pequeno delay para não ser bloqueado pelo WhatsApp
    await new Promise(r => setTimeout(r, 2000));
  } catch (e) {
    console.log(`❌ ${numero}: ${e.message}`);
    erro++;
  }
}

console.log(`\nConcluído: ${ok} enviados, ${erro} erros`);
await prisma.$disconnect();

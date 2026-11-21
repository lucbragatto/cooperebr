import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  Check,
  Coins,
  Gift,
  KeyRound,
  LineChart,
  LockKeyhole,
  MessageCircle,
  QrCode,
  Receipt,
  ShieldCheck,
  Smartphone,
  Sun,
  Users,
  Zap,
} from 'lucide-react';
import SimuladorTokens from '@/components/clube/SimuladorTokens';

const CLIENTE_URL = 'https://cliente.clube.cooperebr.com.br';
const ENTRAR_URL = `${CLIENTE_URL}/entrar`;
const LOGIN_URL = `${CLIENTE_URL}/login`;

const passos = [
  {
    titulo: 'Entre pelo WhatsApp',
    texto: 'Informe seu nome e celular. A gente orienta a adesão como cooperado, com ou sem conta de energia.',
    icon: MessageCircle,
  },
  {
    titulo: 'Receba em tokens',
    texto: 'Até 20% do valor da sua fatura volta todo mês como CooperTokens no seu saldo.',
    icon: Coins,
  },
  {
    titulo: 'Use nos parceiros',
    texto: 'Pague por QR Code no comércio parceiro, abata cobranças ou libere ofertas do clube.',
    icon: QrCode,
  },
];

const usos = [
  { titulo: 'Pagar nos parceiros', texto: 'QR Code em estabelecimentos da rede do clube.', icon: QrCode },
  { titulo: 'Abater cobranças', texto: 'Use o saldo para reduzir valores no portal.', icon: Receipt },
  { titulo: 'Ofertas do clube', texto: 'Campanhas e resgates liberados por tokens.', icon: Gift },
  { titulo: 'Indicar e subir de nível', texto: 'Indicações alimentam ranking, níveis e recompensas.', icon: Users },
];

const portal = [
  { label: 'Saldo e extrato de tokens', icon: Coins },
  { label: 'Créditos de energia', icon: Zap },
  { label: 'Minhas cobranças', icon: Receipt },
  { label: 'Indicações e ranking', icon: LineChart },
  { label: 'Segurança com PIN', icon: LockKeyhole },
];

const empresas = [
  {
    titulo: 'A empresa vira cooperada',
    texto: 'Cadastro como cooperado PJ e convênio com a cooperativa, tudo pelo sistema.',
  },
  {
    titulo: 'Compra tokens para o time',
    texto: 'Os tokens viram benefício para funcionários e clientes, distribuídos em lote.',
  },
  {
    titulo: 'Convite com um link',
    texto: 'Cada pessoa entra pelo convite da empresa e já cai no clube com o benefício.',
  },
];

const perguntas = [
  {
    p: 'Preciso fazer obra ou instalar placas?',
    r: 'Não. A energia é solar compartilhada: não precisa de telhado, obra nem investimento inicial.',
  },
  {
    p: 'Quem pode participar do clube?',
    r: 'Quem se cadastra como cooperado da COOPERE-BR, com ou sem conta de energia. Sem conta, você participa por meio de empresas e convênios que distribuem tokens.',
  },
  {
    p: 'Já sou cliente da COOPERE-BR. Preciso de outro cadastro?',
    r: 'Não. Entre com o mesmo celular ou e-mail do app COOPERE-BR. Você recebe um código e seu cadastro do clube é criado na hora.',
  },
  {
    p: 'Prefiro desconto direto na fatura. Ainda existe?',
    r: 'Sim. O clube destaca os tokens, mas quem preferir pode optar pelo desconto direto.',
  },
];

function Anel({ className = '' }: { className?: string }) {
  return (
    <div className={`relative aspect-square shrink-0 ${className}`} aria-hidden="true">
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: 'conic-gradient(#d7ff65 0deg 72deg, rgba(255,255,255,0.10) 72deg 360deg)' }}
      />
      <div className="absolute inset-[8%] flex flex-col items-center justify-center rounded-full bg-[#101510] text-white">
        <Sun className="h-5 w-5 text-[#d7ff65]" />
        <span className="mt-0.5 text-2xl font-bold">até 20%</span>
        <span className="text-[11px] text-[#a9b3a4]">da fatura em tokens</span>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f5f7f2] text-[#101510]">
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#101510] text-white">
        <div
          className="absolute inset-0 opacity-45"
          style={{
            backgroundImage:
              "linear-gradient(115deg, rgba(16,21,16,1) 0%, rgba(16,21,16,0.9) 50%, rgba(16,21,16,0.55) 100%), url('https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=2400&q=80')",
            backgroundPosition: 'center',
            backgroundSize: 'cover',
          }}
          aria-hidden="true"
        />

        <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Clube COOPERE-BR, início">
            <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-white">
              <Image
                src="/brand/logo-cooperebr.jpg"
                alt=""
                width={44}
                height={44}
                priority
                className="h-full w-full object-cover"
              />
            </span>
            <span className="leading-tight">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a9b3a4]">
                COOPERE-BR
              </span>
              <span className="block text-base font-semibold">Clube Solar</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-white/75 md:flex" aria-label="Seções">
            <a href="#como-funciona" className="hover:text-white">Como funciona</a>
            <a href="#onde-usar" className="hover:text-white">Onde usar</a>
            <a href="#empresas" className="hover:text-white">Empresas</a>
            <a href="#duvidas" className="hover:text-white">Dúvidas</a>
          </nav>

          <Link
            href={LOGIN_URL}
            className="inline-flex h-11 items-center justify-center rounded-full border border-white/30 px-5 text-sm font-semibold transition hover:bg-white hover:text-[#101510]"
          >
            Entrar
          </Link>
        </header>

        <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-10 px-5 pb-16 pt-6 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14 lg:pb-24 lg:pt-12">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white/85">
              <ShieldCheck className="h-4 w-4 text-[#d7ff65]" aria-hidden="true" />
              Mesmo acesso do app COOPERE-BR · sem senha
            </p>
            <h1 className="mt-6 text-[40px] font-semibold leading-[1.02] sm:text-6xl lg:text-7xl">
              Sua energia virou benefício.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#c4ccbf] sm:text-xl">
              Até 20% da sua fatura de energia volta todo mês em CooperTokens para usar nos parceiros do
              clube. Energia solar compartilhada, sem obra e sem investimento.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={ENTRAR_URL}
                className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-[#d7ff65] px-8 text-base font-semibold text-[#102012] transition hover:bg-white"
              >
                Quero participar
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={LOGIN_URL}
                className="inline-flex h-14 items-center justify-center rounded-full border border-white/30 px-8 text-base font-semibold transition hover:bg-white hover:text-[#101510]"
              >
                Já sou cooperado
              </Link>
            </div>

            <ul className="mt-10 grid max-w-xl grid-cols-1 gap-2.5 text-sm sm:grid-cols-3">
              {[
                { icon: Sun, t: 'Sem obra no imóvel' },
                { icon: Coins, t: 'Tokens todo mês' },
                { icon: Smartphone, t: 'Tudo pelo celular' },
              ].map(({ icon: Icon, t }) => (
                <li key={t} className="flex items-center gap-2.5 rounded-2xl border border-white/15 px-4 py-3">
                  <Icon className="h-5 w-5 shrink-0 text-[#d7ff65]" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="mx-auto w-full max-w-md lg:ml-auto">
            <SimuladorTokens entrarUrl={ENTRAR_URL} />
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#5b6c50]">Como funciona</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
              Três passos e sua conta de luz começa a render.
            </h2>
          </div>
          <Anel className="hidden w-36 sm:block" />
        </div>

        <ol className="mt-10 grid gap-3 md:grid-cols-3">
          {passos.map((p, i) => {
            const Icon = p.icon;
            return (
              <li key={p.titulo} className="rounded-3xl border border-[#dce2d4] bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#101510]">
                    <Icon className="h-5 w-5 text-[#d7ff65]" aria-hidden="true" />
                  </span>
                  <span className="text-5xl font-semibold text-[#dfe5d8]" aria-hidden="true">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-6 text-xl font-semibold">{p.titulo}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[#4b5546]">{p.texto}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Onde usar */}
      <section id="onde-usar" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#5b6c50]">CooperToken</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
              O benefício aparece, acumula e vira uso.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#4b5546]">
              Seus tokens circulam numa rede local de parceiros. Operações sensíveis são protegidas por PIN.
            </p>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {usos.map((u) => {
              const Icon = u.icon;
              return (
                <article
                  key={u.titulo}
                  className="group rounded-3xl border border-[#dce2d4] bg-[#f5f7f2] p-6 transition hover:-translate-y-1 hover:border-[#101510] hover:bg-white"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#d7ff65]">
                    <Icon className="h-5 w-5 text-[#102012]" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">{u.titulo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#4b5546]">{u.texto}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Portal */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <div className="grid items-center gap-10 overflow-hidden rounded-[32px] bg-[#101510] p-6 text-white sm:p-10 lg:grid-cols-[1fr_auto] lg:p-14">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d7ff65]">Portal do cooperado</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">Tudo visível no seu celular.</h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-[#c4ccbf]">
              Entre com o celular, receba um código e acompanhe seu saldo, sua energia e suas indicações.
            </p>
            <ul className="mt-8 grid gap-2.5 sm:grid-cols-2">
              {portal.map(({ label, icon: Icon }) => (
                <li key={label} className="flex items-center gap-3 rounded-2xl border border-white/15 px-4 py-3.5 text-sm">
                  <Icon className="h-5 w-5 shrink-0 text-[#d7ff65]" aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>
            <Link
              href={LOGIN_URL}
              className="mt-8 inline-flex h-14 items-center justify-center gap-2 rounded-full bg-[#d7ff65] px-8 text-base font-semibold text-[#102012] transition hover:bg-white"
            >
              <KeyRound className="h-4 w-4" />
              Entrar com código
            </Link>
          </div>

          {/* Mock do celular */}
          <div className="mx-auto w-full max-w-[300px] rounded-[40px] border-[10px] border-[#262c25] bg-[#f5f7f2] p-4 text-[#101510]" aria-hidden="true">
            <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-[#cfd6c8]" />
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5b6656]">Meu clube</p>
            <div className="mt-3 rounded-2xl bg-[#101510] p-4 text-white">
              <p className="text-xs text-[#a9b3a4]">Saldo de CooperTokens</p>
              <p className="mt-1 text-3xl font-semibold tracking-widest">••••</p>
              <div className="mt-3 h-1.5 rounded-full bg-white/15">
                <div className="h-1.5 w-3/5 rounded-full bg-[#d7ff65]" />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-white p-3">
                <QrCode className="h-4 w-4 text-[#166534]" />
                <p className="mt-2 text-xs font-semibold">Pagar parceiro</p>
              </div>
              <div className="rounded-2xl bg-white p-3">
                <Receipt className="h-4 w-4 text-[#166534]" />
                <p className="mt-2 text-xs font-semibold">Abater cobrança</p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between rounded-2xl bg-white p-3">
              <span className="text-xs font-semibold">Próximo benefício</span>
              <Gift className="h-4 w-4 text-[#166534]" />
            </div>
          </div>
        </div>
      </section>

      {/* Empresas */}
      <section id="empresas" className="bg-[#eef2e8] py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#5b6c50]">Para empresas e convênios</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
              Benefício para o seu time, mesmo sem conta de energia.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#4b5546]">
              Empresas, condomínios e redes compram tokens e distribuem para funcionários e clientes, que
              entram no clube como cooperados.
            </p>
          </div>

          <ol className="mt-10 grid gap-3 md:grid-cols-3">
            {empresas.map((e, i) => (
              <li key={e.titulo} className="rounded-3xl border border-[#d7ded0] bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#101510]">
                    <Building2 className="h-5 w-5 text-[#d7ff65]" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-semibold text-[#5b6656]">Etapa {i + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{e.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#4b5546]">{e.texto}</p>
              </li>
            ))}
          </ol>

          <Link
            href={ENTRAR_URL}
            className="mt-8 inline-flex h-14 items-center justify-center gap-2 rounded-full bg-[#101510] px-8 text-base font-semibold text-white transition hover:bg-black"
          >
            Quero levar para minha empresa
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Dúvidas */}
      <section id="duvidas" className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#5b6c50]">Dúvidas</p>
        <h2 className="mt-3 text-4xl font-semibold leading-tight">Perguntas frequentes</h2>
        <div className="mt-8 divide-y divide-[#dce2d4] border-y border-[#dce2d4]">
          {perguntas.map((q) => (
            <details key={q.p} className="group py-5">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                {q.p}
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#dce2d4] text-xl leading-none transition group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="mt-3 text-[15px] leading-relaxed text-[#4b5546]">{q.r}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-[#101510] px-5 py-16 text-white sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div className="flex items-center gap-6">
            <Anel className="hidden w-28 sm:block" />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d7ff65]">Clube COOPERE-BR</p>
              <h2 className="mt-2 max-w-xl text-3xl font-semibold leading-tight sm:text-4xl">
                Energia limpa como porta de entrada para uma rede de benefícios.
              </h2>
            </div>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link
              href={ENTRAR_URL}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-[#d7ff65] px-8 text-base font-semibold text-[#102012] transition hover:bg-white"
            >
              Começar cadastro
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={LOGIN_URL}
              className="inline-flex h-14 items-center justify-center rounded-full border border-white/30 px-8 text-base font-semibold transition hover:bg-white hover:text-[#101510]"
            >
              Entrar
            </Link>
          </div>
        </div>
        <div className="mx-auto mt-12 flex max-w-7xl flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-[#a9b3a4]">
          <span>© COOPERE-BR · Clube Solar</span>
          <span className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-[#d7ff65]" aria-hidden="true" />
            Acesso com código por SMS ou e-mail
          </span>
        </div>
      </section>
    </main>
  );
}

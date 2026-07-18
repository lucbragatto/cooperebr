import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  Check,
  Coins,
  Gift,
  Leaf,
  LineChart,
  LockKeyhole,
  MessageCircle,
  QrCode,
  Receipt,
  Sparkles,
  Sun,
  TrendingDown,
  Users,
  WalletCards,
  Zap,
} from 'lucide-react';

const CLIENTE_URL = 'https://cliente.clube.cooperebr.com.br';

const pilares = [
  {
    titulo: 'Economia solar',
    texto: 'Energia compartilhada para reduzir a conta de luz sem obra, sem telhado e sem investimento inicial.',
    icon: Sun,
  },
  {
    titulo: 'Beneficio do jeito do cliente',
    texto: 'O membro pode receber desconto direto ou transformar parte do valor em CooperTokens para usar no clube.',
    icon: WalletCards,
  },
  {
    titulo: 'Rede de parceiros',
    texto: 'Tokens viram descontos, QR Code e resgates em estabelecimentos e campanhas configuradas pela cooperativa.',
    icon: QrCode,
  },
  {
    titulo: 'Impacto mensuravel',
    texto: 'O portal mostra faturas, creditos de energia, historico, beneficios e evolucao do relacionamento.',
    icon: LineChart,
  },
];

const beneficiosCliente = [
  'Desconto na fatura de energia',
  'CooperTokens para abater cobrancas',
  'Pagamento por QR Code em parceiros',
  'Ofertas e resgates no Clube de Vantagens',
  'Ranking, niveis e progressao por indicacoes',
  'Cadastro e acompanhamento pelo WhatsApp',
];

const jornada = [
  {
    titulo: 'Entrar',
    texto: 'O cliente inicia pelo WhatsApp, informa consumo e recebe orientacao para aderir ao clube.',
    icon: MessageCircle,
  },
  {
    titulo: 'Economizar',
    texto: 'A energia solar compartilhada gera creditos que reduzem o custo mensal de energia.',
    icon: TrendingDown,
  },
  {
    titulo: 'Usar beneficios',
    texto: 'Tokens podem abater faturas, pagar parceiros por QR Code ou liberar ofertas do clube.',
    icon: Gift,
  },
  {
    titulo: 'Crescer na rede',
    texto: 'Indicacoes e campanhas alimentam niveis, ranking e recompensas para quem participa mais.',
    icon: Users,
  },
];

const operacao = [
  {
    titulo: 'Planos flexiveis',
    texto: 'O sistema permite plano gratuito ou pago, individual ou custeado por convenio empresarial.',
  },
  {
    titulo: 'Controle financeiro',
    texto: 'Cobrancas, desconto por token, resgates, PIX e conciliacao ficam registrados no fluxo operacional.',
  },
  {
    titulo: 'Seguranca por PIN',
    texto: 'Operacoes sensiveis de token exigem PIN, limites e validacoes para proteger saldo e resgate.',
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f5f7f2] text-[#101510]">
      <section className="relative overflow-hidden bg-[#101510] text-white">
        <div
          className="absolute inset-0 opacity-62"
          style={{
            backgroundImage:
              "linear-gradient(118deg, rgba(16,21,16,0.98) 0%, rgba(16,21,16,0.86) 46%, rgba(16,21,16,0.24) 100%), url('https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=2400&q=86')",
            backgroundPosition: 'center',
            backgroundSize: 'cover',
          }}
        />

        <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Clube COOPERE-BR">
            <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white">
              <Image
                src="/brand/logo-cooperebr.jpg"
                alt="Logo COOPERE-BR"
                width={44}
                height={44}
                priority
                className="h-full w-full object-cover"
              />
            </span>
            <span>
              <span className="block text-sm font-semibold uppercase tracking-[0.18em] text-white/64">
                COOPERE-BR
              </span>
              <span className="block text-base font-semibold">Clube Solar</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-white/72 md:flex">
            <a href="#beneficios" className="transition hover:text-white">
              Beneficios
            </a>
            <a href="#tokens" className="transition hover:text-white">
              CooperTokens
            </a>
            <a href="#empresas" className="transition hover:text-white">
              Empresas
            </a>
          </nav>

          <Link
            href={`${CLIENTE_URL}/login`}
            className="inline-flex h-10 items-center justify-center rounded-full border border-white/28 px-5 text-sm font-medium text-white transition hover:bg-white hover:text-[#111814]"
          >
            Acessar
          </Link>
        </header>

        <div className="relative z-10 mx-auto grid min-h-[calc(100vh-88px)] w-full max-w-7xl grid-cols-1 items-center gap-12 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="max-w-3xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/8 px-4 py-2 text-sm text-white/78 backdrop-blur">
              <Sparkles className="h-4 w-4 text-[#d7ff65]" />
              Energia limpa, economia e beneficios em uma unica assinatura
            </p>

            <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] tracking-normal text-white sm:text-6xl lg:text-7xl">
              Um clube solar que devolve valor todo mes.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/74 sm:text-xl">
              O cliente economiza energia, acompanha tudo pelo portal e escolhe como quer receber
              beneficio: desconto direto, CooperTokens, ofertas, parceiros e indicacoes.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href={`${CLIENTE_URL}/entrar`}
                className="inline-flex h-12 items-center justify-center rounded-full bg-[#d7ff65] px-7 text-sm font-semibold text-[#102012] transition hover:bg-white"
              >
                Quero participar
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href={`${CLIENTE_URL}/login`}
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/24 px-7 text-sm font-semibold text-white transition hover:bg-white hover:text-[#111814]"
              >
                Ja sou cliente
              </Link>
            </div>

            <div className="mt-10 grid max-w-2xl grid-cols-3 divide-x divide-white/16 border-y border-white/16 py-5">
              <div className="pr-4">
                <strong className="block text-2xl font-semibold">0</strong>
                <span className="mt-1 block text-xs leading-5 text-white/58">obra no imovel</span>
              </div>
              <div className="px-4">
                <strong className="block text-2xl font-semibold">2</strong>
                <span className="mt-1 block text-xs leading-5 text-white/58">formas de beneficio</span>
              </div>
              <div className="pl-4">
                <strong className="block text-2xl font-semibold">24h</strong>
                <span className="mt-1 block text-xs leading-5 text-white/58">portal e historico</span>
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-md lg:ml-auto">
            <div className="overflow-hidden rounded-lg border border-white/18 bg-white text-[#101510] shadow-2xl">
              <div className="border-b border-[#dfe5d8] bg-[#f7f9f4] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#667062]">
                      Meu Clube
                    </p>
                    <h2 className="mt-1 text-xl font-semibold">Resumo do mes</h2>
                  </div>
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-[#101510] text-[#d7ff65]">
                    <Leaf className="h-5 w-5" />
                  </span>
                </div>
              </div>

              <div className="space-y-3 p-4">
                <div className="rounded-lg bg-[#101510] p-4 text-white">
                  <p className="text-sm text-white/62">Economia solar estimada</p>
                  <div className="mt-3 flex items-end justify-between gap-4">
                    <p className="text-4xl font-semibold">ate 20%</p>
                    <span className="rounded-full bg-[#d7ff65] px-3 py-1 text-xs font-semibold text-[#102012]">
                      elegivel
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-[#dfe5d8] bg-[#f7f9f4] p-3">
                    <Coins className="h-4 w-4 text-[#166534]" />
                    <p className="mt-3 text-xs text-[#667062]">CooperTokens</p>
                    <p className="mt-1 text-lg font-semibold">saldo util</p>
                  </div>
                  <div className="rounded-lg border border-[#dfe5d8] bg-[#f7f9f4] p-3">
                    <Receipt className="h-4 w-4 text-[#166534]" />
                    <p className="mt-3 text-xs text-[#667062]">Fatura</p>
                    <p className="mt-1 text-lg font-semibold">abater valor</p>
                  </div>
                </div>

                <div className="rounded-lg border border-[#dfe5d8] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">Proximo beneficio</p>
                      <p className="mt-1 text-sm text-[#667062]">Oferta local liberada por tokens</p>
                    </div>
                    <Gift className="h-5 w-5 text-[#166534]" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs text-[#667062]">
                  <span className="rounded-md bg-[#eef4e7] px-2 py-2">PIN</span>
                  <span className="rounded-md bg-[#eef4e7] px-2 py-2">QR Code</span>
                  <span className="rounded-md bg-[#eef4e7] px-2 py-2">Ranking</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="beneficios" className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#5b6c50]">
              Beneficio real
            </p>
            <h2 className="mt-4 text-4xl font-semibold leading-tight text-[#101510] sm:text-5xl">
              Sustentavel porque reduz desperdicio. Inovador porque transforma economia em uso.
            </h2>
            <p className="mt-5 text-base leading-8 text-[#667062]">
              A proposta do clube e simples: o cliente participa de energia solar compartilhada,
              recebe vantagem financeira e passa a ter uma moeda de relacionamento para circular
              dentro de uma rede local.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {pilares.map((pilar) => {
              const Icon = pilar.icon;
              return (
                <article key={pilar.titulo} className="rounded-lg border border-[#dce2d4] bg-white p-5 shadow-sm">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-[#eef8df] text-[#166534]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{pilar.titulo}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#667062]">{pilar.texto}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="tokens" className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#5b6c50]">
              CooperToken
            </p>
            <h2 className="mt-4 text-4xl font-semibold leading-tight text-[#101510] sm:text-5xl">
              O beneficio nao fica escondido. Ele aparece, acumula e pode ser usado.
            </h2>
            <p className="mt-5 text-base leading-8 text-[#667062]">
              O sistema ja permite saldo, extrato, abatimento de fatura, QR Code em parceiro,
              ofertas do Clube de Vantagens, resgate e operacoes protegidas por PIN.
            </p>

            <div className="mt-8 grid gap-2">
              {beneficiosCliente.map((item) => (
                <div key={item} className="flex items-center gap-3 border-t border-[#dce2d4] py-3">
                  <Check className="h-4 w-4 shrink-0 text-[#166534]" />
                  <p className="text-sm font-medium text-[#253126]">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            {jornada.map((item, index) => {
              const Icon = item.icon;
              return (
                <article key={item.titulo} className="grid grid-cols-[auto_1fr] gap-4 rounded-lg border border-[#dce2d4] bg-[#f7f9f4] p-5">
                  <div className="grid h-11 w-11 place-items-center rounded-md bg-[#101510] text-[#d7ff65]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a9385]">
                      passo {index + 1}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold">{item.titulo}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#667062]">{item.texto}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <div className="overflow-hidden rounded-lg bg-[#101510] text-white">
          <div className="grid gap-10 p-6 sm:p-8 lg:grid-cols-[0.9fr_1.1fr] lg:p-10">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d7ff65]">
                Portal do membro
              </p>
              <h2 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
                Tudo que importa fica visivel no celular.
              </h2>
              <p className="mt-5 text-base leading-8 text-white/68">
                Financeiro, creditos de energia, CooperTokens, faturas, indicacoes, seguranca e
                documentos ficam em uma experiencia direta para consulta recorrente.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Creditos de energia', icon: Zap },
                { label: 'Minhas cobrancas', icon: Receipt },
                { label: 'Clube de vantagens', icon: Gift },
                { label: 'Seguranca e PIN', icon: LockKeyhole },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-lg border border-white/14 bg-white/8 p-4">
                    <Icon className="h-5 w-5 text-[#d7ff65]" />
                    <p className="mt-4 text-sm font-semibold text-white/88">{item.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="empresas" className="bg-[#eef2e8] py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mb-10 max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#5b6c50]">
              Para empresas e convenios
            </p>
            <h2 className="mt-4 text-4xl font-semibold leading-tight text-[#101510] sm:text-5xl">
              Um beneficio corporativo com energia, comunidade e controle.
            </h2>
            <p className="mt-5 text-base leading-8 text-[#667062]">
              O clube tambem funciona como vantagem para colaboradores, condominios, empresas e
              redes parceiras, com custeio por convenio e distribuicao de tokens.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {operacao.map((item) => (
              <article key={item.titulo} className="rounded-lg border border-[#d7ded0] bg-white p-6 shadow-sm">
                <Building2 className="h-5 w-5 text-[#166534]" />
                <h3 className="mt-5 text-lg font-semibold">{item.titulo}</h3>
                <p className="mt-3 text-sm leading-6 text-[#667062]">{item.texto}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#101510] px-5 py-16 text-white sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d7ff65]">
              Clube COOPERE-BR
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">
              Energia limpa como porta de entrada para uma rede de beneficios.
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={`${CLIENTE_URL}/entrar`}
              className="inline-flex h-12 items-center justify-center rounded-full bg-[#d7ff65] px-7 text-sm font-semibold text-[#102012] transition hover:bg-white"
            >
              Comecar cadastro
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link
              href={`${CLIENTE_URL}/login`}
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/24 px-7 text-sm font-semibold text-white transition hover:bg-white hover:text-[#111814]"
            >
              Acessar sistema
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

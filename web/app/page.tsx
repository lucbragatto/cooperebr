import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Coins,
  Leaf,
  LockKeyhole,
  Sparkles,
  Sun,
  TrendingDown,
  WalletCards,
  Zap,
} from 'lucide-react';

const CLIENTE_URL = 'https://cliente.clube.cooperebr.com.br';

const beneficios = [
  {
    titulo: 'Energia sem obra',
    texto: 'Participe de uma estrutura compartilhada, sem instalar placas no telhado.',
    icon: Sun,
  },
  {
    titulo: 'Clube de vantagens',
    texto: 'Assinatura com acesso a beneficios, parceiros e experiencias conectadas ao consumo.',
    icon: BadgeCheck,
  },
  {
    titulo: 'Tokens de relacionamento',
    texto: 'Use Cooper Tokens para organizar beneficios, indicacoes, recompensas e campanhas.',
    icon: Coins,
  },
  {
    titulo: 'Jornada digital',
    texto: 'Cadastro, acompanhamento e comunicacao em uma experiencia simples pelo portal.',
    icon: WalletCards,
  },
];

const etapas = [
  'Simule seu perfil de consumo',
  'Escolha o plano do clube',
  'Receba beneficios e acompanhe tudo online',
];

const modelosAdesao = [
  {
    titulo: 'Plano configuravel',
    destaque: 'por cooperativa',
    texto: 'Cada cooperativa define nome, descricao, valor mensal, status e se o plano cobra ou nao cobra mensalidade.',
  },
  {
    titulo: 'Clube gratis ou pago',
    destaque: 'cobra: sim/nao',
    texto: 'Quando cobra, a mensalidade entra separada na cobranca. Quando nao cobra, o membro participa sem linha adicional.',
  },
  {
    titulo: 'Individual ou convenio',
    destaque: 'cliente ou empresa',
    texto: 'O cooperado pode aderir individualmente; em convenio, a empresa pode custear todos os membros ativos.',
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f8f3] text-[#111814]">
      <section className="relative min-h-[92vh] overflow-hidden bg-[#101510] text-white">
        <div className="absolute inset-0">
          <div
            className="h-full w-full bg-cover bg-center"
            style={{
              backgroundImage:
                "linear-gradient(115deg, rgba(16,21,16,0.96) 0%, rgba(16,21,16,0.78) 42%, rgba(16,21,16,0.24) 100%), url('https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=2200&q=85')",
            }}
          />
        </div>

        <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Clube COOPERE-BR">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#166534]">
              <Sun className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold uppercase tracking-[0.18em] text-white/62">
                COOPERE-BR
              </span>
              <span className="block text-base font-semibold">Clube Solar</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-white/74 md:flex">
            <a href="#beneficios" className="transition hover:text-white">
              Beneficios
            </a>
            <a href="#tokens" className="transition hover:text-white">
              Tokens
            </a>
            <a href="#planos" className="transition hover:text-white">
              Planos
            </a>
          </nav>

          <Link
            href={`${CLIENTE_URL}/login`}
            className="inline-flex h-10 items-center justify-center rounded-full border border-white/28 px-5 text-sm font-medium text-white transition hover:bg-white hover:text-[#111814]"
          >
            Acessar
          </Link>
        </header>

        <div className="relative z-10 mx-auto grid min-h-[calc(92vh-84px)] w-full max-w-7xl grid-cols-1 items-center gap-10 px-5 pb-14 pt-8 sm:px-8 lg:grid-cols-[1.03fr_0.97fr]">
          <div className="max-w-3xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/8 px-4 py-2 text-sm text-white/76 backdrop-blur">
              <Sparkles className="h-4 w-4 text-[#b7f27a]" />
              Energia solar, clube de beneficios e tokenizacao em uma unica jornada
            </p>

            <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] tracking-normal text-white sm:text-6xl lg:text-7xl">
              O clube que transforma economia de energia em beneficios reais.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/74 sm:text-xl">
              Entre em uma experiencia de energia compartilhada, sem investimento inicial,
              com planos de assinatura, recompensas e Cooper Tokens para movimentar uma rede de
              parceiros.
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
                <span className="mt-1 block text-xs leading-5 text-white/56">obra no imovel</span>
              </div>
              <div className="px-4">
                <strong className="block text-2xl font-semibold">20%</strong>
                <span className="mt-1 block text-xs leading-5 text-white/56">potencial de economia</span>
              </div>
              <div className="pl-4">
                <strong className="block text-2xl font-semibold">24h</strong>
                <span className="mt-1 block text-xs leading-5 text-white/56">portal sempre disponivel</span>
              </div>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:ml-auto">
            <div className="rounded-[2rem] border border-white/18 bg-white/12 p-3 shadow-2xl backdrop-blur-xl">
              <div className="rounded-[1.45rem] bg-[#f7f8f3] p-4 text-[#111814] shadow-2xl">
                <div className="flex items-center justify-between border-b border-[#dfe3d4] pb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64715b]">
                      Simulacao clube
                    </p>
                    <h2 className="mt-1 text-xl font-semibold">Plano Solar+</h2>
                  </div>
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-[#0f1f13] text-[#d7ff65]">
                    <Zap className="h-5 w-5" />
                  </span>
                </div>

                <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-[#697464]">Conta media mensal</p>
                      <p className="mt-1 text-3xl font-semibold">R$ 420</p>
                    </div>
                    <div className="rounded-full bg-[#eef8df] px-3 py-1 text-xs font-semibold text-[#166534]">
                      elegivel
                    </div>
                  </div>

                  <div className="mt-6 h-3 rounded-full bg-[#e7eadf]">
                    <div className="h-3 w-[68%] rounded-full bg-[#166534]" />
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-[#f3f5ed] p-3">
                      <TrendingDown className="h-4 w-4 text-[#166534]" />
                      <p className="mt-3 text-xs text-[#697464]">economia estimada</p>
                      <p className="mt-1 text-lg font-semibold">ate R$ 84/mes</p>
                    </div>
                    <div className="rounded-xl bg-[#f3f5ed] p-3">
                      <Coins className="h-4 w-4 text-[#166534]" />
                      <p className="mt-3 text-xs text-[#697464]">tokens potenciais</p>
                      <p className="mt-1 text-lg font-semibold">+ 240/mes</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-[#101510] p-4 text-white">
                  <p className="text-sm text-white/62">Proximo beneficio</p>
                  <div className="mt-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold">Cashback em parceiro local</p>
                      <p className="mt-1 text-sm text-white/52">resgate com Cooper Tokens</p>
                    </div>
                    <span className="rounded-full bg-[#d7ff65] px-3 py-1 text-sm font-semibold text-[#102012]">
                      ativo
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="beneficios" className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#5b6c50]">
            O que atrai em 2027
          </p>
          <h2 className="mt-4 text-4xl font-semibold leading-tight text-[#101510] sm:text-5xl">
            Valor claro, recompensa imediata e uma marca que parece simples de confiar.
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {beneficios.map((beneficio) => {
            const Icon = beneficio.icon;
            return (
              <article key={beneficio.titulo} className="rounded-2xl border border-[#dce2d4] bg-white p-5 shadow-sm">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-[#eef8df] text-[#166534]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{beneficio.titulo}</h3>
                <p className="mt-2 text-sm leading-6 text-[#667062]">{beneficio.texto}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="tokens" className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[2rem] bg-[#101510] p-6 text-white">
            <div className="grid gap-3">
              {etapas.map((etapa, index) => (
                <div key={etapa} className="flex items-center gap-4 rounded-2xl bg-white/8 p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#d7ff65] text-sm font-semibold text-[#102012]">
                    {index + 1}
                  </span>
                  <p className="text-sm font-medium text-white/86">{etapa}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#5b6c50]">
              Cooper Token
            </p>
            <h2 className="mt-4 text-4xl font-semibold leading-tight text-[#101510] sm:text-5xl">
              Token como ponte entre energia, beneficios e parceiros.
            </h2>
            <p className="mt-5 text-base leading-8 text-[#667062]">
              O token deixa o beneficio visivel: indicacoes, campanhas, descontos, resgates e
              vantagens podem virar uma unidade simples de acompanhar. Para o cliente, parece
              clube. Para a operacao, vira inteligencia de relacionamento.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="border-t border-[#dce2d4] pt-4">
                <Leaf className="h-5 w-5 text-[#166534]" />
                <p className="mt-3 text-sm font-semibold">Proposito</p>
              </div>
              <div className="border-t border-[#dce2d4] pt-4">
                <LockKeyhole className="h-5 w-5 text-[#166534]" />
                <p className="mt-3 text-sm font-semibold">Rastreabilidade</p>
              </div>
              <div className="border-t border-[#dce2d4] pt-4">
                <Building2 className="h-5 w-5 text-[#166534]" />
                <p className="mt-3 text-sm font-semibold">Rede local</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="planos" className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#5b6c50]">
              Assinatura
            </p>
            <h2 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight text-[#101510] sm:text-5xl">
              Planos do clube configurados conforme cada parceria.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#667062]">
              O sistema nao trabalha com uma tabela publica fixa. O valor e as regras do plano
              sao definidos no painel, por cooperativa ou convenio, e aparecem discriminados na
              cobranca quando houver mensalidade.
            </p>
          </div>
          <Link
            href={`${CLIENTE_URL}/entrar`}
            className="inline-flex h-12 items-center justify-center rounded-full bg-[#101510] px-7 text-sm font-semibold text-white transition hover:bg-[#253126]"
          >
            Comecar cadastro
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {modelosAdesao.map((modelo) => (
            <article key={modelo.titulo} className="rounded-2xl border border-[#dce2d4] bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-[#5b6c50]">{modelo.titulo}</p>
              <p className="mt-4 text-3xl font-semibold text-[#101510]">{modelo.destaque}</p>
              <p className="mt-3 min-h-20 text-sm leading-6 text-[#667062]">{modelo.texto}</p>
              <div className="mt-6 h-px bg-[#dce2d4]" />
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[#8a9385]">
                beneficios e tiers ajustaveis no painel
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[#101510] px-5 py-16 text-white sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d7ff65]">
              Clube COOPERE-BR
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">
              A porta de entrada para economia, comunidade e beneficios solares.
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={`${CLIENTE_URL}/entrar`}
              className="inline-flex h-12 items-center justify-center rounded-full bg-[#d7ff65] px-7 text-sm font-semibold text-[#102012] transition hover:bg-white"
            >
              Cadastrar
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

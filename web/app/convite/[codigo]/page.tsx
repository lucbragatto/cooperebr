'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';

interface ConviteData {
  valido: boolean;
  nomeIndicador?: string;
}

export default function ConvitePage() {
  const { codigo } = useParams<{ codigo: string }>();
  const [convite, setConvite] = useState<ConviteData | null>(null);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState('');
  const [conta, setConta] = useState(300);
  const [descontoPercentual, setDescontoPercentual] = useState(0.20);

  useEffect(() => {
    api.get(`/publico/convite/${codigo}`)
      .then(r => setConvite(r.data))
      .catch(() => setConvite({ valido: false }));
    api.get('/publico/desconto-padrao')
      .then(r => {
        if (r.data?.percentual > 0) setDescontoPercentual(r.data.percentual);
      })
      .catch(() => {});
  }, [codigo]);

  const economia = Math.round(conta * descontoPercentual);
  const economiaAno = economia * 12;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !telefone.trim()) {
      setErro('Nome e telefone são obrigatórios.');
      return;
    }
    setEnviando(true);
    setErro('');
    try {
      await api.post('/publico/iniciar-cadastro', {
        nome: nome.trim(),
        telefone: telefone.trim(),
        codigoRef: codigo,
      });
      setSucesso(true);
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Erro ao enviar. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  if (!convite) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner} />
        <p style={{ color: '#aaa', fontSize: 13, marginTop: 16 }}>Carregando convite…</p>
      </div>
    );
  }

  if (!convite.valido) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center', padding: '40px 24px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <h2 style={{ color: '#1a1a1a', fontSize: 20, marginBottom: 8 }}>Link inválido</h2>
            <p style={{ color: '#888', fontSize: 13 }}>Este convite não existe ou expirou.</p>
          </div>
        </div>
      </div>
    );
  }

  if (sucesso) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ ...styles.header, textAlign: 'center', padding: '40px 28px' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
            <h2 style={{ color: 'white', fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
              Mensagem enviada!
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 1.6 }}>
              Verifique seu WhatsApp — nossa equipe já está te aguardando para iniciar a simulação gratuita.
            </p>
          </div>
          <div style={{ padding: '28px 24px', textAlign: 'center' }}>
            <p style={{ color: '#888', fontSize: 12, marginBottom: 20 }}>
              Enquanto isso, siga a CoopereBR nas redes sociais:
            </p>
            <a
              href="https://wa.me/552740421630"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.waBtn}
            >
              <WaIcon /> Falar agora no WhatsApp
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* HEADER */}
        <div style={styles.header}>
          <div style={styles.decorCircle1} />
          <div style={styles.decorCircle2} />

          <div style={styles.badge}>☀️ Energia Solar &nbsp;•&nbsp; ANEEL Regulamentado</div>

          <div style={styles.logoRow}>
            <div style={styles.logoCircle}>☀️</div>
            <div>
              <div style={styles.brandName}>CoopereBR</div>
              <div style={styles.brandSub}>Cooperativa de Energia Renovável Brasil</div>
            </div>
          </div>

          <div style={styles.headline}>Economize até 20%{'\n'}na conta de luz ⚡</div>
          <div style={styles.subheadline}>
            Sem obras &nbsp;•&nbsp; Sem investimento &nbsp;•&nbsp; Sem fidelidade
          </div>

          {/* Indicado por */}
          <div style={styles.indicadoPor}>
            <div style={styles.indicadoAvatar}>👤</div>
            <div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Convite de
              </div>
              <div style={{ fontSize: 14, color: 'white', fontWeight: 700 }}>
                {convite.nomeIndicador}
              </div>
            </div>
          </div>
        </div>

        {/* CALCULADORA */}
        <div style={styles.body}>
          <div style={styles.calcBox}>
            <div style={styles.calcLabel}>💡 Simule sua economia</div>
            <div style={styles.calcRow}>
              <label style={styles.calcFieldLabel}>Conta média (R$)</label>
              <input
                type="number"
                value={conta}
                min={50} max={5000}
                onChange={e => setConta(Number(e.target.value) || 300)}
                style={styles.calcInput}
              />
            </div>
            <div style={styles.calcResult}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>Por mês</div>
                <div style={styles.calcValue}>R$ {economia}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>No ano</div>
                <div style={{ ...styles.calcValue, fontSize: 16 }}>R$ {economiaAno}</div>
              </div>
            </div>
          </div>

          {/* BENEFICIOS */}
          <div style={styles.benefitsGrid}>
            {[
              { icon: '🌱', title: 'Energia Verde', desc: 'Solar, zero CO₂' },
              { icon: '💳', title: 'Sem Fidelidade', desc: 'Saia quando quiser' },
              { icon: '🔧', title: 'Sem Obras', desc: 'Nada muda em casa' },
              { icon: '📲', title: '100% Digital', desc: 'Tudo pelo celular' },
            ].map(b => (
              <div key={b.title} style={styles.benefit}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{b.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1a1a' }}>{b.title}</div>
                <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{b.desc}</div>
              </div>
            ))}
          </div>

          {/* FORM */}
          <div style={styles.formBox}>
            <div style={styles.formTitle}>🚀 Quero meu desconto!</div>
            <p style={styles.formDesc}>
              Preencha abaixo e receba no WhatsApp nossa simulação personalizada, grátis e sem compromisso.
            </p>

            <form onSubmit={handleSubmit}>
              {erro && (
                <div style={styles.erroBox}>{erro}</div>
              )}
              <div style={{ marginBottom: 12 }}>
                <label style={styles.fieldLabel}>Seu nome</label>
                <input
                  type="text"
                  placeholder="Como posso te chamar?"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  style={styles.fieldInput}
                  required
                />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={styles.fieldLabel}>WhatsApp</label>
                <input
                  type="tel"
                  placeholder="(27) 99999-9999"
                  value={telefone}
                  onChange={e => setTelefone(e.target.value)}
                  style={styles.fieldInput}
                  required
                />
              </div>
              <button type="submit" disabled={enviando} style={styles.waBtn}>
                <WaIcon />
                {enviando ? 'Enviando…' : 'Receber simulação pelo WhatsApp'}
              </button>
              <p style={{ fontSize: 10, color: '#bbb', textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
                Seus dados são usados apenas para enviar sua simulação. Sem spam.
              </p>
            </form>
          </div>
        </div>

        {/* PARCEIROS */}
        <div style={styles.partnersSection}>
          <div style={styles.partnersTitle}>Parceiros do Clube de Vantagens</div>
          <div style={styles.partnersList}>
            {['ASSEJUFES', 'OAB-ES', 'AESMP', 'RACSEL', 'Odontoscan', 'CDSSOLAR', 'Ecosun', 'Mythos'].map(p => (
              <span key={p} style={styles.partnerChip}>{p}</span>
            ))}
          </div>
        </div>

        {/* FOOTER */}
        <div style={styles.footer}>
          <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>🌐 cooperebr.com.br</span>
          <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: 700 }}>📲 (27) 4042-1630</span>
        </div>

      </div>
    </div>
  );
}

function WaIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white" style={{ flexShrink: 0 }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 0C5.373 0 0 5.373 0 12c0 2.094.539 4.061 1.485 5.776L0 24l6.395-1.473A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-1.96 0-3.785-.527-5.348-1.444l-.383-.228-3.97.914.939-3.878-.25-.398A9.767 9.767 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/>
    </svg>
  );
}

// ── STYLES (inline para zero dependência de CSS externo) ──────────────────────
const C = {
  tealDark: '#0f4f4f', teal: '#1e7a6a', tealMid: '#2a9b80',
  tealLight: '#3dbf9a', yellow: '#f5c518', white: '#ffffff',
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: `linear-gradient(160deg, ${C.tealDark} 0%, ${C.teal} 60%, ${C.tealLight} 100%)`,
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    padding: '20px 16px 40px', fontFamily: "'Montserrat','Segoe UI',sans-serif",
  },
  loading: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: `linear-gradient(160deg, ${C.tealDark} 0%, ${C.teal} 60%, ${C.tealLight} 100%)`,
    fontFamily: "'Montserrat','Segoe UI',sans-serif",
  },
  spinner: {
    width: 40, height: 40, border: '4px solid rgba(255,255,255,0.2)',
    borderTop: '4px solid white', borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  card: {
    background: 'white', borderRadius: 24,
    maxWidth: 420, width: '100%',
    boxShadow: '0 24px 60px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.2)',
    overflow: 'hidden',
  },
  header: {
    background: `linear-gradient(150deg, ${C.tealDark} 0%, ${C.tealMid} 100%)`,
    padding: '28px 28px 32px', position: 'relative', overflow: 'hidden',
  },
  decorCircle1: {
    position: 'absolute', width: 260, height: 260, borderRadius: '50%',
    border: '56px solid rgba(255,255,255,0.07)', bottom: -120, right: -80,
    pointerEvents: 'none',
  },
  decorCircle2: {
    position: 'absolute', width: 140, height: 140, borderRadius: '50%',
    border: '30px solid rgba(255,255,255,0.05)', top: -60, left: -30,
    pointerEvents: 'none',
  },
  badge: {
    display: 'inline-flex', alignItems: 'center',
    background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: 20, padding: '5px 14px',
    fontSize: 10, color: 'rgba(255,255,255,0.95)',
    fontWeight: 700, letterSpacing: '0.4px', marginBottom: 16,
  },
  logoRow: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 },
  logoCircle: {
    width: 52, height: 52, borderRadius: '50%',
    background: 'rgba(255,255,255,0.18)', border: '2px solid rgba(255,255,255,0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 24, flexShrink: 0,
  },
  brandName: { fontSize: 26, fontWeight: 900, color: 'white', letterSpacing: '-1.5px', lineHeight: 1 },
  brandSub: { fontSize: 9, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.8px', textTransform: 'uppercase', marginTop: 4 },
  headline: {
    fontSize: 22, fontWeight: 900, color: C.yellow,
    lineHeight: 1.25, letterSpacing: '-0.3px',
    textShadow: '0 2px 8px rgba(0,0,0,0.2)', marginBottom: 6, whiteSpace: 'pre-line',
  },
  subheadline: { fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, marginBottom: 18 },
  indicadoPor: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 12, padding: '10px 14px',
  },
  indicadoAvatar: {
    width: 34, height: 34, borderRadius: '50%', background: C.yellow,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
  },
  body: { padding: '22px 22px 8px' },
  calcBox: {
    background: 'linear-gradient(135deg,#f0faf7,#e8f8f3)', border: '1.5px solid #cceee4',
    borderRadius: 16, padding: '16px 18px', marginBottom: 18,
  },
  calcLabel: { fontSize: 10, color: C.teal, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 },
  calcRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  calcFieldLabel: { fontSize: 12, color: '#555', fontWeight: 600, minWidth: 110 },
  calcInput: {
    flex: 1, padding: '8px 12px', border: '1.5px solid #cce8e0',
    borderRadius: 8, fontSize: 14, fontWeight: 700,
    fontFamily: 'inherit', color: C.tealDark, outline: 'none',
  },
  calcResult: {
    background: C.tealDark, borderRadius: 10, padding: '12px 16px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  calcValue: { fontSize: 22, fontWeight: 900, color: C.yellow },
  benefitsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 },
  benefit: {
    background: '#f8fffe', border: '1.5px solid #e0f5ef',
    borderRadius: 12, padding: '12px 12px 10px', textAlign: 'center',
  },
  formBox: {
    background: '#f9f9f9', border: '1.5px solid #eeeeee',
    borderRadius: 16, padding: '20px 18px', marginBottom: 4,
  },
  formTitle: { fontSize: 16, fontWeight: 800, color: C.tealDark, marginBottom: 6 },
  formDesc: { fontSize: 12, color: '#888', lineHeight: 1.6, marginBottom: 16 },
  erroBox: {
    background: '#fff0f0', border: '1px solid #ffcccc',
    borderRadius: 8, padding: '10px 12px',
    fontSize: 12, color: '#cc0000', marginBottom: 14,
  },
  fieldLabel: { display: 'block', fontSize: 11, color: '#666', fontWeight: 600, marginBottom: 5 },
  fieldInput: {
    width: '100%', padding: '11px 14px', border: '1.5px solid #e0e0e0',
    borderRadius: 10, fontSize: 14, fontFamily: 'inherit',
    color: '#333', outline: 'none',
  },
  waBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    width: '100%', padding: '16px 24px',
    background: 'linear-gradient(135deg,#25D366,#1da851)',
    color: 'white', border: 'none', borderRadius: 14,
    fontSize: 15, fontWeight: 800, fontFamily: 'inherit',
    cursor: 'pointer', textDecoration: 'none',
    boxShadow: '0 8px 24px rgba(37,211,102,0.4)',
  },
  partnersSection: { background: '#fafafa', padding: '16px 22px' },
  partnersTitle: { fontSize: 10, color: '#bbb', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, textAlign: 'center', marginBottom: 10 },
  partnersList: { display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  partnerChip: {
    background: 'white', border: '1.5px solid #eee',
    borderRadius: 20, padding: '4px 12px',
    fontSize: 9.5, color: '#666', fontWeight: 600,
  },
  footer: {
    background: C.tealDark, padding: '14px 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
};

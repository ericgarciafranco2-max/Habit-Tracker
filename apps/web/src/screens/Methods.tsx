import { useMemo, useState } from 'react';
import { QUOTES, quoteOfDay, type Quote } from '../data/quotes.js';
import { TECHNIQUES, TOPIC_LABEL, type Technique } from '../data/techniques.js';
import { Segmented } from '../components/ui.js';
import { Icon } from '../components/Icon.js';
import { useStore } from '../store/store.js';

type Tab = 'tecnicas' | 'frases';

/**
 * Metodos: las tecnicas que hacen que un sistema de habitos funcione, y las
 * frases de gente que ya paso por esto. Cada tecnica dice como se aplica
 * dentro de esta app, no en abstracto.
 */
export function Methods() {
  const [tab, setTab] = useState<Tab>('tecnicas');
  return (
    <>
      <div className="page-head">
        <h1 className="title-lg">Metodos</h1>
        <div className="sub">Como cumplir, no solo por que.</div>
      </div>
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'tecnicas', label: 'Tecnicas' },
          { value: 'frases', label: 'Frases' },
        ]}
      />
      {tab === 'tecnicas' ? <TechniquesTab /> : <QuotesTab />}
    </>
  );
}

function TechniquesTab() {
  const [topic, setTopic] = useState<string>('todas');
  const topics = useMemo(() => ['todas', ...new Set(TECHNIQUES.map((t) => t.topic))], []);
  const shown = TECHNIQUES.filter((t) => topic === 'todas' || t.topic === topic);

  return (
    <>
      <div className="scroll-x" style={{ marginBottom: 6 }}>
        {topics.map((t) => (
          <button
            key={t}
            className={`chip ${topic === t ? 'on' : ''}`}
            style={{ padding: '7px 14px', fontSize: 13.5 }}
            onClick={() => setTopic(t)}
          >
            {t === 'todas' ? 'Todas' : (TOPIC_LABEL[t] ?? t)}
          </button>
        ))}
      </div>
      {shown.map((t) => (
        <TechniqueCard key={t.id} t={t} />
      ))}
    </>
  );
}

function TechniqueCard({ t }: { t: Technique }) {
  return (
    <article className="tech-card">
      <div className="top">
        <h3>{t.name}</h3>
        <span className="chip tiny">{TOPIC_LABEL[t.topic] ?? t.topic}</span>
      </div>
      <div className="tiny faint" style={{ marginBottom: 8 }}>
        {t.author} · montarla cuesta {t.setup} min
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        {t.what}
      </p>
      <div className="how" dangerouslySetInnerHTML={{ __html: renderBold(t.how) }} />
    </article>
  );
}

/** Solo convierte **negrita**; el texto viene de este repositorio, no del usuario. */
function renderBold(text: string): string {
  const escaped = text.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]!);
  return escaped.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

function QuotesTab() {
  const { today } = useStore();
  const daily = quoteOfDay(today);
  const rest = QUOTES.filter((q) => q.text !== daily.text);

  return (
    <>
      <div className="section-label">La de hoy</div>
      <QuoteCard q={daily} big />
      <div className="section-label">Todas</div>
      {rest.map((q) => (
        <QuoteCard key={q.text} q={q} />
      ))}
      <p className="tiny faint" style={{ padding: '4px 4px 0' }}>
        Las marcadas como "atribuida" circulan sin fuente documentada. Van asi a proposito: es
        preferible decirlo a colgarle a alguien una frase que quiza nunca dijo.
      </p>
    </>
  );
}

export function QuoteCard({ q, big }: { q: Quote; big?: boolean }) {
  return (
    <figure className="quote" style={big ? undefined : { padding: '16px 18px' }}>
      <Icon name="quote" size={big ? 22 : 18} className="faint" />
      <blockquote style={big ? undefined : { fontSize: 16, marginTop: 8 }}>{q.text}</blockquote>
      <figcaption className="who">
        <b>{q.author}</b> · {q.role}
        {q.source && <> · <i>{q.source}</i></>}
        {q.attributed && <span className="chip tiny" style={{ marginLeft: 8 }}>atribuida</span>}
      </figcaption>
    </figure>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Icon } from './ui';
import { BotAction, FALLBACK, findTopic, helpBot, starterTopics, SUPPORT, Topic, topicById, useHelpBotOpen } from '../lib/helpbot';
import { t as tr, useLang } from '../lib/i18n';
import { CHAT_PASS_FOR_SALE, store } from '../lib/payments';
import { RulesModal } from '../screens/Table';
import { sfx } from '../lib/sound';

// Bot text and chip titles are kept in English and translated when drawn, so they follow a language change. raw = typed by the player.
interface Msg { id: number; from: 'bot' | 'me'; text: string; raw?: boolean; topic?: Topic; chips?: Topic[] }

let seq = 0;
const greeting = (): Msg => ({ id: ++seq, from: 'bot', text: "Hi! I'm Spade Bot. Ask me anything about Spade Haven, or pick a topic below.", chips: starterTopics() });

/** variant "stage": inside the scaled game screens; "page": on the landing page with its own launcher button */
export function HelpBot({ variant }: { variant: 'stage' | 'page' }) {
  const open = useHelpBotOpen();
  useLang();
  const [msgs, setMsgs] = useState<Msg[]>(() => [greeting()]);
  const [text, setText] = useState('');
  const [rules, setRules] = useState(false);
  const [typing, setTyping] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { listRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }); }, [msgs.length, typing]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 150); }, [open]);

  const reply = (topic: Topic | null) => {
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMsgs((m) => [...m, topic
        ? { id: ++seq, from: 'bot', text: topic.answer, topic, chips: (topic.related ?? []).map(topicById) }
        : { id: ++seq, from: 'bot', text: FALLBACK, chips: starterTopics() }]);
    }, 450);
  };
  const ask = (q: string) => {
    const t = q.trim();
    if (!t) return;
    setMsgs((m) => [...m, { id: ++seq, from: 'me', text: t, raw: true }]);
    setText('');
    reply(findTopic(t).topic);
  };
  const pick = (t: Topic) => { sfx.click(); setMsgs((m) => [...m, { id: ++seq, from: 'me', text: t.title }]); reply(t); };
  const act = (a: BotAction) => {
    sfx.click();
    if (a === 'rules') { setRules(true); return; }
    if (variant === 'page' || a === 'play') window.location.hash = '#play';
    if (a === 'store-coins') store.open({ tab: 'coins' });
    if (a === 'store-chat') store.open({ tab: CHAT_PASS_FOR_SALE ? 'chat' : 'coins' });
    helpBot.close();
  };

  return (
    <>
      {variant === 'page' && !open && (
        <button className="helpbot-launcher" onClick={() => { sfx.click(); helpBot.open(); }} aria-label={tr("Open Spade Bot help chat")}>
          <Icon name="chat" size={24} /><span>{tr("Questions? Ask Spade Bot")}</span>
        </button>
      )}
      {open && (
        <aside className={`helpbot ${variant}`} aria-label={tr("Spade Bot help chat")}>
          <header>
            <span className="hb-avatar"><Icon name="spade" size={22} /></span>
            <span className="hb-title"><b>Spade Bot</b><small>{tr("Answers about rules, coins & tables")}</small></span>
            <button className="icon-btn" onClick={() => helpBot.close()} aria-label={tr("Close help chat")}><Icon name="close" size={20} /></button>
          </header>
          <div className="hb-list" ref={listRef} aria-live="polite">
            {msgs.map((m) => (
              <div key={m.id} className={`hb-msg ${m.from}`}>
                <p>{m.raw ? m.text : tr(m.text, { email: SUPPORT })}</p>
                {m.topic?.actions && (
                  <div className="hb-actions">{m.topic.actions.map((a) => <button key={a.action} className="pill gold small-pill" onClick={() => act(a.action)}>{tr(a.label)}</button>)}</div>
                )}
                {m.chips && m.chips.length > 0 && (
                  <div className="hb-chips">{m.chips.map((c) => <button key={c.id} onClick={() => pick(c)}>{tr(c.title)}</button>)}</div>
                )}
              </div>
            ))}
            {typing && <div className="hb-msg bot typing" aria-label={tr("Spade Bot is typing")}><i /><i /><i /></div>}
          </div>
          <form className="hb-form" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
            <label className="sr-only" htmlFor="hb-in">{tr("Ask a question")}</label>
            <input id="hb-in" ref={inputRef} value={text} maxLength={200} autoComplete="off" onChange={(e) => setText(e.target.value)} placeholder={tr("Ask a question…")} />
            <button type="submit" className="send-btn" aria-label={tr("Send question")}><Icon name="send" size={20} /></button>
          </form>
        </aside>
      )}
      {rules && <RulesModal onClose={() => setRules(false)} />}
    </>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { languages, localizedPlan, tr } from './i18n';

function StatusDot({ tone = 'neutral' }) { return <span className={`dot ${tone}`} />; }
function Badge({ children, tone = 'neutral' }) { return <span className={`badge ${tone}`}><StatusDot tone={tone} />{children}</span>; }

function App() {
  const [locale, setLocale] = useState(() => localStorage.getItem('ai-operator-locale') || 'az');
  const [prompt, setPrompt] = useState('');
  const [task, setTask] = useState(null);
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem('ai-operator-history') || '[]'));
  const [busy, setBusy] = useState(false);
  const [activeNav, setActiveNav] = useState('operator');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [provider, setProvider] = useState(() => localStorage.getItem('ai-operator-provider') || 'Demo AI');
  const t = key => tr(locale, key);
  const stages = ['understanding', 'planning', 'executing', 'validating', 'completed'];
  const stageLabels = stages.map(t);
  const services = [
    ['GitHub', 'repository', 'connected'], ['Vercel', 'deployment', 'connected'], ['Google', 'searchPreview', 'connected'], ['Gmail', 'deploymentMail', 'review'],
  ];

  useEffect(() => { localStorage.setItem('ai-operator-locale', locale); document.documentElement.lang = locale; }, [locale]);
  useEffect(() => { localStorage.setItem('ai-operator-history', JSON.stringify(history.slice(0, 12))); }, [history]);
  useEffect(() => { if (!task || task.status === 'completed' || task.status === 'failed') return; const timer = setTimeout(() => {
    const nextIndex = task.stepIndex + 1;
    if (nextIndex >= task.plan.length) {
      const done = { ...task, status: 'completed', stage: 'completed', stepIndex: nextIndex, message: task.provider === 'Gemini API' ? t('geminiSummary') : t('planSummary'), summary: task.summary };
      setTask(done); setHistory(h => [done, ...h.filter(x => x.id !== done.id)].slice(0, 12)); setBusy(false); return;
    }
    const step = task.plan[nextIndex];
    setTask({ ...task, stepIndex: nextIndex, stage: stages[Math.min(nextIndex + 1, stages.length - 1)], message: `${t('step')} ${nextIndex + 1}: ${step.title}`, summary: step.detail });
  }, 900); return () => clearTimeout(timer); }, [task, locale]);

  const execute = async () => {
    if (!prompt.trim() || busy) return;
    const text = prompt.trim(); const id = `task-${Date.now()}`; setBusy(true);
    let plan = localizedPlan(locale, text); let summary = plan[0].detail; const actualProvider = provider;
    if (provider === 'Gemini API') {
      try {
        const response = await fetch('/api/gemini', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: text, locale }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || t('geminiFailed'));
        plan = data.steps.map(step => ({ title: step.title, detail: step.detail })); summary = data.summary;
      } catch (error) {
        const failed = { id, prompt: text, createdAt: Date.now(), status: 'failed', stage: 'validating', stepIndex: 0, plan, provider, message: t('geminiFailed'), summary: error.message };
        setTask(failed); setHistory(h => [failed, ...h.filter(x => x.id !== id)].slice(0, 12)); setBusy(false); return;
      }
    }
    const first = { id, prompt: text, createdAt: Date.now(), status: 'running', stage: 'understanding', stepIndex: -1, plan, provider: actualProvider, summary, message: `${t('step')} 1: ${plan[0].title}` };
    setTask(first); setHistory(h => [first, ...h.filter(x => x.id !== id)].slice(0, 12));
  };
  const saveSettings = () => { localStorage.setItem('ai-operator-provider', provider); setSettingsOpen(false); };
  const stageIndex = Math.max(0, stages.indexOf(task?.stage || 'understanding'));
  const connectedCount = services.filter(s => s[2] === 'connected').length;
  const recent = useMemo(() => history.slice(0, 4), [history]);
  const statusLabel = status => status === 'completed' ? t('completedStatus') : status === 'failed' ? t('failedStatus') : t('runningStatus');
  const nav = [['operator', '↗'], ['projects', '◫'], ['connections', '◌'], ['audit', '≡']];

  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><img className="brand-mark cyber-falcon" src="/cyber-falcon.svg" alt="Skygard AI Cyber Falcon" /><div><strong>SKYGARD AI</strong><small>autonomous control plane</small></div></div><nav>{nav.map(([key, icon]) => <button key={key} className={activeNav === key ? 'nav-item active' : 'nav-item'} onClick={() => setActiveNav(key)}><span className="nav-icon">{icon}</span>{t(key)}</button>)}</nav><div className="sidebar-bottom"><div className="mini-status"><StatusDot tone="success" /><span>{t('systemReady')}</span></div><div className="version">LOCAL MODE · {provider === 'Gemini API' ? 'GEMINI API' : 'DEMO AI'}</div></div></aside>
    <main className="main-content"><header className="topbar"><div><p className="eyebrow">{t(activeNav).toUpperCase()} / {t('live')}</p><h1>{activeNav === 'operator' ? t('workspace') : t(activeNav)}</h1></div><div className="top-actions"><span className="mode-pill"><StatusDot tone="success" /> {provider === 'Gemini API' ? 'Gemini API' : t('demoAi')}</span><label className="language-select" aria-label="Language"><select value={locale} onChange={e => setLocale(e.target.value)}>{languages.map(lang => <option key={lang.code} value={lang.code}>{lang.flag} {lang.label}</option>)}</select></label><button className="settings-button" onClick={() => setSettingsOpen(true)} aria-label={t('settings')}>⚙</button><button className="avatar" aria-label="Skygard AI Cyber Falcon"><img src="/cyber-falcon.svg" alt="" /></button></div></header>
      {activeNav === 'operator' ? <>
        <section className="command-card"><div className="command-label"><span className="command-symbol">⌁</span><span>{t('command')}</span><span className="secure-label">{t('safe')}</span></div><textarea value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) execute(); }} placeholder={t('placeholder')} /><div className="command-footer"><div className="hint"><button onClick={() => setPrompt(t('prepare'))}>{t('prepare')}</button><button onClick={() => setPrompt(t('check'))}>{t('check')}</button><button onClick={() => setPrompt(t('emails'))}>{t('emails')}</button></div><button className="execute" onClick={execute} disabled={!prompt.trim() || busy}>{busy ? t('running') : t('execute')} <span>↗</span></button></div></section>
        {task && <section className="task-panel"><div className="task-header"><div><p className="eyebrow">{t('task')} {task.id.slice(-6).toUpperCase()}</p><h2>{task.prompt}</h2></div><Badge tone={task.status === 'completed' ? 'success' : task.status === 'failed' ? 'danger' : 'active'}>{task.status === 'completed' ? t('completedStatus') : task.status === 'failed' ? t('failedStatus') : t('runningStatus')}</Badge></div><div className="stage-rail">{stages.map((s, i) => <div className={`stage ${i < stageIndex || (i === stageIndex && task.status === 'completed') ? 'done' : i === stageIndex ? 'current' : ''}`} key={s}><div className="stage-number">{i < stageIndex ? '✓' : String(i + 1).padStart(2, '0')}</div><span>{stageLabels[i]}</span></div>)}</div><div className="task-body"><div className="explanation"><span className="pulse"></span><div><strong>{task.message}</strong><p>{task.summary}</p></div></div><div className="evidence-list">{task.plan.map((e, i) => <div className={`evidence ${i <= task.stepIndex ? 'revealed' : ''}`} key={`${e.title}-${i}`}><span className={`evidence-icon ${i <= task.stepIndex ? 'pass' : ''}`}>{i <= task.stepIndex ? '✓' : '•'}</span><div><strong>{t('step')} {i + 1}: {e.title}</strong><small>{i <= task.stepIndex ? e.detail : t('queued')}</small></div><code>{i <= task.stepIndex ? t('done') : t('queued')}</code></div>)}</div></div></section>}
        <section className="grid-section"><div className="section-heading"><h3>{t('overview')}</h3><span className="muted">{t('realtime')}</span></div><div className="overview-grid"><div className="metric-card"><div className="metric-top"><span>{t('activeProjects')}</span><span className="metric-icon">◫</span></div><strong>03</strong><small>{t('projectsDetected')}</small></div><div className="metric-card"><div className="metric-top"><span>{t('recentTasks')}</span><span className="metric-icon">↗</span></div><strong>{history.length}</strong><small>{t('audited')}</small></div><div className="metric-card"><div className="metric-top"><span>{t('connected')}</span><span className="metric-icon">◌</span></div><strong>{connectedCount}<em> / {services.length}</em></strong><small>{t('verifiedOnly')}</small></div><div className="metric-card"><div className="metric-top"><span>{t('aiMode')}</span><span className="metric-icon lime">✦</span></div><strong className="small-metric">{provider === 'Gemini API' ? 'GEMINI API' : t('demoAi')}</strong><small>{provider === 'Gemini API' ? t('serverEndpoint') : t('noKey')}</small></div></div></section>
        <section className="lower-grid"><div className="panel"><div className="section-heading"><h3>{t('connectedServices')}</h3><button className="text-button" onClick={() => setActiveNav('connections')}>{t('manage')} ↗</button></div><div className="service-list">{services.map(([name, detail, state]) => <div className="service-row" key={name}><div className="service-logo">{name.slice(0, 1)}</div><div className="service-copy"><strong>{name}</strong><small>{t(detail)}</small></div><Badge tone={state === 'connected' ? 'success' : 'warning'}>{state === 'connected' ? t('connectedStatus') : t('review')}</Badge></div>)}</div></div><div className="panel"><div className="section-heading"><h3>{t('recentActivity')}</h3><button className="text-button" onClick={() => setActiveNav('audit')}>{t('viewAll')} ↗</button></div><div className="activity-list">{recent.map(h => <div className="activity" key={h.id}><StatusDot tone={h.status === 'completed' ? 'success' : h.status === 'failed' ? 'danger' : 'active'} /><div><strong>{h.status === 'completed' ? t('verifiedPlan') : h.status === 'failed' ? t('geminiFailed') : `${t('step')} ${Math.max(1, h.stepIndex + 1)}`}</strong><small>{h.prompt} · {new Date(h.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div></div>)}{!recent.length && <div className="empty">{t('noTasks')}</div>}</div></div></section>
      </> : <section className="page-panel"><h2>{t(activeNav)}</h2><p>{activeNav === 'audit' ? t('footer') : t('settingsCopy')}</p>{activeNav === 'connections' && <div className="connection-page">{services.map(([name, detail, state]) => <div className="connection-card" key={name}><div className="service-logo">{name.slice(0, 1)}</div><div className="service-copy"><strong>{name}</strong><small>{t(detail)}</small></div><Badge tone={state === 'connected' ? 'success' : 'warning'}>{state === 'connected' ? t('connectedStatus') : t('review')}</Badge>{state === 'connected' && <button className="disconnect-button" onClick={() => window.alert(t('disconnect'))}>{t('disconnect')}</button>}</div>)}</div>}{activeNav === 'audit' && <div className="audit-table">{history.map(h => <div className="audit-row" key={h.id}><code>{new Date(h.createdAt).toISOString()}</code><span>{h.prompt}</span><Badge tone={h.status === 'completed' ? 'success' : h.status === 'failed' ? 'danger' : 'active'}>{statusLabel(h.status)}</Badge></div>)}</div>}</section>}
      <footer><span>{t('footer')}</span><span>{t('shortcut')}</span></footer>
    </main>
    {settingsOpen && <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}><section className="settings-modal" onClick={e => e.stopPropagation()}><div className="settings-head"><div><p className="eyebrow">{t('config')}</p><h2>{t('settings')}</h2></div><button className="close-button" onClick={() => setSettingsOpen(false)}>×</button></div><p className="settings-copy">{t('settingsCopy')}</p><label>{t('provider')}<select value={provider} onChange={e => setProvider(e.target.value)}><option>Demo AI</option><option>Gemini API</option><option>OpenAI-compatible</option><option>Hugging Face</option></select></label><div className="server-key-note"><span className="dot success" /> {t('serverKey')}: <strong>{provider === 'Gemini API' ? t('requiredVercel') : t('notRequired')}</strong></div><div className="settings-actions"><button className="text-button" onClick={() => { setProvider('Demo AI'); localStorage.removeItem('ai-operator-provider'); }}>{t('useDemo')}</button><button className="execute" onClick={saveSettings}>{t('save')}</button></div></section></div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);

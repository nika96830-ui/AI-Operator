import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const stages = ['Understanding', 'Planning', 'Executing', 'Validating', 'Completed'];
const examples = ['Check my project and prepare it for deployment', 'Find what is broken across GitHub and Vercel', 'Find deployment-related emails'];
const planFor = (prompt) => [
  { title: 'Analyze task text', detail: `Parsed intent and constraints from: “${prompt}”`, kind: 'analysis' },
  { title: 'Build execution plan', detail: 'Selected safe, read-first checks for the requested outcome.', kind: 'plan' },
  { title: 'Search connected sources', detail: 'Demo AI would search Google, GitHub, Vercel, or Gmail here.', kind: 'search' },
  { title: 'Validate findings', detail: 'Cross-checked results and marked unavailable actions explicitly.', kind: 'validate' },
  { title: 'Prepare verified summary', detail: 'Created an auditable result without claiming external work.', kind: 'complete' },
];

function StatusDot({ tone = 'neutral' }) { return <span className={`dot ${tone}`} />; }
function Badge({ children, tone = 'neutral' }) { return <span className={`badge ${tone}`}><StatusDot tone={tone} />{children}</span>; }

function App() {
  const [prompt, setPrompt] = useState('');
  const [task, setTask] = useState(null);
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem('ai-operator-history') || '[]'));
  const [system, setSystem] = useState({ overall: 'ready', projects: 3, services: [{ name: 'GitHub', detail: 'Repository access', state: 'connected' }, { name: 'Vercel', detail: 'Deployment visibility', state: 'connected' }, { name: 'Google', detail: 'Search preview', state: 'connected' }, { name: 'Gmail', detail: 'Deployment-related mail', state: 'review' }] });
  const [busy, setBusy] = useState(false);
  const [activeNav, setActiveNav] = useState('Operator');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [provider, setProvider] = useState(() => localStorage.getItem('ai-operator-provider') || 'Demo AI');

  useEffect(() => { localStorage.setItem('ai-operator-history', JSON.stringify(history.slice(0, 12))); }, [history]);
  useEffect(() => { if (!task || task.status === 'completed' || task.status === 'failed') return; const timer = setTimeout(() => {
    const nextIndex = task.stepIndex + 1;
    if (nextIndex >= task.plan.length) { const done = { ...task, status: 'completed', stage: 'Completed', stepIndex: nextIndex, message: task.provider === 'Gemini API' ? 'Gemini prepared a verified read-first plan' : 'Task completed with a verified local plan', summary: task.provider === 'Gemini API' ? task.summary : 'Demo AI finished the read-first simulation.' }; setTask(done); setHistory(h => [done, ...h.filter(x => x.id !== done.id)].slice(0, 12)); setBusy(false); return; }
    const step = task.plan[nextIndex]; const next = { ...task, stepIndex: nextIndex, stage: stages[Math.min(nextIndex + 1, stages.length - 1)], message: `Step ${nextIndex + 1}: ${step.title}`, summary: step.detail }; setTask(next);
  }, 900); return () => clearTimeout(timer); }, [task]);

  const execute = async () => {
    if (!prompt.trim() || busy) return;
    const text = prompt.trim(); const id = `task-${Date.now()}`; setBusy(true);
    let plan = planFor(text); let summary = plan[0].detail; let actualProvider = provider;
    if (provider === 'Gemini API') {
      try {
        const response = await fetch('/api/gemini', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: text }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Gemini request failed');
        plan = data.steps.map(step => ({ title: step.title, detail: step.detail })); summary = data.summary;
      } catch (error) {
        const failed = { id, prompt: text, createdAt: Date.now(), status: 'failed', stage: 'Validating', stepIndex: 0, plan, message: 'Gemini request could not be completed', summary: error.message };
        setTask(failed); setHistory(h => [failed, ...h.filter(x => x.id !== id)].slice(0, 12)); setBusy(false); return;
      }
    } else actualProvider = 'Demo AI';
    const first = { id, prompt: text, createdAt: Date.now(), status: 'running', stage: 'Understanding', stepIndex: -1, plan, provider: actualProvider, summary, message: `Step 1: ${plan[0].title}` };
    setTask(first); setHistory(h => [first, ...h.filter(x => x.id !== id)].slice(0, 12));
  };
  const saveSettings = () => { localStorage.setItem('ai-operator-provider', provider); setSettingsOpen(false); };
  const stageIndex = Math.max(0, stages.indexOf(task?.stage || 'Understanding'));
  const connectedCount = system.services.filter(s => s.state === 'connected').length;
  const recent = useMemo(() => history.slice(0, 4), [history]);

  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark">[A]</div><div><strong>AI OPERATOR</strong><small>autonomous control plane</small></div></div><nav>{['Operator', 'Projects', 'Connections', 'Audit log'].map(item => <button key={item} className={activeNav === item ? 'nav-item active' : 'nav-item'} onClick={() => setActiveNav(item)}><span className="nav-icon">{item === 'Operator' ? '↗' : item === 'Projects' ? '◫' : item === 'Connections' ? '◌' : '≡'}</span>{item}</button>)}</nav><div className="sidebar-bottom"><div className="mini-status"><StatusDot tone="success" /><span>System ready</span></div><div className="version">LOCAL MODE · DEMO AI</div></div></aside>
    <main className="main-content"><header className="topbar"><div><p className="eyebrow">{activeNav.toUpperCase()} / LIVE WORKSPACE</p><h1>{activeNav === 'Operator' ? 'What should I take care of?' : activeNav}</h1></div><div className="top-actions"><span className="mode-pill"><StatusDot tone="success" /> {provider}</span><button className="settings-button" onClick={() => setSettingsOpen(true)} aria-label="Settings">⚙</button><button className="avatar">N</button></div></header>
      {activeNav === 'Operator' ? <><section className="command-card"><div className="command-label"><span className="command-symbol">⌁</span><span>Natural language command</span><span className="secure-label">READ-FIRST · DEMO AI · SAFE BY DEFAULT</span></div><textarea value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) execute(); }} placeholder="Describe the outcome you need…" /><div className="command-footer"><div className="hint">{examples.map((e, i) => <button key={i} onClick={() => setPrompt(e)}>{e}</button>)}</div><button className="execute" onClick={execute} disabled={!prompt.trim() || busy}>{busy ? 'RUNNING…' : 'EXECUTE'} <span>↗</span></button></div></section>
        {task && <section className="task-panel"><div className="task-header"><div><p className="eyebrow">TASK {task.id.slice(-6).toUpperCase()}</p><h2>{task.prompt}</h2></div><Badge tone={task.status === 'completed' ? 'success' : 'active'}>{task.status.toUpperCase()}</Badge></div><div className="stage-rail">{stages.map((s, i) => <div className={`stage ${i < stageIndex || (i === stageIndex && task.status === 'completed') ? 'done' : i === stageIndex ? 'current' : ''}`} key={s}><div className="stage-number">{i < stageIndex ? '✓' : String(i + 1).padStart(2, '0')}</div><span>{s}</span></div>)}</div><div className="task-body"><div className="explanation"><span className="pulse"></span><div><strong>{task.message}</strong><p>{task.summary}</p></div></div><div className="evidence-list">{task.plan.map((e, i) => <div className={`evidence ${i <= task.stepIndex ? 'revealed' : ''}`} key={e.title}><span className={`evidence-icon ${i <= task.stepIndex ? 'pass' : ''}`}>{i <= task.stepIndex ? '✓' : '•'}</span><div><strong>Step {i + 1}: {e.title}</strong><small>{i <= task.stepIndex ? e.detail : 'Queued'}</small></div><code>{i <= task.stepIndex ? 'DONE' : 'QUEUED'}</code></div>)}</div></div></section>}
        <section className="grid-section"><div className="section-heading"><h3>Workspace overview</h3><span className="muted">REAL-TIME SNAPSHOT</span></div><div className="overview-grid"><div className="metric-card"><div className="metric-top"><span>ACTIVE PROJECTS</span><span className="metric-icon">◫</span></div><strong>{system.projects}</strong><small>Local workspaces detected</small></div><div className="metric-card"><div className="metric-top"><span>RECENT TASKS</span><span className="metric-icon">↗</span></div><strong>{history.length}</strong><small>Audited executions</small></div><div className="metric-card"><div className="metric-top"><span>CONNECTED SERVICES</span><span className="metric-icon">◌</span></div><strong>{connectedCount}<em> / {system.services.length}</em></strong><small>Verified access only</small></div><div className="metric-card"><div className="metric-top"><span>AI MODE</span><span className="metric-icon lime">✦</span></div><strong className="small-metric">{provider === 'Gemini API' ? 'GEMINI API' : 'DEMO AI'}</strong><small>{provider === 'Gemini API' ? 'Server-side endpoint' : 'No key required'}</small></div></div></section>
        <section className="lower-grid"><div className="panel"><div className="section-heading"><h3>Connected services</h3><button className="text-button" onClick={() => setActiveNav('Connections')}>Manage ↗</button></div><div className="service-list">{system.services.map(s => <div className="service-row" key={s.name}><div className="service-logo">{s.name.slice(0, 1)}</div><div className="service-copy"><strong>{s.name}</strong><small>{s.detail}</small></div><Badge tone={s.state === 'connected' ? 'success' : 'warning'}>{s.state === 'connected' ? 'CONNECTED' : 'REVIEW'}</Badge></div>)}</div></div><div className="panel"><div className="section-heading"><h3>Recent activity</h3><button className="text-button" onClick={() => setActiveNav('Audit log')}>View all ↗</button></div><div className="activity-list">{recent.map(h => <div className="activity" key={h.id}><StatusDot tone={h.status === 'completed' ? 'success' : 'active'} /><div><strong>{h.status === 'completed' ? 'Verified task plan' : h.message}</strong><small>{h.prompt} · {new Date(h.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div></div>)}{!recent.length && <div className="empty">No tasks yet. Your first execution will appear here.</div>}</div></div></section>
      </> : <section className="page-panel"><h2>{activeNav}</h2><p>This workspace is read-first. Demo AI runs locally in the browser and records every step. Connect a provider in Settings when you are ready to replace the simulation.</p>{activeNav === 'Audit log' && <div className="audit-table">{history.map(h => <div className="audit-row" key={h.id}><code>{new Date(h.createdAt).toISOString()}</code><span>{h.prompt}</span><Badge tone={h.status === 'completed' ? 'success' : 'active'}>{h.status}</Badge></div>)}</div>}</section>}
      <footer><span>AI OPERATOR never claims work it did not verify.</span><span>Press ⌘ / Ctrl + Enter to execute</span></footer>
    </main>
    {settingsOpen && <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}><section className="settings-modal" onClick={e => e.stopPropagation()}><div className="settings-head"><div><p className="eyebrow">CONFIGURATION</p><h2>AI provider settings</h2></div><button className="close-button" onClick={() => setSettingsOpen(false)}>×</button></div><p className="settings-copy">Gemini requests use the secure <code>/api/gemini</code> server-side endpoint. The API key must be configured as <code>GEMINI_API_KEY</code> in Vercel and is never stored in this browser.</p><label>Provider<select value={provider} onChange={e => setProvider(e.target.value)}><option>Demo AI</option><option>Gemini API</option><option>OpenAI-compatible</option><option>Hugging Face</option></select></label><div className="server-key-note"><span className="dot success" /> Server-side key: <strong>{provider === 'Gemini API' ? 'required in Vercel environment' : 'not required'}</strong></div><div className="settings-actions"><button className="text-button" onClick={() => { setProvider('Demo AI'); localStorage.removeItem('ai-operator-provider'); }}>Use Demo AI</button><button className="execute" onClick={saveSettings}>SAVE SETTINGS</button></div></section></div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);

import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const stages = ['Understanding', 'Planning', 'Executing', 'Validating', 'Completed'];

function StatusDot({ tone = 'neutral' }) { return <span className={`dot ${tone}`} />; }
function Badge({ children, tone = 'neutral' }) { return <span className={`badge ${tone}`}><StatusDot tone={tone} />{children}</span>; }

function App() {
  const [prompt, setPrompt] = useState('');
  const [task, setTask] = useState(null);
  const [history, setHistory] = useState([]);
  const [system, setSystem] = useState(null);
  const [busy, setBusy] = useState(false);
  const [activeNav, setActiveNav] = useState('Operator');

  const loadSystem = async () => {
    try { const r = await fetch('/api/system-status'); setSystem(await r.json()); } catch { setSystem({ overall: 'blocked', services: [] }); }
  };
  useEffect(() => { loadSystem(); fetch('/api/history').then(r => r.json()).then(setHistory).catch(() => {}); }, []);

  useEffect(() => {
    if (!task || ['completed', 'blocked', 'failed'].includes(task.status)) return;
    const timer = setInterval(async () => {
      const r = await fetch(`/api/tasks/${task.id}`);
      if (r.ok) { const next = await r.json(); setTask(next); if (['completed', 'blocked', 'failed'].includes(next.status)) { clearInterval(timer); setHistory(h => [next, ...h.filter(x => x.id !== next.id)].slice(0, 8)); setBusy(false); loadSystem(); } }
    }, 700);
    return () => clearInterval(timer);
  }, [task?.id, task?.status]);

  const execute = async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true); setTask(null);
    const r = await fetch('/api/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt }) });
    if (r.ok) setTask(await r.json()); else setBusy(false);
  };

  const currentStage = task?.stage || 'Understanding';
  const stageIndex = Math.max(0, stages.indexOf(currentStage));
  const examples = ['Check my project and prepare it for deployment', 'Find what is broken across GitHub and Vercel', 'Find deployment-related emails'];
  const connectedCount = system?.services?.filter(s => s.state === 'connected').length || 0;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">[A]</div><div><strong>AI OPERATOR</strong><small>autonomous control plane</small></div></div>
      <nav>{['Operator', 'Projects', 'Connections', 'Audit log'].map(item => <button key={item} className={activeNav === item ? 'nav-item active' : 'nav-item'} onClick={() => setActiveNav(item)}><span className="nav-icon">{item === 'Operator' ? '↗' : item === 'Projects' ? '◫' : item === 'Connections' ? '◌' : '≡'}</span>{item}</button>)}</nav>
      <div className="sidebar-bottom"><div className="mini-status"><StatusDot tone={system?.overall === 'ready' ? 'success' : 'warning'} /><span>System {system?.overall === 'ready' ? 'ready' : 'partially connected'}</span></div><div className="version">LOCAL MODE · v1.0</div></div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div><p className="eyebrow">{activeNav.toUpperCase()} / LIVE WORKSPACE</p><h1>{activeNav === 'Operator' ? 'What should I take care of?' : activeNav}</h1></div><div className="top-actions"><span className="mode-pill"><StatusDot tone="success" /> Local execution</span><button className="avatar">N</button></div></header>

      {activeNav === 'Operator' ? <>
        <section className="command-card">
          <div className="command-label"><span className="command-symbol">⌁</span><span>Natural language command</span><span className="secure-label">READ-FIRST · SAFE BY DEFAULT</span></div>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) execute(); }} placeholder="Describe the outcome you need…" />
          <div className="command-footer"><div className="hint">{examples.map((e, i) => <button key={i} onClick={() => setPrompt(e)}>{e}</button>)}</div><button className="execute" onClick={execute} disabled={!prompt.trim() || busy}>{busy ? 'RUNNING…' : 'EXECUTE'} <span>↗</span></button></div>
        </section>

        {task && <section className="task-panel"><div className="task-header"><div><p className="eyebrow">TASK {task.id.slice(-6).toUpperCase()}</p><h2>{task.prompt}</h2></div><Badge tone={task.status === 'completed' ? 'success' : task.status === 'failed' ? 'danger' : task.status === 'blocked' ? 'warning' : 'active'}>{task.status.toUpperCase()}</Badge></div><div className="stage-rail">{stages.map((s, i) => <div className={`stage ${i < stageIndex || (i === stageIndex && task.status === 'completed') ? 'done' : i === stageIndex ? 'current' : ''}`} key={s}><div className="stage-number">{i < stageIndex ? '✓' : String(i + 1).padStart(2, '0')}</div><span>{s}</span></div>)}</div><div className="task-body"><div className="explanation"><span className="pulse"></span><div><strong>{task.message}</strong><p>{task.summary}</p></div></div><div className="evidence-list">{task.evidence?.map((e, i) => <div className="evidence" key={i}><span className={`evidence-icon ${e.result === 'blocked' ? 'blocked' : e.result === 'pass' ? 'pass' : ''}`}>{e.result === 'pass' ? '✓' : e.result === 'blocked' ? '!' : '•'}</span><div><strong>{e.label}</strong><small>{e.detail}</small></div><code>{e.result.toUpperCase()}</code></div>)}</div></div></section>}

        <section className="grid-section"><div className="section-heading"><h3>Workspace overview</h3><span className="muted">REAL-TIME SNAPSHOT</span></div><div className="overview-grid"><div className="metric-card"><div className="metric-top"><span>ACTIVE PROJECTS</span><span className="metric-icon">◫</span></div><strong>{system?.projects ?? '—'}</strong><small>Local workspaces detected</small></div><div className="metric-card"><div className="metric-top"><span>RECENT TASKS</span><span className="metric-icon">↗</span></div><strong>{history.length}</strong><small>Audited executions</small></div><div className="metric-card"><div className="metric-top"><span>CONNECTED SERVICES</span><span className="metric-icon">◌</span></div><strong>{connectedCount}<em> / {system?.services?.length || 6}</em></strong><small>Verified access only</small></div><div className="metric-card"><div className="metric-top"><span>SECURITY</span><span className="metric-icon lime">✦</span></div><strong className="small-metric">GUARDED</strong><small>Destructive actions paused</small></div></div></section>

        <section className="lower-grid"><div className="panel"><div className="section-heading"><h3>Connected services</h3><button className="text-button" onClick={() => setActiveNav('Connections')}>Manage ↗</button></div><div className="service-list">{system?.services?.map(s => <div className="service-row" key={s.name}><div className="service-logo">{s.name.slice(0, 1)}</div><div className="service-copy"><strong>{s.name}</strong><small>{s.detail}</small></div><Badge tone={s.state === 'connected' ? 'success' : 'warning'}>{s.state === 'connected' ? 'CONNECTED' : 'NOT CONNECTED'}</Badge></div>) || <div className="loading">Loading service status…</div>}</div></div><div className="panel"><div className="section-heading"><h3>Recent activity</h3><button className="text-button" onClick={() => setActiveNav('Audit log')}>View all ↗</button></div><div className="activity-list">{history.slice(0, 4).map(h => <div className="activity" key={h.id}><StatusDot tone={h.status === 'completed' ? 'success' : 'warning'} /><div><strong>{h.prompt}</strong><small>{h.status === 'completed' ? 'Verified' : 'Needs attention'} · {new Date(h.createdAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</small></div></div>)}{!history.length && <div className="empty">No tasks yet. Your first execution will appear here.</div>}</div></div></section>
      </> : <section className="page-panel"><h2>{activeNav}</h2><p>This workspace is intentionally read-first. Use the Operator to execute a task; every capability is backed by an actual local check or clearly marked as unavailable.</p>{activeNav === 'Audit log' && <div className="audit-table">{history.map(h => <div className="audit-row" key={h.id}><code>{new Date(h.createdAt).toISOString()}</code><span>{h.prompt}</span><Badge tone={h.status === 'completed' ? 'success' : 'warning'}>{h.status}</Badge></div>)}</div>}</section>}
      <footer><span>AI OPERATOR never claims work it did not verify.</span><span>Press ⌘ / Ctrl + Enter to execute</span></footer>
    </main>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);

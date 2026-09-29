'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type DragEvent as ReactDragEvent, type FormEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import { ShieldCheck, Search, ArrowUpRight, ArrowRight, BookOpen, Activity as ActivityIcon, Layers3, CircleHelp, ChevronRight, LoaderCircle, Check, AlertCircle, Fingerprint, FileText, X, Download, Settings2, Terminal, Link as LinkIcon, Radar, Database, Clock, Package, Upload } from 'lucide-react';
import { researchInput, isLive, type Activity, type Report, type Finding, type Coverage } from '@/lib/schema';
import type { DependencyReport } from '@/lib/dependency-scan';
import { useDashboardMotion } from './dashboard-motion';

const examples = [
  {software: 'Next.js', version: '14.2.24', question: 'Does the documented middleware authorization bypass affect this version, and which fixes are listed?', tag: 'Version assessment', label: 'Check Next.js middleware', icon: 'N'},
  {software: 'Vite', version: '6.2.2', question: 'What do the advisories say about file access through an exposed Vite development server?', tag: 'Configuration matters', label: 'Investigate Vite file access', icon: 'V'},
  {software: 'axios', version: '1.7.3', question: 'Which documented advisories affect this version, and what are the listed fixed versions?', tag: 'Beyond the curated import', label: 'Look up any npm package', icon: 'A'},
];
type Status = {configured: boolean; missing: string[]; accessRequired: boolean};
const date = (value: string) => new Date(value).toLocaleDateString('en', {day:'numeric', month:'short', year:'numeric'});
const clock = (value: string) => new Date(value).toLocaleTimeString('en', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
const origins: Record<Finding['origin'], string> = {'knowledge-base':'Curated Knowledge Base', 'live-lookup':'Live source lookup', 'knowledge-base+live':'Curated + live source'};
// The badge colour is derived from the same field as its label, so the two can never disagree.
const originClass: Record<Finding['origin'], string> = {'knowledge-base':'curated', 'live-lookup':'live', 'knowledge-base+live':'both'};
const sourceStates: Record<Coverage['sources'][number]['status'], string> = {ok:'Completed', partial:'Partial', failed:'Did not complete', skipped:'Not run'};
const originTags: Record<NonNullable<Coverage['sources'][number]['origin']>, string> = {live:'Live', cache:'Cached', 'built-snapshot':'Built snapshot'};
const labels: Record<Finding['assessment']['status'], string> = {affected:'Confirmed affected', unaffected:'Explicitly unaffected', conditional:'Conditions to verify', 'outside-range':'Outside listed range', unknown:'Insufficient evidence', conflict:'Conflicting evidence'};
export function Dashboard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [software,setSoftware] = useState('');
  const [version,setVersion] = useState('');
  const [question,setQuestion] = useState('');
  const [access,setAccess] = useState('');
  const [busy,setBusy] = useState(false);
  const [events,setEvents] = useState<Activity[]>([]);
  const [report,setReport] = useState<Report | null>(null);
  const [error,setError] = useState('');
  const [tab,setTab] = useState('overview');
  const [settings,setSettings] = useState(false);
  const [depBusy,setDepBusy] = useState(false);
  const [depReport,setDepReport] = useState<DependencyReport | null>(null);
  const [depError,setDepError] = useState('');
  const [depName,setDepName] = useState('');
  const [dragActive,setDragActive] = useState(false);
  const dragDepth = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  useDashboardMotion({
    scope: shellRef,
    reportId: report?.requestId ?? null,
    dependencyId: depReport?.requestId ?? null,
    activityCount: events.length,
    tab, busy,
  });
  useEffect(() => {
    fetch('/api/status').then(r => {if (!r.ok) throw Error(); return r.json();}).then(setStatus).catch(() => setStatusError(true));
    return () => abort.current?.abort();
  },[]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    const parsed = researchInput.safeParse({software,version,question});
    if (!parsed.success) {setError(parsed.error.issues[0].message); return;}
    const controller = new AbortController(); abort.current = controller;
    setBusy(true); setEvents([]); setReport(null); setTab('overview');
    try {
      const response = await fetch('/api/research', {method:'POST', headers:{'Content-Type':'application/json', ...(access ? {'x-research-access':access} : {})}, body:JSON.stringify(parsed.data), signal:controller.signal});
      if (!response.ok) {const data = await response.json(); throw new Error(data.error || 'Research request failed.');}
      if (!response.body) throw new Error('No response received.');
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''; let complete = false;
      while (true) {
        const {done,value} = await reader.read();
        buffer += decoder.decode(value, {stream:!done});
        const lines = buffer.split('\n'); buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line) continue;
          const message = JSON.parse(line);
          if (message.type === 'activity') setEvents(previous => [...previous,message.data]);
          if (message.type === 'error') throw new Error(message.data);
          if (message.type === 'result') {setReport(message.data); complete = true;}
        }
        if (done) break;
      }
      if (!complete) throw new Error('The connection ended before research completed. Please retry.');
    } catch (e) {setError(controller.signal.aborted ? 'Research cancelled.' : e instanceof Error ? e.message : 'Research could not be completed.');}
    finally {setBusy(false); abort.current = null;}
  }
  async function analyseLockfile(file: File) {
    setDepError(''); setDepReport(null); setDepName(file.name);
    if (!file.name.toLowerCase().endsWith('.json')) {setDepError('Choose a package-lock.json file.'); return;}
    if (file.size > 8_000_000) {setDepError('That file is larger than the 8 MB limit for a single request.'); return;}
    setDepBusy(true);
    try {
      const text = await file.text();
      const response = await fetch('/api/dependencies', {method:'POST', headers:{'Content-Type':'application/json', ...(access ? {'x-research-access':access} : {})}, body:text});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The dependency check failed.');
      setDepReport(data as DependencyReport);
      setTab('dependencies');
    } catch (e) {setDepError(e instanceof Error ? e.message : 'The dependency check could not be completed.');}
    finally {setDepBusy(false);}
  }
  function onFileDragEnter(event: ReactDragEvent<HTMLDivElement>) {
    if (depBusy || !event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragDepth.current++;
    setDragActive(true);
  }
  function onFileDragOver(event: ReactDragEvent<HTMLDivElement>) {
    if (depBusy || !event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }
  function onFileDragLeave(event: ReactDragEvent<HTMLDivElement>) {
    if (!dragDepth.current) return;
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (!dragDepth.current) setDragActive(false);
  }
  function onFileDrop(event: ReactDragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    if (depBusy) return;
    if (event.dataTransfer.files.length !== 1) {
      setDepReport(null); setDepName('');
      setDepError('Drop one package-lock.json file at a time.');
      return;
    }
    void analyseLockfile(event.dataTransfer.files[0]);
  }
  function fill(example: typeof examples[number]) {
    setSoftware(example.software); setVersion(example.version); setQuestion(example.question); setError('');
    formRef.current?.scrollIntoView({behavior:'smooth',block:'center'});
  }
  function exportReport() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    const a = document.createElement('a'); a.href = url; a.download = 'security-research-' + report.requestId + '.json'; a.click(); URL.revokeObjectURL(url);
  }
  const openTab = (value: string) => {setTab(value); document.getElementById('workspace')?.scrollIntoView({behavior:'smooth'});};
  return <div className="shell" ref={shellRef}>
    <a className="skip-link" href="#main">Skip to research</a>
    <aside className="sidebar">
      <Link href="/" className="brand" aria-label="Advisory home"><span className="brand-icon"><ShieldCheck size={23}/></span><span>ADVISORY<span className="brand-sub">SECURITY INTELLIGENCE</span></span></Link>
      <div className="workspace-switch"><span className="workspace-avatar">R</span><span>Research workspace<small>Personal workspace</small></span><Layers3 size={15}/></div>
      <p className="nav-label">WORKSPACE</p>
      <nav aria-label="Main navigation">
        <button data-accent="violet" className={tab==='overview' ? 'nav-item active':'nav-item'} onClick={() => openTab('overview')}><Search size={18}/>Security research<span className="nav-indicator"/></button>
        <button data-accent="amber" className={tab==='dependencies' ? 'nav-item active':'nav-item'} onClick={() => openTab('dependencies')}><Package size={18}/>Dependency file</button>
        <button data-accent="cyan" className={tab==='coverage' ? 'nav-item active':'nav-item'} onClick={() => openTab('coverage')}><Radar size={18}/>Coverage checked</button>
        <button data-accent="rose" className={tab==='sources' ? 'nav-item active':'nav-item'} onClick={() => openTab('sources')}><BookOpen size={18}/>Source evidence</button>
        <button data-accent="green" className={tab==='activity' ? 'nav-item active':'nav-item'} onClick={() => openTab('activity')}><ActivityIcon size={18}/>Agent activity</button>
      </nav>
      <div className="sidebar-bottom">
        <div className="source-note"><span className="mini-icon"><Fingerprint size={20}/></span><h3>Evidence comes first.</h3><p>Every finding traces back to retrieved advisories and original sources.</p><span>POWERED BY <b className="sanity-word">sanity</b></span></div>
        <button data-accent="violet" className="nav-item" onClick={() => setSettings(true)}><Settings2 size={18}/>Connection &amp; setup</button>
        <div className="profile"><span className="profile-avatar">R</span><div>Researcher<small>AI Security Advisory Assistant</small></div><span className="profile-dot"/></div>
      </div>
    </aside>
    <div className="main-wrap">
      <header className="topbar"><div className="breadcrumb">Workspace <ChevronRight size={13}/><span>Security research</span></div><div className="topbar-right"><span className="dataset-badge"><span/>production</span><button aria-label="Open setup help" className="icon-button" onClick={() => setSettings(true)}><CircleHelp size={18}/></button></div></header>
      <main id="main">
        <section className="welcome"><div className="eyebrow"><span/>SOURCE-GROUNDED SECURITY RESEARCH</div><h1>Clarity before your next update.</h1><p>Understand what affects your software. Get answers backed by<br className="desktop-break"/> documented vulnerabilities, version ranges, and original sources.</p><div className="welcome-symbol" aria-hidden="true"><div/><ShieldCheck size={104} strokeWidth={1}/></div></section>
        <div className="connection-banner"><div className={'status-light ' + (status?.configured ? 'configured':'')}/><span>{status?.configured ? 'Connections configured' : statusError ? 'Connection status unavailable' : status ? 'Connect your knowledge base to start researching' : 'Checking connection settings…'}</span><small>{status?.configured ? 'Live connection verified on each request' : 'Your existing Sanity project · production dataset'}</small><button onClick={() => setSettings(true)}>{status?.configured ? 'Settings':'Complete setup'}<ArrowUpRight size={14}/></button></div>
        <div className="research-layout">
          <div className="research-main">
            <section className="panel research-panel">
              <div className="panel-heading"><span className="section-icon" data-accent="violet"><Search size={19}/></span><div><h2>What are you investigating?</h2><p>Start with your software and a security question.</p></div><span className="small-tag">NEW RESEARCH</span></div>
              <form ref={formRef} onSubmit={submit}>
                <div className="input-row"><label>Software <span className="required">*</span><input value={software} onChange={e=>setSoftware(e.target.value)} placeholder="e.g. Next.js, axios, or an exact npm package" required maxLength={80} disabled={busy}/></label><label>Installed version <span className="optional">Optional</span><input value={version} onChange={e=>setVersion(e.target.value)} placeholder="e.g. 14.2.24" maxLength={80} disabled={busy}/></label></div>
                <label>Your security question <span className="required">*</span><textarea value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Are there documented vulnerabilities affecting this version? What fixes and configuration conditions should I review?" required minLength={8} maxLength={2000} rows={4} disabled={busy}/></label>
                <div className="question-meta"><span><ShieldCheck size={13}/>Read-only research. No scanning or code execution.</span><span>{question.length.toLocaleString()}/2,000</span></div>
                {status?.accessRequired && <label className="access-label">Research access code<input type="password" autoComplete="off" value={access} onChange={e=>setAccess(e.target.value)} placeholder="Provided by your workspace operator" maxLength={256}/></label>}
                {error && <div className="error-message" role="alert"><AlertCircle size={16}/>{error}</div>}
                <div className="form-footer"><span><Layers3 size={15}/>Sanity Knowledge Base <span className="footer-dot">·</span> Evidence-backed answers</span>{busy ? <button type="button" className="secondary-button" onClick={()=>abort.current?.abort()}><X size={15}/>Cancel research</button> : <button className="primary-button" type="submit"><Search size={16}/>Run research<ArrowRight size={16}/></button>}</div>
              </form>
            </section>
            <div className="examples-heading"><span>NEED A STARTING POINT?</span><span>Try a research question <ArrowRight size={13}/></span></div>
            <div className="examples">{examples.map(example => <button key={example.label} onClick={()=>fill(example)} disabled={busy}><span className="example-top"><span className="product-logo">{example.icon}</span><ArrowUpRight size={16}/></span><strong>{example.label}</strong><small>{example.tag}</small></button>)}</div>
          </div>
          <aside className="panel guide-panel"><div className="guide-heading"><span className="section-icon" data-accent="cyan"><Layers3 size={18}/></span><h2>Research you can verify</h2></div><p className="guide-intro">From your question to the evidence behind the answer.</p><ol className="flow-list"><li><span>01</span><div><h3>Resolve the package</h3><p>Your software name is resolved to an exact npm package, or you are asked which one you mean.</p></div></li><li><span>02</span><div><h3>Query live advisories</h3><p>OSV.dev is queried for that package, alongside your curated Sanity Knowledge Base.</p></div></li><li><span>03</span><div><h3>Assess with evidence</h3><p>Version ranges are evaluated in code and cross-checked against the source&apos;s own matcher.</p></div></li></ol><div className="coverage-note"><BookOpen size={16}/><div><strong>What this covers</strong><p>Published advisories for npm packages, plus your curated entries. It is an advisory lookup, not a scan of your code or deployment.</p></div></div></aside>
        </div>
        <section id="workspace" className="panel results-panel">
          <Tabs.Root value={tab} onValueChange={setTab}>
            <div className="results-header"><Tabs.List aria-label="Research results"><Tabs.Trigger value="overview" data-accent="violet"><FileText size={16}/>Research overview</Tabs.Trigger><Tabs.Trigger value="dependencies" data-accent="amber"><Package size={16}/>Dependencies{depReport && <span className="count">{depReport.counts.withAdvisories}</span>}</Tabs.Trigger><Tabs.Trigger value="coverage" data-accent="cyan"><Radar size={16}/>Coverage{report && <span className="count">{report.coverage.sources.length}</span>}</Tabs.Trigger><Tabs.Trigger value="sources" data-accent="rose"><BookOpen size={16}/>Sources{report && <span className="count">{report.entries.length}</span>}</Tabs.Trigger><Tabs.Trigger value="activity" data-accent="green"><ActivityIcon size={16}/>Activity{events.length>0 && <span className="count">{events.length}</span>}</Tabs.Trigger></Tabs.List>{report && <button onClick={exportReport} className="icon-button" aria-label="Download research report"><Download size={17}/></button>}<span className="session-label">{busy ? 'RESEARCH IN PROGRESS': report ? 'RESEARCH COMPLETE':'AWAITING YOUR QUESTION'}</span></div>
            <Tabs.Content value="overview">
              {busy ? <div className="empty-state" role="status"><span className="empty-icon"><LoaderCircle className="spin" size={30}/></span><h2>Following the evidence</h2><p>{events.at(-1)?.detail ?? 'Submitting your research request…'}</p><span className="empty-caption">Activity appears as each operation happens.</span></div> : report ? <div className="report"><div className="report-summary"><span className="eyebrow">RESEARCH SUMMARY</span><h2>{report.query.software} {report.query.version && <span className="version-pill">{report.query.version}</span>}</h2><p>{report.summary}</p><small>{date(report.createdAt)} · {report.findings.length} advisor{report.findings.length===1?'y':'ies'} reported</small></div><CoverageSummary coverage={report.coverage} onOpen={()=>setTab('coverage')}/>{report.findings.map(finding => <FindingCard key={finding.advisory.advisoryId} finding={finding}/>)}<div className="limitations"><h3><AlertCircle size={16}/>Evidence limitations</h3><ul>{report.limitations.map(l=><li key={l}>{l}</li>)}</ul></div></div> : <div className="empty-state"><span className="empty-icon"><Fingerprint size={31} strokeWidth={1.3}/></span><h2>Your next decision starts with evidence.</h2><p>Ask a question to build a source-backed research brief.<br/>Your findings, version assessment, and references will appear here.</p><div className="empty-chips"><span><LinkIcon size={12}/>Cited sources</span><span><Check size={12}/>Version-aware</span><span><ShieldCheck size={12}/>Clear limitations</span></div></div>}
            </Tabs.Content>
            <Tabs.Content value="dependencies"><div className="coverage-content">
              <div className="upload-row">
                <div><h2>Check a package-lock.json</h2><p className="muted">The file is parsed as data in the browser and on the server. Install scripts are never read or executed. Exact installed versions, including transitive ones, are checked against published advisories.</p></div>
                <label className={'upload-button' + (depBusy ? ' busy' : '')}>{depBusy ? <LoaderCircle className="spin" size={16}/> : <Upload size={16}/>}{depBusy ? 'Checking dependencies…' : 'Choose package-lock.json'}
                  <input type="file" accept="application/json,.json" disabled={depBusy} onChange={e => {const file = e.target.files?.[0]; if (file) void analyseLockfile(file); e.target.value = '';}}/>
                </label>
              </div>
              <div className={'upload-dropzone' + (dragActive ? ' drag-active' : '') + (depBusy ? ' busy' : '')}
                role="region" aria-label="Drop package-lock.json here" aria-busy={depBusy}
                onDragEnter={onFileDragEnter} onDragOver={onFileDragOver}
                onDragLeave={onFileDragLeave} onDrop={onFileDrop}>
                <Upload size={26} aria-hidden="true"/>
                <strong>{dragActive ? 'Release to check this file' : 'Drag and drop package-lock.json here'}</strong>
                <span>Or use the Choose package-lock.json button above - JSON only - 8 MB maximum</span>
              </div>
              {depName && !depError && <p className="muted upload-name"><FileText size={13}/>{depName}</p>}
              {depError && <div className="error-message" role="alert"><AlertCircle size={16}/>{depError}</div>}
              {depReport ? <DependencyResults report={depReport}/> : !depBusy && !depError && <Empty title="No dependency file checked yet" text="Upload a package-lock.json to check every exact installed version against published advisories. This checks known dependency advisories, not your application's overall security posture." icon={<Package size={28}/>}/>}
            </div></Tabs.Content>
            <Tabs.Content value="coverage"><div className="coverage-content">{report ? <CoveragePanel coverage={report.coverage}/> : <Empty title="Coverage will appear here" text="Every source this application queries, whether it completed, and how fresh its data was, is recorded for each request." icon={<Radar size={28}/>}/>}</div></Tabs.Content>
            <Tabs.Content value="sources"><div className="source-content">{report?.entries.length ? <><h2>Retrieved Knowledge Base entries</h2><p className="muted">Read-only excerpts returned by Sanity Context. Entry content is untrusted source data, displayed as plain text.</p>{report.entries.map((entry,i)=><details className="evidence-detail" key={i}><summary><BookOpen size={16}/>{entry.paths.join(', ')}<span>{entry.knowledgeBase}</span></summary><pre>{entry.content}</pre></details>)}{report.findings.map(f=><div className="source-card" key={f.advisory.advisoryId}><div><span className="eyebrow">ORIGINAL ADVISORY</span><h3>{f.advisory.advisoryId}</h3><p>{f.advisory.title}</p><small>Updated {date(f.advisory.updatedAt)} · Fetched {date(f.advisory.fetchedAt)}</small></div><a href={f.advisory.sourceUrl} target="_blank" rel="noopener noreferrer">View source<ArrowUpRight size={15}/></a></div>)}</> : <Empty title="Sources will appear here" text="Run a research request to inspect the entries and original documents the agent actually retrieved." icon={<BookOpen size={28}/>}/>}</div></Tabs.Content>
            <Tabs.Content value="activity"><div className="activity-content">{events.length ? <><h2>Research activity</h2><p className="muted">Actual operations from this request.</p><ol className="activity-list">{events.map((event,i)=><li key={i}><span className="activity-check"><Check size={14}/></span><div><strong>{event.detail}</strong><code>{event.stage}</code></div><time>{new Date(event.at).toLocaleTimeString()}</time></li>)}</ol>{error && <p className="error-message">{error}</p>}</> : <Empty title="An inspectable research trail" text="The outline reads, entry retrievals, and verification steps will appear here when they happen." icon={<ActivityIcon size={28}/>}/>}</div></Tabs.Content>
          </Tabs.Root>
        </section>
        <footer className="page-footer"><span><ShieldCheck size={14}/>Built for informed security decisions.</span><span>Grounded in sources. Honest about uncertainty.</span></footer>
      </main>
    </div>
    <Dialog.Root open={settings} onOpenChange={setSettings}><Dialog.Portal><Dialog.Overlay className="modal-backdrop"/><Dialog.Content className="setup-modal"><button className="modal-close icon-button" aria-label="Close setup" onClick={()=>setSettings(false)} autoFocus><X size={20}/></button><span className="section-icon"><Settings2 size={24}/></span><Dialog.Title>Connect your research workspace</Dialog.Title><Dialog.Description>Use your existing <strong>AI Security Advisory Assistant</strong> Sanity project and <strong>production</strong> dataset.</Dialog.Description><ol><li>Add your existing project ID and server credentials to <code>.env.local</code>.</li><li>Validate and import the advisories, then deploy the schema to your existing dataset.</li><li>Create a Knowledge Base from those records. Attach only that Knowledge Base to a dedicated Context MCP endpoint.</li><li>Set the endpoint URL, organization Context Viewer token, project read token, and your AI provider/model. Restart the app.</li></ol><div className="setup-missing"><strong>{status?.configured ? 'Environment configured; live retrieval runs when you research.':'Missing or invalid settings'}</strong>{status?.missing.map(field=><code key={field}>{field}</code>)}</div><p className="muted">Full instructions are in README.md. Keep tokens server-side; never paste them into a security question.</p><button className="primary-button" onClick={()=>setSettings(false)}>Got it<Check size={16}/></button></Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>;
}
function Empty({title,text,icon}:{title:string;text:string;icon:React.ReactNode}) {return <div className="empty-state"><span className="empty-icon">{icon}</span><h2>{title}</h2><p>{text}</p></div>;}
function FindingCard({finding:f}:{finding:Finding}) {
  const d = f.advisory;
  const live = isLive(d);
  return <article className="finding-card"><div className="finding-top"><div><span className={'severity '+(d.severity??'unknown')}>{d.severity ?? 'Severity undocumented'}</span><span className="cve">{d.cve ?? d.advisoryId}</span><span className={'origin-badge '+originClass[f.origin]}>{origins[f.origin]}</span></div><a href={d.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={'Original source for '+d.advisoryId}><ArrowUpRight size={18}/></a></div><h3>{d.title}</h3><div className="finding-meta"><span>{d.packageName} <small>({d.ecosystem})</small></span><span>Published {date(d.publishedAt)}</span><span>{d.cvss !== null ? 'CVSS '+d.cvss : live && d.cvssVector ? d.cvssVector : 'CVSS score not documented'}</span><span>Retrieved {date(d.fetchedAt)}</span></div>{f.sourceVersionMatch !== null && <p className="cross-check"><Check size={13}/>Source version matcher: {f.sourceVersionMatch ? 'returned this advisory for the supplied version' : 'did not return this advisory for the supplied version'}.</p>}<div className={'assessment '+f.assessment.status}><ShieldCheck size={17}/><div><strong>{labels[f.assessment.status]}</strong><p>{f.assessment.reason}</p></div></div>{live && d.aliases.length > 0 && <p className="aliases">Also published as {d.aliases.join(', ')}</p>}{live && d.comparability !== 'semver' && <p className="muted">This source does not express affected versions as comparable semver ranges, so no automated version verdict was produced.</p>}{f.impactExcerpt && <div className="excerpt"><h4>Documented impact</h4><blockquote>{f.impactExcerpt}</blockquote></div>}<div className="range-table"><h4>Affected versions & documented fixes</h4><table><thead><tr><th>Affected range</th><th>First patched version</th></tr></thead><tbody>{d.ranges.map((r,i)=><tr key={i}><td><code>{r.affected}</code></td><td><code>{r.fixed ?? 'Not established by available sources'}</code></td></tr>)}</tbody></table><p className="muted">Fixes are specific to this advisory and release branch; they are not a recommendation to stay on an outdated release.</p></div><div className="excerpt"><h4>Remediation & conditions</h4><p>{f.remediationExcerpt || d.remediation || 'Review the documented branch-specific fixes above and the original advisory for deployment conditions.'}</p>{d.conditions?.map(c=><p key={c}>{c}</p>)}<p className="muted">Known exploitation: {d.exploitation ? <a href={d.exploitation.sourceUrl} target="_blank" rel="noopener noreferrer">{d.exploitation.status}</a> : 'Not established by available sources'}</p></div><details className="evidence-detail"><summary><Terminal size={14}/>Inspect supporting evidence</summary><p>{f.evidenceQuote}</p><small>{f.knowledgeBase} · {f.paths.join(', ')} · {live ? 'copied verbatim from the retrieved record by the application; no model selection' : 'passage selected by ID, text copied verbatim by the application'}</small><p><a href={d.sourceUrl} target="_blank" rel="noopener noreferrer">{d.advisoryId}<ArrowUpRight size={13}/></a></p></details></article>;
}

function CoverageSummary({coverage,onOpen}:{coverage:Coverage;onOpen:()=>void}) {
  const failed = coverage.sources.filter(s => s.status === 'failed' || s.status === 'partial');
  return <button className={'coverage-strip ' + (coverage.complete ? 'complete' : 'incomplete')} onClick={onOpen}>
    <span className="coverage-strip-icon">{coverage.complete ? <ShieldCheck size={17}/> : <AlertCircle size={17}/>}</span>
    <span className="coverage-strip-text">
      <strong>{coverage.complete ? 'All sources completed' : failed.length ? 'Incomplete: ' + failed.map(s => s.name).join(', ') + ' did not fully complete' : 'Incomplete coverage for this request'}</strong>
      <small>{coverage.identity.status === 'resolved' ? coverage.identity.ecosystem + '/' + coverage.identity.packageName : coverage.identity.status === 'ambiguous' ? 'Package not resolved: ' + coverage.identity.display : 'Unsupported: ' + coverage.identity.display}
        {' · '}{coverage.sources.length} source{coverage.sources.length === 1 ? '' : 's'} checked
        {coverage.live.advisoriesRetrieved > 0 && ' · ' + coverage.live.advisoriesRetrieved + ' live advisories retrieved'}</small>
    </span>
    <span className="coverage-strip-link">See what was checked<ArrowRight size={14}/></span>
  </button>;
}
function CoveragePanel({coverage}:{coverage:Coverage}) {
  const id = coverage.identity;
  return <div className="coverage">
    <div className="coverage-head">
      <div><h2>What was actually checked</h2><p className="muted">Recorded per request. Nothing here is inferred after the fact.</p></div>
      <span className={'coverage-state ' + (coverage.complete ? 'complete' : 'incomplete')}>{coverage.complete ? 'All sources completed' : 'Incomplete coverage'}</span>
    </div>
    <dl className="coverage-facts">
      <div><dt><Fingerprint size={13}/>Resolved package</dt><dd><span className="fact-value">{id.status === 'resolved' ? id.ecosystem + ' / ' + id.packageName : 'Not resolved'}</span>
        <small>{id.status === 'resolved' ? 'From "' + id.display + '" by ' + id.basis.replace(/-/g, ' ') : id.reason}</small></dd></div>
      <div><dt><Database size={13}/>Live advisories retrieved</dt><dd><span className="fact-value">{coverage.live.advisoriesRetrieved}</span>
        <small>{coverage.live.versionMatched === null ? 'No version supplied, so no source-side version match was requested' : coverage.live.versionMatched + ' matched by the source version matcher'}</small></dd></div>
      <div><dt><Clock size={13}/>Newest source record</dt><dd><span className="fact-value">{coverage.live.freshestRecordAt ? date(coverage.live.freshestRecordAt) : 'Not established'}</span>
        <small>{coverage.live.truncated ? 'Result set truncated at the page limit; some advisories are missing' : 'Most recently modified record returned'}</small></dd></div>
      <div><dt><BookOpen size={13}/>Curated entries</dt><dd><span className="fact-value">{coverage.knowledgeBase.entriesRead} read</span>
        <small>{coverage.knowledgeBase.advisoriesVerified} stored advisory record{coverage.knowledgeBase.advisoriesVerified === 1 ? '' : 's'} verified in the dataset</small></dd></div>
    </dl>
    <h3 className="coverage-subhead">Sources checked</h3>
    <ul className="source-checks">{coverage.sources.map(source => <li key={source.id} className={'source-check ' + source.status}>
      <span className="source-dot" aria-hidden="true"/>
      <div>
        <strong><span className="source-name">{source.name}</span><em>{sourceStates[source.status]}</em>{source.origin && <span className="origin-tag">{originTags[source.origin]}</span>}</strong>
        <p>{source.detail}</p>
        <small>Started {clock(source.startedAt)} · took {source.durationMs.toLocaleString()} ms</small>
      </div>
      <a href={source.url} target="_blank" rel="noopener noreferrer" aria-label={'About ' + source.name}><ArrowUpRight size={15}/></a>
    </li>)}</ul>
    <p className="coverage-caveat"><AlertCircle size={15}/>This is an advisory lookup against the sources listed above. It does not scan your source code, your installed dependency tree, or your running deployment. A source that did not complete cannot be read as an absence of advisories, and no match is not proof of safety.</p>
  </div>;
}

function DependencyResults({report}:{report:DependencyReport}) {
  return <div className="dep-report">
    <dl className="coverage-facts">
      <div><dt><Package size={13}/>Exact versions checked</dt><dd><span className="fact-value">{report.counts.queried.toLocaleString()}</span><small>lockfileVersion {report.lockfileVersion}{report.truncated ? '; more dependencies than this request will query' : ''}</small></dd></div>
      <div><dt><AlertCircle size={13}/>With advisories</dt><dd><span className="fact-value">{report.counts.withAdvisories}</span><small>{report.counts.advisories} matched source identifier{report.counts.advisories === 1 ? '' : 's'}; aliases may overlap</small></dd></div>
      <div><dt><Clock size={13}/>Lookup</dt><dd><span className="fact-value">{report.source.durationMs.toLocaleString()} ms</span><small>{report.source.name}</small></dd></div>
      <div><dt><ShieldCheck size={13}/>Result</dt><dd><span className="fact-value">{report.complete ? 'Completed' : 'Incomplete'}</span><small>{report.source.detail}</small></dd></div>
    </dl>
    {report.skipped.length > 0 && <p className="muted upload-name">Not checked: {report.skipped.map(s => s.count + ' × ' + s.reason).join('; ')}.</p>}
    {report.results.length === 0
      ? <p className="coverage-caveat"><AlertCircle size={15}/>No advisory matched any exact version in this lockfile. That is not proof these dependencies are free of vulnerabilities.</p>
      : <ul className="dep-list">{report.results.map(result => <li key={result.name + '@' + result.version} className="dep-item">
          <div className="dep-head">
            <strong><span className="dep-name">{result.name}</span><code>{result.version}</code>{result.dev && <span className="dep-tag">dev</span>}</strong>
            <span className="dep-count">{result.advisoryIds.length} matching source record{result.advisoryIds.length === 1 ? '' : 's'}</span>
          </div>
          <small className="muted">{result.paths[0]}{result.paths.length > 1 ? ' (+' + (result.paths.length - 1) + ' more path' + (result.paths.length > 2 ? 's' : '') + ')' : ''}</small>
          {result.detailed
            ? <ul className="dep-advisories">{result.findings.slice(0, 6).map(f => <li key={f.advisory.advisoryId}>
                <span className={'severity ' + (f.advisory.severity ?? 'unknown')}>{f.advisory.severity ?? 'undocumented'}</span>
                <a href={f.advisory.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={"Open source record " + f.advisory.advisoryId}>{f.advisory.advisoryId}<ArrowUpRight size={12}/></a>
                 {f.advisory.cve && f.advisory.cve !== f.advisory.advisoryId && <span className="dep-alias">also {f.advisory.cve}</span>}
                <em>{labels[f.assessment.status]}</em>
                <span className="dep-fix">Source lists fixed: {f.advisory.ranges.map(r => r.fixed).filter(Boolean).slice(0, 3).join(', ') || 'none documented'}</span>
              </li>)}{result.findings.length > 6 && <li className="muted">and {result.findings.length - 6} more</li>}</ul>
            : <p className="muted">Advisory identifiers only for this package: {result.advisoryIds.slice(0, 8).join(', ')}{result.advisoryIds.length > 8 ? ' and ' + (result.advisoryIds.length - 8) + ' more' : ''}. Look them up individually for details.</p>}
           {result.detailed && result.findings.some((f, i, all) => Boolean(f.advisory.cve) && all.findIndex(other => other.advisory.cve === f.advisory.cve) < i) && <p className="dep-overlap">Some source records share a CVE but list different affected ranges or fixes. Review each linked record before choosing an upgrade.</p>}
        </li>)}</ul>}
    <div className="limitations"><h3><AlertCircle size={16}/>What this check does and does not cover</h3><ul>{report.limitations.map(l => <li key={l}>{l}</li>)}</ul></div>
  </div>;
}

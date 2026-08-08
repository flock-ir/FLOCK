import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, AlertTriangle, ArrowLeftRight, Boxes, CheckCircle2, ChevronDown, ChevronRight,
  Clock3, FileText, Fingerprint, History, LayoutDashboard, Plus, Search, Settings, Shield,
  Sparkles, Users, Workflow, X
} from 'lucide-react';
import './styles.css';

const phases = ['New','Triage','Investigation','Containment','Eradication','Recovery','Monitoring','Post Incident Review','Closed'];
const adjectives = ['amber','brisk','cedar','cobalt','coral','distant','ember','gentle','hidden','lunar','misty','northern','open','polar','quiet','silver','silent','velvet','violet','winter'];
const nouns = ['anchor','atlas','beacon','brook','cascade','compass','drift','field','flock','garden','harbor','lantern','meadow','orbit','orchid','pine','ridge','river','summit','wave'];

const phaseGuidance = {
  'New': ['Capture initial signal', 'Confirm incident ownership', 'Record source and context'],
  'Triage': ['Validate the signal', 'Assess impact and urgency', 'Assign incident commander', 'Decide whether to escalate'],
  'Investigation': ['Confirm scope', 'Preserve relevant evidence', 'Identify affected identities and assets', 'Establish likely root cause'],
  'Containment': ['Stop active access paths', 'Isolate affected assets', 'Apply temporary mitigations', 'Validate containment effectiveness'],
  'Eradication': ['Remove persistence', 'Revoke compromised credentials', 'Remove malicious artifacts', 'Close exploited paths'],
  'Recovery': ['Restore affected services', 'Validate clean state', 'Return assets to production', 'Obtain operational sign-off'],
  'Monitoring': ['Watch for recurrence', 'Validate detections', 'Review related identities/assets', 'Confirm residual risk'],
  'Post Incident Review': ['Complete chronology', 'Capture lessons learned', 'Assign follow-up actions', 'Prepare final report'],
  'Closed': ['Incident record complete', 'Follow-up work tracked separately']
};

const starterIncidents = [
  makeIncident('INC-2026-00142','purple-flock','Suspicious OAuth application consent','SEV2','Investigation','Maya Chen','Identity','High-risk consent granted to a newly registered OAuth application by a privileged account.',['entra','oauth','privileged'],52),
  makeIncident('INC-2026-00141','silent-anchor','Impossible travel with mailbox rule creation','SEV2','Triage','Alex Morgan','SIEM','Sign-in anomaly followed by inbox forwarding rule creation and token use.',['m365','account-takeover'],76),
  makeIncident('INC-2026-00139','cedar-wave','Unsigned binary executed on build runner','SEV1','New','Unassigned','EDR','Unknown binary launched in CI infrastructure with outbound connection to a newly observed ASN.',['cicd','endpoint','egress'],9),
  makeIncident('INC-2026-00137','velvet-compass','Credential stuffing against customer login','SEV3','Containment','Sam Lee','WAF','Elevated failed authentication activity distributed across cloud-hosted sources.',['ato','customer','waf'],201),
  makeIncident('INC-2026-00134','hidden-cascade','Suspicious PowerShell on finance endpoint','SEV3','Investigation','Nina Patel','EDR','Encoded PowerShell spawned by Office process. No persistence confirmed.',['powershell','finance'],388),
  makeIncident('INC-2026-00128','polar-lantern','Public storage bucket exposure','SEV4','Closed','Liam Hart','CSPM','Temporary public ACL exposure; no evidence of access before remediation.',['cloud','storage'],3020),
];

function makeIncident(id,codename,title,severity,phase,owner,source,summary,tags,minutesAgo) {
  const createdAt = new Date(Date.now() - minutesAgo*60000).toISOString();
  return { id,codename,title,severity,phase,owner,source,createdAt,summary,tags,
    tasks: phaseGuidance[phase].slice(0,6).map((label,i)=>({label,done:i<2 && phase!=='New'})),
    audit:[{id:crypto.randomUUID(),at:createdAt,actor:'Flock',type:'created',message:`Incident created as ${codename}`}] };
}
function age(iso){ const m=Math.max(1,Math.floor((Date.now()-new Date(iso).getTime())/60000)); return m<60?`${m}m`:m<1440?`${Math.floor(m/60)}h ${m%60}m`:`${Math.floor(m/1440)}d`; }
function severityRank(sev){ return Number(sev.replace('SEV','')); }
function phaseIndex(p){ return phases.indexOf(p); }
function neutralCodename(existing){ for(let i=0;i<500;i++){ const name=`${adjectives[Math.floor(Math.random()*adjectives.length)]}-${nouns[Math.floor(Math.random()*nouns.length)]}`; if(!existing.has(name)) return name; } return `quiet-${Math.random().toString(36).slice(2,8)}`; }
function nextIncidentId(items){ const max=Math.max(...items.map(i=>Number(i.id.split('-').pop())||0)); return `INC-2026-${String(max+1).padStart(5,'0')}`; }

function App(){
  const [incidents,setIncidents]=useState(()=>{ try{ const x=localStorage.getItem('flock-incidents-v02'); return x?JSON.parse(x):starterIncidents; }catch{return starterIncidents;} });
  const [selectedId,setSelectedId]=useState(incidents[0].id);
  const [query,setQuery]=useState(''); const [draggedId,setDraggedId]=useState(null);
  const [transition,setTransition]=useState(null); const [reason,setReason]=useState('');
  const [newOpen,setNewOpen]=useState(false); const [newTitle,setNewTitle]=useState('');
  useEffect(()=>localStorage.setItem('flock-incidents-v02',JSON.stringify(incidents)),[incidents]);
  const selected=incidents.find(i=>i.id===selectedId) || incidents[0];
  const filtered=useMemo(()=>incidents.filter(i=>`${i.id} ${i.codename} ${i.title} ${i.owner} ${i.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())),[incidents,query]);
  const openCount=incidents.filter(i=>i.phase!=='Closed').length;

  function requestMove(id,to){ const incident=incidents.find(i=>i.id===id); if(!incident || incident.phase===to)return; setTransition({id,to}); setReason(''); }
  function confirmMove(){ if(!transition)return; setIncidents(items=>items.map(i=>{ if(i.id!==transition.id)return i; const ev={id:crypto.randomUUID(),at:new Date().toISOString(),actor:'Current responder',type:'transition',message:`Phase changed from ${i.phase} to ${transition.to}`,from:i.phase,to:transition.to,reason:reason.trim()||'No reason provided'}; return {...i,phase:transition.to,audit:[ev,...i.audit],tasks:phaseGuidance[transition.to].map((label,idx)=>({label,done:i.tasks.find(t=>t.label===label)?.done ?? false}))}; })); setTransition(null); setReason(''); }
  function toggleTask(label){ setIncidents(items=>items.map(i=>i.id===selected.id?{...i,tasks:i.tasks.map(t=>t.label===label?{...t,done:!t.done}:t)}:i)); }
  function createIncident(){ if(!newTitle.trim())return; const codename=neutralCodename(new Set(incidents.map(i=>i.codename))); const id=nextIncidentId(incidents); const inc=makeIncident(id,codename,newTitle.trim(),'SEV3','New','Unassigned','Manual','New incident awaiting triage.',[],0); setIncidents(v=>[inc,...v]); setSelectedId(id); setNewTitle(''); setNewOpen(false); }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><span>F</span></div><div><strong>Flock</strong><small>Incident Response</small></div></div>
      <nav>
        <a className="active"><LayoutDashboard size={18}/> Incident board</a><a><AlertTriangle size={18}/> Incidents <span className="nav-count">{openCount}</span></a>
        <a><Activity size={18}/> Timeline</a><a><Workflow size={18}/> Playbooks</a><a><Boxes size={18}/> Assets</a><a><Users size={18}/> Teams</a><a><FileText size={18}/> Reports</a>
      </nav>
      <div className="sidebar-bottom"><div className="pr3-link"><Shield size={17}/><div><strong>PR3TACK</strong><span>Connected guidance</span></div></div><a><Settings size={18}/> Settings</a><div className="profile"><div className="avatar">VT</div><div><strong>Vishal</strong><span>Incident Commander</span></div></div></div>
    </aside>

    <main className="main">
      <header className="topbar"><div><div className="eyebrow">FLOCK / SECURITY INCIDENT MANAGEMENT</div><h1>Incident response</h1><p>One workflow from signal to closure.</p></div><div className="top-actions"><div className="search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search names, incidents, assets..."/></div><button className="primary" onClick={()=>setNewOpen(true)}><Plus size={17}/> New incident</button></div></header>

      <section className="metrics">
        <div className="metric"><span>Active incidents</span><strong>{openCount}</strong><small>{incidents.filter(i=>i.phase==='Investigation').length} under investigation</small></div>
        <div className="metric"><span>In containment</span><strong>{incidents.filter(i=>i.phase==='Containment').length}</strong><small>Active response actions</small></div>
        <div className="metric"><span>Median triage</span><strong>11m</strong><small>Operational target: 15m</small></div>
        <div className="metric"><span>Lifecycle</span><strong>{phases.length}</strong><small>Audited phases</small></div>
      </section>

      <section className="workspace">
        <div className="board-panel">
          <div className="section-head"><div><div className="section-kicker"><ArrowLeftRight size={14}/> BIDIRECTIONAL LIFECYCLE</div><h2>Incident workflow</h2><p>Drag any incident between phases. Every transition is recorded in its audit history.</p></div><button className="ghost"><Sparkles size={15}/> Phase guidance on</button></div>
          <div className="board">
            {phases.map(phase=>{ const items=filtered.filter(i=>i.phase===phase).sort((a,b)=>severityRank(a.severity)-severityRank(b.severity)); return <div className={`column phase-${phaseIndex(phase)}`} key={phase} onDragOver={e=>e.preventDefault()} onDrop={()=>{if(draggedId)requestMove(draggedId,phase)}}>
              <div className="column-title"><span>{phase}</span><b>{items.length}</b></div><div className="dropzone">
                {items.map(i=><article key={i.id} draggable onDragStart={()=>setDraggedId(i.id)} onDragEnd={()=>setDraggedId(null)} onClick={()=>setSelectedId(i.id)} className={`incident-card ${selected.id===i.id?'selected':''}`}>
                  <div className="card-top"><span className={`severity ${i.severity.toLowerCase()}`}>{i.severity}</span><span className="age"><Clock3 size={12}/>{age(i.createdAt)}</span></div>
                  <div className="codename">{i.codename}</div><h3>{i.title}</h3><div className="meta"><span>{i.id}</span><span>•</span><span>{i.source}</span></div>
                  <div className="tags">{i.tags.slice(0,2).map(t=><span key={t}>{t}</span>)}</div><div className="owner"><div className="mini-avatar">{i.owner==='Unassigned'?'?':i.owner.split(' ').map(x=>x[0]).join('')}</div><span>{i.owner}</span><ChevronRight size={14}/></div>
                </article>)}
                {items.length===0&&<div className="empty">Drop here</div>}
              </div></div>})}
          </div>
        </div>

        <aside className="detail-panel">
          <div className="detail-top"><div><span className="call-sign">CALL SIGN</span><h2>{selected.codename}</h2><span className="detail-id">{selected.id}</span></div><span className={`severity ${selected.severity.toLowerCase()}`}>{selected.severity}</span></div>
          <h3 className="incident-title">{selected.title}</h3><p className="summary">{selected.summary}</p>
          <div className="phase-control"><label>CURRENT PHASE</label><button className="phase-button">{selected.phase}<ChevronDown size={15}/></button><div className="phase-menu">{phases.map(p=><button key={p} disabled={p===selected.phase} onClick={()=>requestMove(selected.id,p)}><span>{p}</span>{p===selected.phase&&<CheckCircle2 size={14}/>}</button>)}</div></div>
          <div className="quick-meta"><div><label>Owner</label><strong>{selected.owner}</strong></div><div><label>Source</label><strong>{selected.source}</strong></div><div><label>Age</label><strong>{age(selected.createdAt)}</strong></div><div><label>Audit events</label><strong>{selected.audit.length}</strong></div></div>
          <div className="divider"/>
          <section className="mini-section"><div className="mini-title"><div><span className="mini-kicker">PHASE GUIDANCE</span><h3>{selected.phase}</h3></div><span>{selected.tasks.filter(t=>t.done).length} / {selected.tasks.length}</span></div>{selected.tasks.map(t=><label className="task" key={t.label}><input type="checkbox" checked={t.done} onChange={()=>toggleTask(t.label)}/><span>{t.label}</span></label>)}</section>
          <div className="divider"/>
          <section className="mini-section"><div className="mini-title"><div><span className="mini-kicker">CONNECTED</span><h3>PR3TACK context</h3></div><span className="connected-dot">LIVE</span></div><div className="pr3-card"><Shield size={19}/><div><strong>Preemptive guidance available</strong><p>Relevant mitigations, detections and preemptive TTPs can be linked directly to this incident.</p></div></div></section>
          <div className="divider"/>
          <section className="mini-section"><div className="mini-title"><div><span className="mini-kicker">IMMUTABLE HISTORY</span><h3>Audit timeline</h3></div><History size={15}/></div><div className="timeline">{selected.audit.slice(0,5).map(ev=><div className="timeline-event" key={ev.id}><div className="event-dot"/><div><div className="event-time">{new Date(ev.at).toLocaleString([], {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})} · {ev.actor}</div><strong>{ev.message}</strong>{ev.reason&&<p>{ev.reason}</p>}</div></div>)}</div></section>
        </aside>
      </section>
    </main>

    {transition&&<div className="modal-backdrop" onMouseDown={()=>setTransition(null)}><div className="modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-x" onClick={()=>setTransition(null)}><X size={18}/></button><div className="modal-icon"><ArrowLeftRight size={20}/></div><span className="modal-kicker">AUDITED TRANSITION</span><h2>Move incident phase</h2><div className="transition-path"><strong>{incidents.find(i=>i.id===transition.id)?.phase}</strong><ChevronRight size={18}/><strong>{transition.to}</strong></div><label className="reason-label">Reason for transition</label><textarea autoFocus value={reason} onChange={e=>setReason(e.target.value)} placeholder="What changed? Add context for the incident record."/><p className="audit-note"><History size={14}/> This transition, actor, timestamp and reason are added to the audit history.</p><div className="modal-actions"><button className="ghost" onClick={()=>setTransition(null)}>Cancel</button><button className="primary" onClick={confirmMove}>Move incident</button></div></div></div>}
    {newOpen&&<div className="modal-backdrop" onMouseDown={()=>setNewOpen(false)}><div className="modal compact" onMouseDown={e=>e.stopPropagation()}><button className="modal-x" onClick={()=>setNewOpen(false)}><X size={18}/></button><span className="modal-kicker">NEW INCIDENT</span><h2>Create incident</h2><p className="modal-copy">Flock will assign a neutral, unique two-word call sign. It carries no severity, threat type, customer or region information.</p><label className="reason-label">Incident title</label><input className="text-input" autoFocus value={newTitle} onChange={e=>setNewTitle(e.target.value)} onKeyDown={e=>e.key==='Enter'&&createIncident()} placeholder="What are we responding to?"/><div className="name-preview"><Fingerprint size={16}/><span>Example call sign</span><strong>{neutralCodename(new Set(incidents.map(i=>i.codename)))}</strong></div><div className="modal-actions"><button className="ghost" onClick={()=>setNewOpen(false)}>Cancel</button><button className="primary" onClick={createIncident}>Create incident</button></div></div></div>}
  </div>
}
createRoot(document.getElementById('root')).render(<App/>);

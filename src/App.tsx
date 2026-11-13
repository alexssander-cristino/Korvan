import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity, AlertTriangle, ArrowUpRight, Bell, Check,
  ChevronDown, Clock3, Cpu, Database, Gauge, LayoutDashboard,
  LifeBuoy, LogOut, Plus, RefreshCw, Search, Server,
  Settings2, ShieldCheck, Signal, Workflow, Zap, X, Pencil, Trash2,
} from "lucide-react";

type System = {
  id: string; system_key: string; name: string; description: string | null;
  base_url: string | null; enabled: boolean; created_at: string;
};
type Event = {
  id: number; system_key: string; event_type: string; status: "ok" | "warning" | "error";
  message: string | null; duration_ms: number | null; created_at: string;
  metadata?: Record<string, unknown>;
};
type Overview = {
  systems: System[];
  stats: { checks_24h: number; errors_24h: number; warnings_24h: number; avg_latency_ms: number | null; p95_latency_ms: number | null };
  uptime: { system_key: string; uptime_24h: number; avg_latency_ms: number | null; last_status: "ok" | "warning" | "error"; last_check: string }[];
  activity: Event[];
};
type Tab = "overview" | "systems" | "incidents" | "performance" | "workers" | "alerts" | "integrations" | "settings";

const tabs: { id: Tab; label: string; icon: typeof Activity; group: string }[] = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard, group: "MONITORAMENTO" },
  { id: "systems", label: "Sistemas", icon: Server, group: "MONITORAMENTO" },
  { id: "incidents", label: "Incidentes", icon: Activity, group: "MONITORAMENTO" },
  { id: "performance", label: "Desempenho", icon: Gauge, group: "MONITORAMENTO" },
  { id: "workers", label: "Workers", icon: Workflow, group: "MONITORAMENTO" },
  { id: "alerts", label: "Alertas", icon: Bell, group: "GERENCIAMENTO" },
  { id: "integrations", label: "Integrações", icon: Database, group: "GERENCIAMENTO" },
  { id: "settings", label: "Configurações", icon: Settings2, group: "GERENCIAMENTO" },
];

async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `request_failed_${response.status}`);
  return data as T;
}
const fmtTime = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "Nunca";
const fmtMs = (value?: number | null) => value == null ? "—" : `${Math.round(value)} ms`;
const errorText: Record<string, string> = {
  auth_not_configured: "Configure PRYSM_ADMIN_PASSWORD e PRYSM_SESSION_SECRET nas variáveis de ambiente.",
  database_not_configured: "Configure DATABASE_URL e aplique a migration do banco.",
  invalid_credentials: "Senha incorreta.",
  system_key_exists: "Essa chave já está cadastrada.",
  invalid_base_url: "Informe uma URL HTTP ou HTTPS válida.",
  unauthorized: "Sua sessão expirou. Entre novamente.",
};

function Status({ status }: { status: string }) {
  const label = status === "ok" ? "Operacional" : status === "error" ? "Falha" : status === "warning" ? "Atenção" : "Sem dados";
  return <span className={`status-pill ${status === "ok" ? "good" : status === "error" ? "bad" : status === "warning" ? "warn" : "neutral"}`}><i />{label}</span>;
}

function Login({ onLogin }: { onLogin: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { await onLogin(password); } catch (err) { setError(errorText[(err as Error).message] || "Não foi possível entrar."); }
    finally { setBusy(false); }
  }
  return <main className="login-screen"><form className="login-card" onSubmit={submit}>
    <div className="login-brand"><div className="brand-mark"><Signal size={22}/></div><div><b>PRYSM</b><span>SYSTEM CONTROL</span></div></div>
    <div className="eyebrow"><span/> ACESSO RESTRITO</div><h1>Bem-vindo de volta</h1><p>Entre para acessar sua central privada de monitoramento.</p>
    <label>Senha administrativa<input autoFocus type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Digite sua senha" required /></label>
    {error && <div className="form-error">{error}</div>}
    <button className="primary-button full-button" disabled={busy}>{busy ? "Validando..." : "Entrar na central"}</button>
    <small>Ambiente privado · Acesso exclusivo do administrador</small>
  </form></main>;
}

function SystemModal({ system, onClose, onSave, onDelete }: {
  system: System | null; onClose: () => void; onSave: (data: {name:string;systemKey:string;description:string;baseUrl:string;enabled:boolean}) => Promise<void>;
  onDelete?: (system: System) => Promise<void>;
}) {
  const [name,setName]=useState(system?.name||"");
  const [systemKey,setSystemKey]=useState(system?.system_key||"");
  const [description,setDescription]=useState(system?.description||"");
  const [baseUrl,setBaseUrl]=useState(system?.base_url||"");
  const [enabled,setEnabled]=useState(system?.enabled ?? true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError("");try{await onSave({name,systemKey,description,baseUrl,enabled});onClose();}catch(err){setError(errorText[(err as Error).message]||"Não foi possível salvar o sistema.");}finally{setBusy(false);}}
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><form className="modal-card" onSubmit={submit}>
    <div className="modal-heading"><div><h2>{system ? "Editar sistema" : "Adicionar sistema"}</h2><p>Cadastre um endpoint para iniciar o monitoramento.</p></div><button type="button" className="icon-button" onClick={onClose}><X size={18}/></button></div>
    <label>Nome do sistema<input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Menuza" required minLength={2}/></label>
    <label>Chave única<input value={systemKey} onChange={e=>setSystemKey(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g,"-"))} placeholder="menuza" required pattern="[a-z0-9_-]{2,64}" disabled={!!system}/><small>Identificador usado pelos agentes de telemetria. Não pode ser alterado depois.</small></label>
    <label>URL principal<input type="url" value={baseUrl} onChange={e=>setBaseUrl(e.target.value)} placeholder="https://seusistema.com" /></label>
    <label>Descrição<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={2} maxLength={500} placeholder="O que esse sistema faz?"/></label>
    {system && <label className="toggle-line"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Sistema habilitado para monitoramento</label>}
    {error && <div className="form-error">{errorText[error]||error}</div>}
    <div className="modal-actions">{system && onDelete && <button type="button" className="danger-button" disabled={busy} onClick={async()=>{if(confirm(`Excluir ${system.name} e seu histórico de eventos?`)){setBusy(true);try{await onDelete(system);onClose();}catch(err){setError((err as Error).message);}finally{setBusy(false);}}}}><Trash2 size={15}/> Excluir</button>}<button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy}>{busy?"Salvando...":"Salvar sistema"}</button></div>
  </form></div>;
}

export default function App() {
  const [authenticated,setAuthenticated]=useState<boolean|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [overview,setOverview]=useState<Overview|null>(null);
  const [events,setEvents]=useState<Event[]>([]);
  const [tab,setTab]=useState<Tab>("overview");
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState("all");
  const [modal,setModal]=useState<"new"|System|null>(null);
  const [checking,setChecking]=useState(false);
  const [lastCheck,setLastCheck]=useState("");
  const [toast,setToast]=useState("");

  const loadData=useCallback(async()=>{
    setLoading(true);setError("");
    try {
      const [data,eventData]=await Promise.all([api<Overview>("/api/overview"),api<{events:Event[]}>("/api/events?limit=100")]);
      setOverview(data);setEvents(eventData.events);
    } catch(err) { const message=(err as Error).message; if(message==="unauthorized")setAuthenticated(false); setError(errorText[message]||message); }
    finally {setLoading(false);}
  },[]);

  useEffect(()=>{api<{authenticated:boolean}>("/api/auth").then(r=>setAuthenticated(r.authenticated)).catch(()=>setAuthenticated(false));},[]);
  useEffect(()=>{if(authenticated)loadData();},[authenticated,loadData]);
  useEffect(()=>{
    if(!authenticated)return;
    const interval=window.setInterval(()=>loadData(),30000);
    return ()=>window.clearInterval(interval);
  },[authenticated,loadData]);

  async function login(password:string){await api("/api/auth",{method:"POST",body:JSON.stringify({password})});setAuthenticated(true);}
  async function logout(){await api("/api/auth",{method:"DELETE"});setAuthenticated(false);setOverview(null);setEvents([]);}
  async function saveSystem(data:{name:string;systemKey:string;description:string;baseUrl:string;enabled:boolean}){
    if(modal && modal!=="new") await api("/api/system?id="+encodeURIComponent(modal.id),{method:"PATCH",body:JSON.stringify(data)});
    else await api("/api/systems",{method:"POST",body:JSON.stringify(data)});
    await loadData();setToast("Sistema salvo com sucesso.");
  }
  async function deleteSystem(system:System){await api("/api/system?id="+encodeURIComponent(system.id),{method:"DELETE"});await loadData();setToast("Sistema excluído.");}
  async function runChecks(){
    setChecking(true);setError("");
    try{const result=await api<{checked:number;results:{name:string;status:string}[]}>("/api/check",{method:"POST",body:"{}"});setLastCheck(new Date().toLocaleTimeString("pt-BR"));setToast(`Verificação concluída: ${result.checked} sistema(s) verificado(s).`);await loadData();}
    catch(err){const message=(err as Error).message;setError(errorText[message]||message);}
    finally{setChecking(false);}
  }

  const systems=overview?.systems||[];
  const uptimeByKey=useMemo(()=>new Map((overview?.uptime||[]).map(item=>[item.system_key,item])),[overview]);
  const visibleSystems=systems.filter(s=>(s.name+" "+s.system_key+" "+(s.base_url||"")).toLowerCase().includes(search.toLowerCase()));
  const filteredEvents=events.filter(e=>(statusFilter==="all"||e.status===statusFilter)&&((tab!=="incidents"&&tab!=="alerts")||e.status!=="ok"));
  const title=tabs.find(t=>t.id===tab)?.label||"Visão geral";

  if(authenticated===null)return <div className="boot-screen"><div className="brand-mark"><Signal size={20}/></div><span>Iniciando Prysm...</span></div>;
  if(!authenticated)return <Login onLogin={login}/>;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Signal size={20}/></div><div><b>PRYSM</b><span>SYSTEM CONTROL</span></div></div>
      <div className="workspace"><div className="workspace-avatar">A</div><div><b>Workspace pessoal</b><span>Ambiente privado</span></div><ChevronDown size={15}/></div>
      {(["MONITORAMENTO","GERENCIAMENTO"] as const).map(group=><div key={group}><div className={group==="GERENCIAMENTO"?"nav-label second-label":"nav-label"}>{group}</div><nav>{tabs.filter(item=>item.group===group).map(item=><button key={item.id} className={`nav-item ${tab===item.id?"active":""}`} onClick={()=>setTab(item.id)}><item.icon size={18}/>{item.label}{item.id==="systems"&&<span className="nav-count">{String(systems.length).padStart(2,"0")}</span>}{item.id==="incidents"&&<span className="nav-count">{overview?.stats.errors_24h||0}</span>}</button>)}</nav></div>)}
      <div className="sidebar-bottom"><div className="help-card"><div><LifeBuoy size={17}/><b>Central de operações</b></div><p>Monitoramento privado dos seus sistemas.</p><a onClick={()=>setTab("settings")}>Configurar central <ArrowUpRight size={13}/></a></div><div className="profile"><div className="profile-avatar">AC</div><div><b>Administrador</b><span>Acesso proprietário</span></div><button className="icon-button" onClick={logout} aria-label="Sair"><LogOut size={17}/></button></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs">Workspace <span>/</span><b>{title}</b></div><div className="top-actions"><div className="live-indicator"><i className="live-dot"/> Sessão protegida</div><button className="icon-button" onClick={loadData} aria-label="Atualizar"><RefreshCw size={17}/></button><button className="icon-button" onClick={()=>setTab("alerts")} aria-label="Alertas"><Bell size={18}/></button><div className="top-avatar">AC</div></div></header>
      <div className="page-content">
        <section className="welcome-row"><div><div className="eyebrow"><span/> CENTRAL DE OPERAÇÕES</div><h1>{title}</h1><p>{tab==="overview"?"Acompanhe a saúde, disponibilidade e desempenho dos seus sistemas.":tab==="systems"?"Cadastre e gerencie os endpoints monitorados.":tab==="incidents"?"Falhas e alertas registrados pelos monitores.":tab==="performance"?"Latência e disponibilidade calculadas a partir das verificações.":"Configurações e recursos da central Prysm."}</p></div><div className="welcome-actions"><button className="secondary-button" onClick={loadData} disabled={loading}><RefreshCw size={15}/> Atualizar</button><button className="primary-button" onClick={runChecks} disabled={checking}><Activity size={16}/>{checking?"Verificando...":"Verificar agora"}</button>{tab==="systems"&&<button className="primary-button" onClick={()=>setModal("new")}><Plus size={16}/> Adicionar sistema</button>}</div></section>
        {error&&<div className="notice error-notice"><AlertTriangle size={17}/><span>{errorText[error]||error}</span><button onClick={()=>setError("")}><X size={15}/></button></div>}
        {tab==="overview"&&<><section className="metrics-grid">
          <Metric label="Sistemas cadastrados" value={String(systems.length).padStart(2,"0")} note={`${systems.filter(s=>s.enabled).length} habilitados para monitoramento`} icon={Server}/>
          <Metric label="Disponibilidade média" value={overview?.uptime.length?(`${(overview.uptime.reduce((a,b)=>a+Number(b.uptime_24h),0)/overview.uptime.length).toFixed(2)}%`):"—"} note="Baseada nas verificações das últimas 24h" icon={Signal}/>
          <Metric label="Falhas nas últimas 24h" value={String(overview?.stats.errors_24h??0)} note={`${overview?.stats.checks_24h??0} verificações realizadas`} icon={AlertTriangle}/>
          <Metric label="Latência média" value={fmtMs(overview?.stats.avg_latency_ms)} note={`P95: ${fmtMs(overview?.stats.p95_latency_ms)}`} icon={Gauge}/>
        </section><section className="section-heading"><div><h2>Seus sistemas</h2><p>Estado atual dos serviços monitorados.</p></div><button className="text-button" onClick={()=>setTab("systems")}>Gerenciar sistemas <ArrowUpRight size={15}/></button></section>
        <SystemsTable systems={systems.slice(0,6)} uptimeByKey={uptimeByKey} onEdit={s=>setModal(s)}/>
        <div className="bottom-grid"><section className="panel"><div className="panel-heading"><div><h3>Atividade recente</h3><p>Últimos eventos registrados na central.</p></div><Clock3 size={17}/></div><EventList events={overview?.activity||[]}/></section><section className="panel"><div className="panel-heading"><div><h3>Saúde da infraestrutura</h3><p>Estado dos componentes principais.</p></div><Cpu size={17}/></div><div className="infra-list"><div><span><Database size={16}/> Banco de dados</span><b className="connected">Conectado</b></div><div><span><Zap size={16}/> Verificador HTTP</span><b className="connected">Disponível</b></div><div><span><ShieldCheck size={16}/> Sessão administrativa</span><b className="connected">Protegida</b></div></div></section></div></>}
        {tab==="systems"&&<><div className="list-toolbar"><div className="search-control"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nome, chave ou URL"/></div><span>{visibleSystems.length} de {systems.length} sistemas</span></div><SystemsTable systems={visibleSystems} uptimeByKey={uptimeByKey} onEdit={s=>setModal(s)}/></>}
        {(tab==="incidents"||tab==="alerts")&&<><div className="list-toolbar"><div className="filter-control"><label>Filtrar status</label><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">Todos</option><option value="error">Falhas</option><option value="warning">Atenção</option><option value="ok">Operacionais</option></select></div><span>{filteredEvents.length} eventos encontrados</span></div><section className="systems-card"><EventTable events={filteredEvents}/></section></>}
        {tab==="performance"&&<><section className="metrics-grid"><Metric label="Latência média" value={fmtMs(overview?.stats.avg_latency_ms)} note="Últimas 24 horas" icon={Gauge}/><Metric label="Latência P95" value={fmtMs(overview?.stats.p95_latency_ms)} note="Percentil 95 das verificações" icon={Activity}/><Metric label="Verificações" value={String(overview?.stats.checks_24h??0)} note="Últimas 24 horas" icon={Zap}/><Metric label="Alertas de atenção" value={String(overview?.stats.warnings_24h??0)} note="Últimas 24 horas" icon={AlertTriangle}/></section><section className="systems-card performance-card"><div className="table-toolbar"><b>Disponibilidade por sistema</b><span>Janela móvel de 24 horas</span></div>{systems.map(s=><div className="performance-row" key={s.id}><div><b>{s.name}</b><span>{s.base_url||"URL não configurada"}</span></div><strong>{uptimeByKey.has(s.system_key)?`${Number(uptimeByKey.get(s.system_key)?.uptime_24h).toFixed(2)}%`:"Sem dados"}</strong><span>Última verificação: {fmtTime(uptimeByKey.get(s.system_key)?.last_check)}</span></div>)}</section><section className="systems-card"><div className="table-toolbar"><b>Histórico de verificações</b></div><EventTable events={events.filter(e=>e.event_type==="http.check")}/></section></>}
        {tab==="workers"&&<section className="panel detail-panel"><div className="panel-heading"><div><h3>Agentes e workers</h3><p>O coletor HTTP integrado já executa verificações sob demanda.</p></div><Workflow size={18}/></div><div className="infra-list"><div><span>Verificador HTTP sob demanda</span><b className="connected">Ativo</b></div><div><span>Agente externo de telemetria</span><b className="waiting">Aguardando integração</b></div><div><span>Execução recorrente</span><b className="waiting">Cron não configurado</b></div></div><p className="muted-paragraph">Configure um Cron Job para chamar POST /api/check com Authorization: Bearer PRYSM_CRON_SECRET. Assim o monitoramento roda automaticamente, mesmo sem o painel aberto.</p></section>}
        {tab==="integrations"&&<section className="panel detail-panel"><div className="panel-heading"><div><h3>Integrações</h3><p>Serviços conectados à central.</p></div><Database size={18}/></div><div className="integration-item"><div className="integration-symbol"><Database size={18}/></div><div><b>Neon PostgreSQL</b><span>Armazenamento de sistemas e telemetria</span></div><Status status={overview?"ok":"warning"}/></div><div className="integration-item"><div className="integration-symbol"><Signal size={18}/></div><div><b>HTTP Monitor</b><span>Checagem de disponibilidade e latência</span></div><Status status="ok"/></div><div className="integration-item"><div className="integration-symbol"><Zap size={18}/></div><div><b>Ingestão de eventos</b><span>POST /api/ingest · autenticação por token</span></div><Status status="warning"/></div></section>}
        {tab==="settings"&&<section className="panel detail-panel"><div className="panel-heading"><div><h3>Configurações da central</h3><p>Informações operacionais e segurança.</p></div><Settings2 size={18}/></div><div className="settings-row"><span>Produto</span><b>Prysm System Control</b></div><div className="settings-row"><span>Versão</span><b>0.2.0</b></div><div className="settings-row"><span>Autenticação</span><b className="connected">Sessão assinada · HttpOnly</b></div><div className="settings-row"><span>Última atualização manual</span><b>{lastCheck||"Nenhuma nesta sessão"}</b></div><div className="settings-row"><span>Encerrar sessão</span><button className="danger-button" onClick={logout}><LogOut size={15}/> Sair da central</button></div></section>}
        <footer>Prysm <span>·</span> System Control <span>·</span> Versão 0.2.0 <span className="footer-right">Central privada de monitoramento</span></footer>
      </div>
    </main>
    {modal&&<SystemModal system={modal==="new"?null:modal} onClose={()=>setModal(null)} onSave={saveSystem} onDelete={deleteSystem}/>}
    {toast&&<div className="toast"><Check size={16}/>{toast}<button onClick={()=>setToast("")}><X size={14}/></button></div>}
  </div>;
}

function Metric({label,value,note,icon:Icon}:{label:string;value:string;note:string;icon:typeof Activity}){
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={17}/></span></div><strong>{value}</strong><small>{note}</small></article>;
}
function SystemsTable({systems,uptimeByKey,onEdit}:{systems:System[];uptimeByKey:Map<string,{uptime_24h:number;last_check:string}>;onEdit:(s:System)=>void}){
  return <section className="systems-card"><div className="system-table"><div className="table-head"><span>SISTEMA</span><span>STATUS</span><span>LATÊNCIA</span><span>DISPONIBILIDADE (24H)</span><span>ENDPOINT</span><span/></div>{systems.map(system=>{const up=uptimeByKey.get(system.system_key);return <div className="system-row" key={system.id}><div className="system-name"><div className={`system-logo ${system.system_key==="menuza"?"orange":system.system_key==="madevix"?"violet":"blue"}`}>{system.name.slice(0,2).toUpperCase()}</div><div><b>{system.name}</b><span>{system.description||system.system_key}</span></div></div><div><Status status={!system.enabled?"warning":up?up.last_status:"pending"}/></div><span className="muted-value">{fmtMs(up?.avg_latency_ms)}</span><span className="uptime-placeholder">{up?`${Number(up.uptime_24h).toFixed(2)}%`:"Sem dados"}</span><span className="endpoint">{system.base_url||"URL não configurada"}</span><button className="row-more" onClick={()=>onEdit(system)} aria-label={`Editar ${system.name}`}><Pencil size={16}/></button></div>;})}{systems.length===0&&<div className="empty-table">Nenhum sistema encontrado.</div>}</div><div className="table-footer"><span>Exibindo {systems.length} sistema(s)</span><span className="footer-note"><ShieldCheck size={14}/> Atualizado com dados do banco.</span></div></section>;
}
function EventList({events}:{events:Event[]}){
  if(!events.length)return <div className="empty-state"><div className="empty-icon"><Activity size={20}/></div><b>Nenhuma atividade registrada</b><span>Execute uma verificação para gerar os primeiros eventos.</span></div>;
  return <div className="compact-events">{events.slice(0,6).map(e=><div key={e.id}><Status status={e.status}/><div><b>{e.system_key}</b><span>{e.message||e.event_type} · {fmtTime(e.created_at)}</span></div><small>{fmtMs(e.duration_ms)}</small></div>)}</div>;
}
function EventTable({events}:{events:Event[]}){
  if(!events.length)return <div className="empty-table">Nenhum evento encontrado. Execute uma verificação para começar a coletar dados.</div>;
  return <div className="event-table"><div className="event-head"><span>DATA</span><span>SISTEMA</span><span>TIPO</span><span>STATUS</span><span>DURAÇÃO</span><span>DETALHE</span></div>{events.map(e=><div className="event-row" key={e.id}><span>{fmtTime(e.created_at)}</span><b>{e.system_key}</b><span>{e.event_type}</span><Status status={e.status}/><span>{fmtMs(e.duration_ms)}</span><span>{e.message||"—"}</span></div>)}</div>;
}

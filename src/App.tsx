import {
  Activity, AlertTriangle, ArrowUpRight, Bell, ChevronDown, CircleHelp,
  Clock3, Cpu, Database, Gauge,
  LayoutDashboard, LifeBuoy, MoreHorizontal, Plus, Search, Server,
  Settings2, ShieldCheck, Signal, Workflow, Zap,
} from "lucide-react";

const systems = [
  { name: "Menuza", type: "Plataforma de pedidos", url: "menuza-five.vercel.app", status: "operational", latency: "—", uptime: "—", initials: "MZ", color: "orange" },
  { name: "Madevix", type: "Gestão empresarial", url: "Aguardando cadastro", status: "pending", latency: "—", uptime: "—", initials: "MX", color: "violet" },
  { name: "Orvix", type: "Agendamentos", url: "Aguardando cadastro", status: "pending", latency: "—", uptime: "—", initials: "OX", color: "blue" },
];

function Metric({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: typeof Activity }) {
  return <article className="metric-card">
    <div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={17} /></span></div>
    <strong>{value}</strong>
    <small>{note}</small>
  </article>;
}

export default function App() {
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Signal size={20} /></div><div><b>PRYSM</b><span>SYSTEM CONTROL</span></div></div>
      <div className="workspace"><div className="workspace-avatar">A</div><div><b>Workspace pessoal</b><span>Ambiente privado</span></div><ChevronDown size={15} /></div>
      <div className="nav-label">MONITORAMENTO</div>
      <nav>
        <a className="nav-item active"><LayoutDashboard size={18} /> Visão geral <span className="nav-shortcut">⌘ 1</span></a>
        <a className="nav-item"><Server size={18} /> Sistemas <span className="nav-count">03</span></a>
        <a className="nav-item"><Activity size={18} /> Incidentes</a>
        <a className="nav-item"><Gauge size={18} /> Desempenho</a>
        <a className="nav-item"><Workflow size={18} /> Workers</a>
      </nav>
      <div className="nav-label second-label">GERENCIAMENTO</div>
      <nav>
        <a className="nav-item"><Bell size={18} /> Alertas</a>
        <a className="nav-item"><Database size={18} /> Integrações</a>
        <a className="nav-item"><Settings2 size={18} /> Configurações</a>
      </nav>
      <div className="sidebar-bottom">
        <div className="help-card"><div><LifeBuoy size={17} /><b>Central de ajuda</b></div><p>Documentação e suporte do Prysm.</p><a>Consultar documentação <ArrowUpRight size={13}/></a></div>
        <div className="profile"><div className="profile-avatar">AC</div><div><b>Administrador</b><span>Acesso proprietário</span></div><MoreHorizontal size={18}/></div>
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs">Workspace <span>/</span> <b>Visão geral</b></div><div className="top-actions"><div className="live-indicator"><i/> Central inicializada</div><button className="icon-button" aria-label="Ajuda"><CircleHelp size={18}/></button><button className="icon-button notification" aria-label="Notificações"><Bell size={18}/></button><div className="top-avatar">AC</div></div></header>
      <div className="page-content">
        <section className="welcome-row"><div><div className="eyebrow"><span/> CENTRAL DE OPERAÇÕES</div><h1>Visão geral</h1><p>Acompanhe a saúde, disponibilidade e desempenho dos seus sistemas.</p></div><button className="primary-button"><Plus size={17}/> Adicionar sistema</button></section>
        <section className="metrics-grid">
          <Metric label="Sistemas cadastrados" value="03" note="1 configurado · 2 pendentes" icon={Server}/>
          <Metric label="Disponibilidade média" value="—" note="Aguardando primeiras verificações" icon={Signal}/>
          <Metric label="Incidentes ativos" value="—" note="Nenhum dado coletado ainda" icon={AlertTriangle}/>
          <Metric label="Latência média" value="—" note="Aguardando telemetria" icon={Gauge}/>
        </section>
        <section className="section-heading"><div><h2>Seus sistemas</h2><p>Estado atual dos serviços monitorados.</p></div><button className="text-button">Ver todos <ArrowUpRight size={15}/></button></section>
        <section className="systems-card">
          <div className="table-toolbar"><div className="table-title"><b>Todos os sistemas</b><span>03 cadastrados</span></div><div className="table-tools"><button className="filter-button"><Search size={15}/> Buscar</button><button className="filter-button">Todos os status <ChevronDown size={14}/></button></div></div>
          <div className="system-table">
            <div className="table-head"><span>SISTEMA</span><span>STATUS</span><span>LATÊNCIA</span><span>DISPONIBILIDADE (24H)</span><span>ENDPOINT</span><span/></div>
            {systems.map((system) => <div className="system-row" key={system.name}>
              <div className="system-name"><div className={`system-logo ${system.color}`}>{system.initials}</div><div><b>{system.name}</b><span>{system.type}</span></div></div>
              <div>{system.status === "operational" ? <span className="status-pill neutral"><i/> Não verificado</span> : <span className="status-pill pending">Configuração pendente</span>}</div>
              <span className="muted-value">{system.latency}</span><span className="uptime-placeholder">Sem dados</span><span className="endpoint">{system.url}</span><button className="row-more" aria-label={`Opções de ${system.name}`}><MoreHorizontal size={18}/></button>
            </div>)}
          </div>
          <div className="table-footer"><span>Exibindo 3 sistemas</span><span className="footer-note"><ShieldCheck size={14}/> Dados reais aparecerão após configurar as integrações.</span></div>
        </section>
        <div className="bottom-grid">
          <section className="panel"><div className="panel-heading"><div><h3>Atividade recente</h3><p>Últimos eventos registrados na central.</p></div><Clock3 size={17}/></div><div className="empty-state"><div className="empty-icon"><Activity size={20}/></div><b>Nenhuma atividade registrada</b><span>Os eventos dos seus sistemas aparecerão aqui.</span></div></section>
          <section className="panel"><div className="panel-heading"><div><h3>Saúde da infraestrutura</h3><p>Visão consolidada dos componentes.</p></div><Cpu size={17}/></div><div className="infra-list"><div><span><Database size={16}/> Banco de dados</span><b className="waiting">Não conectado</b></div><div><span><Zap size={16}/> Coletor de métricas</span><b className="waiting">Não configurado</b></div><div><span><ShieldCheck size={16}/> Canal de ingestão</span><b className="waiting">Não configurado</b></div></div></section>
        </div>
        <footer>Prysm <span>·</span> System Control <span>·</span> Versão 0.1.0 <span className="footer-right">Central privada de monitoramento</span></footer>
      </div>
    </main>
  </div>;
}
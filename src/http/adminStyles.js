module.exports = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Inter:wght@400;500;600;700&display=swap');
:root{color-scheme:light;--bg:#F6F8FB;--surface:#E8EDF4;--surface-2:#D8E0EA;--accent:#4C919A;--accent-hover:#3B7E87;--accent-secondary:#656EB0;--metallic:#9FA7B5;--text:#18202B;--text-secondary:#526173;--border:#C5CFDB;--success-bg:#E6F3EF;--success-border:#A9C9BE;--error-bg:#F9E8E7;--error-border:#D7AAA6;--table-hover:rgba(76,145,154,.08)}
html[data-theme="dark"]{color-scheme:dark;--bg:#12161D;--surface:#1B2230;--surface-2:#253041;--accent:#78B8C0;--accent-hover:#96CDD4;--accent-secondary:#7B82C9;--metallic:#B9BEC8;--text:#F1F4F8;--text-secondary:#ABB6C7;--border:#364154;--success-bg:#193129;--success-border:#3C6A5C;--error-bg:#311D21;--error-border:#74454E;--table-hover:rgba(120,184,192,.08)}
body{font-family:'Inter',system-ui,sans-serif;background:radial-gradient(circle at top left,color-mix(in srgb,var(--surface-2) 70%, transparent),transparent 34%),linear-gradient(180deg,var(--bg),var(--bg));color:var(--text);margin:0;padding:1.5rem;line-height:1.5;min-height:100vh}
main{max-width:1380px;margin:0 auto}
.topbar{display:flex;justify-content:flex-end;align-items:flex-start;gap:1rem;margin-bottom:1rem}
.title-block p{margin:.35rem 0 0;color:var(--text-secondary);max-width:60ch}
h1,h2,h3{font-family:'Cormorant Garamond',Georgia,serif;letter-spacing:.01em;margin:0 0 .4rem;font-weight:600}
h1{font-size:clamp(2.8rem,5vw,4.3rem);line-height:.92}
h2{font-size:1.6rem}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem}
.card{background:linear-gradient(180deg,color-mix(in srgb,var(--surface) 94%, transparent),color-mix(in srgb,var(--surface) 86%, var(--surface-2)));border:1px solid var(--border);border-radius:12px;padding:1rem}
.stack{display:grid;gap:1rem}
.section-title{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem}
.theme-switcher{display:inline-flex;gap:.35rem;padding:.26rem;border:1px solid var(--border);border-radius:8px;background:color-mix(in srgb,var(--surface) 88%, transparent)}
.theme-switcher a{padding:.42rem .74rem;border-radius:6px;text-decoration:none;color:var(--text-secondary);font-size:.9rem}
.theme-switcher a[aria-current="page"]{background:var(--surface-2);color:var(--text)}
label{display:block;font-weight:600;font-size:.92rem;margin:.6rem 0 .35rem;color:var(--text)}
input,textarea,select,button{font:inherit}
input,textarea,select{width:100%;box-sizing:border-box;padding:.68rem .78rem;border:1px solid var(--border);border-radius:8px;background:color-mix(in srgb,var(--bg) 52%, var(--surface));color:var(--text);transition:border-color .16s ease,background .16s ease}
input:focus,textarea:focus,select:focus{outline:none;border-color:var(--accent);background:color-mix(in srgb,var(--surface) 92%, var(--bg))}
input::placeholder,textarea::placeholder{color:var(--text-secondary)}
textarea{min-height:140px;resize:vertical}
button{background:var(--accent);color:white;border:1px solid color-mix(in srgb,var(--accent) 76%, black 8%);border-radius:8px;padding:.6rem .85rem;cursor:pointer;transition:background .16s ease,border-color .16s ease}
button:hover{background:var(--accent-hover)}
button.secondary{background:color-mix(in srgb,var(--surface-2) 72%, transparent);color:var(--text);border-color:var(--border)}
button.warn{background:#A35157;border-color:#8B434B}
.meta{color:var(--text-secondary);font-size:.92rem}
.item-title{margin:0 0 .25rem}
.notice{padding:.8rem 1rem;border-radius:12px;margin-bottom:1rem;border:1px solid transparent}
.success{background:var(--success-bg);border-color:var(--success-border)}
.error{background:var(--error-bg);border-color:var(--error-border)}
code{background:color-mix(in srgb,var(--surface-2) 74%, transparent);padding:.1rem .3rem;border-radius:6px}
a{color:var(--accent)}
.pill{display:inline-flex;align-items:center;gap:.35rem;padding:.3rem .52rem;border-radius:7px;background:color-mix(in srgb,var(--surface-2) 65%, transparent);color:var(--text-secondary);border:1px solid var(--border);font-size:.8rem;text-decoration:none}
.badge{display:inline-flex;align-items:center;padding:.2rem .46rem;border-radius:6px;border:1px solid color-mix(in srgb,var(--border) 72%, transparent);background:color-mix(in srgb,var(--surface-2) 64%, transparent);color:var(--text-secondary);font-size:.74rem;line-height:1.2}
.badge.type{background:color-mix(in srgb,var(--accent) 20%, var(--surface-2));color:var(--text)}
.badge.domain{background:color-mix(in srgb,var(--accent-secondary) 18%, var(--surface-2));color:var(--text)}
.badge.sensitivity{background:color-mix(in srgb,var(--metallic) 18%, var(--surface-2));color:var(--text)}
.button-link{display:inline-flex;align-items:center;justify-content:center;gap:.35rem;padding:.6rem .85rem;border:1px solid color-mix(in srgb,var(--accent) 76%, black 8%);border-radius:8px;background:var(--accent);color:white;text-decoration:none;transition:background .16s ease,border-color .16s ease}
.button-link:hover{background:var(--accent-hover);color:white}
.button-link-secondary{background:color-mix(in srgb,var(--surface-2) 72%, transparent);color:var(--text);border-color:var(--border)}
.button-link-secondary:hover{background:color-mix(in srgb,var(--surface-2) 86%, transparent);color:var(--text)}
.toolbar{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center}
.subgrid{display:grid;grid-template-columns:2fr 1fr;gap:1rem}
.list-plain{margin:.65rem 0 0;padding-left:1.1rem;color:var(--text-secondary)}
.list-plain li{margin:.3rem 0}
.hero-card{padding:1.1rem 1.1rem .95rem}
.hero-card p{margin:.25rem 0 0;color:var(--text-secondary)}
.entry-shell{min-height:calc(100vh - 6rem);display:grid;place-items:center;text-align:center;gap:1rem;padding:2rem 1rem}
.entry-shell > *{margin:0}
.entry-brand{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;color:var(--text)}
.entry-logo{display:inline-flex;align-items:center;justify-content:center;width:4.75rem;height:4.75rem}
.entry-logo-image{display:block;width:100%;height:100%;object-fit:contain}
.entry-title{font-size:clamp(3rem,6vw,4.75rem);line-height:.92}
.entry-copy{max-width:38rem;color:var(--text-secondary);font-size:1.02rem}
.entry-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:.75rem}
.admin-shell{display:grid;grid-template-columns:240px minmax(0,1fr);gap:1rem;align-items:start;min-width:0}
.lite-shell{gap:0;background:transparent;align-items:stretch;min-height:calc(100vh - 3rem);min-width:0}
.admin-sidebar{background:linear-gradient(180deg,color-mix(in srgb,var(--surface) 95%, transparent),color-mix(in srgb,var(--surface) 84%, var(--surface-2)));border:1px solid var(--border);border-radius:12px;overflow:hidden;position:sticky;top:1rem}
.lite-shell .admin-sidebar{border:none;border-right:1px solid var(--border);border-radius:0;background:transparent;position:sticky;top:0;display:flex;flex-direction:column;align-self:start;min-height:calc(100vh - 3rem)}
.sidebar-head{padding:1rem .95rem;border-bottom:1px solid var(--border)}
.sidebar-brand{display:flex;align-items:center;gap:.7rem;text-decoration:none;color:var(--text)}
.sidebar-logo{width:1.8rem;height:1.8rem;display:inline-flex;align-items:center;justify-content:center;flex:none}
.sidebar-logo img{display:block;width:100%;height:100%;object-fit:contain}
.sidebar-head strong{display:block;font-family:'Cormorant Garamond',Georgia,serif;font-size:1.72rem;line-height:.95}
.sidebar-head span{display:block;color:var(--text-secondary);font-size:.85rem;margin-top:.2rem}
.sidebar-nav{padding:.55rem}
.lite-shell .sidebar-nav{flex:1 1 auto}
.sidebar-nav a{display:flex;align-items:center;gap:.7rem;padding:.72rem .78rem;border-radius:8px;color:var(--text-secondary);text-decoration:none;font-weight:500;border:1px solid transparent}
.sidebar-nav a:hover{background:color-mix(in srgb,var(--surface-2) 58%, transparent);color:var(--text)}
.sidebar-nav a[aria-current="page"]{background:color-mix(in srgb,var(--surface-2) 72%, transparent);border-color:var(--border);color:var(--text)}
.sidebar-mark{width:1.1rem;height:1.1rem;display:inline-flex;align-items:center;justify-content:center;flex:none}
.sidebar-mark img{display:block;width:100%;height:100%;object-fit:contain}
.admin-main{display:grid;gap:1rem;min-width:0}
.sidebar-footer{padding:.8rem .95rem;border-top:1px solid var(--border)}
.sidebar-footer .theme-switcher{width:100%;justify-content:space-between;box-sizing:border-box}
.sidebar-footer .theme-switcher a{flex:1 1 0;text-align:center}
.lite-main{display:grid;gap:0;min-width:0;min-height:calc(100vh - 3rem);max-height:calc(100vh - 3rem);overflow:auto;background:transparent}
.lite-main > * + *{border-top:1px solid var(--border)}
.page-hero{padding:.95rem 1.4rem .75rem}
.page-kicker{font-size:.82rem;letter-spacing:.16em;text-transform:uppercase;color:var(--text-secondary);margin-bottom:.28rem}
.panel-header{display:flex;justify-content:space-between;align-items:flex-end;gap:1rem;margin-bottom:.75rem}
.panel-header p{margin:0;color:var(--text-secondary)}
.settings-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem}
.settings-block{padding:.92rem;border:1px solid var(--border);border-radius:10px;background:color-mix(in srgb,var(--surface) 72%, var(--bg))}
.settings-block h3{font-size:1.25rem;margin-bottom:.3rem}
.settings-form .toolbar{margin-top:.85rem}
.form-divider{height:1px;background:var(--border);margin:1.4rem 0}
.copy-block{margin-bottom:1rem}
.identity-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}
.model-table-wrap{border:1px solid var(--border);border-radius:10px;overflow:auto;background:transparent}
.model-table{width:100%;border-collapse:collapse;min-width:860px}
.model-table thead th{padding:.76rem .82rem;text-align:left;font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;color:var(--text-secondary);font-weight:600;border-bottom:1px solid var(--border);background:color-mix(in srgb,var(--surface) 80%, transparent)}
.model-table tbody td{padding:.82rem;border-top:1px solid var(--border);vertical-align:top}
.model-table .notes{color:var(--text-secondary);font-size:.9rem;max-width:280px}
.lite-strip{padding:1rem 1.4rem;border-top:1px solid var(--border)}
.lite-panel{padding:1.1rem 1.4rem}
.lite-panel.flush{padding:0}
.lite-panel.flat{background:transparent;border:none;border-radius:0}
.lite-toolbar{display:flex;flex-wrap:wrap;gap:.65rem;align-items:center;padding:1rem 1.4rem;border-top:1px solid var(--border);border-bottom:1px solid var(--border);background:color-mix(in srgb,var(--surface) 92%, transparent)}
.lite-toolbar.stack{display:grid;gap:.75rem;align-items:stretch}
.lite-toolbar form{display:flex;flex-wrap:wrap;gap:.65rem;align-items:center;width:auto}
.lite-toolbar input,.lite-toolbar select{padding:.56rem .68rem;border-radius:6px;background:transparent}
.toolbar-button,button.toolbar-button{display:inline-flex;align-items:center;justify-content:center;min-width:5.5rem;min-height:2.2rem;padding:.48rem .68rem;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--text-secondary);text-decoration:none;box-sizing:border-box;transition:background .16s ease,border-color .16s ease,color .16s ease;box-shadow:none}
.toolbar-button:hover,button.toolbar-button:hover{background:color-mix(in srgb,var(--surface-2) 68%, transparent);border-color:var(--border);color:var(--text)}
.toolbar-button.secondary,button.toolbar-button.secondary{color:var(--text-secondary)}
.toolbar-button[aria-disabled="true"],.toolbar-button.is-disabled,button.toolbar-button:disabled{opacity:.7;cursor:default;background:transparent;color:var(--text-secondary)}
.toolbar-group{display:flex;flex-wrap:wrap;gap:.65rem;align-items:center}
.toolbar-field{flex:none}
.toolbar-field.search{flex:1 1 24rem;min-width:16rem;max-width:28rem}
.toolbar-field.search input{width:100%}
.toolbar-field.select{width:10rem}
.toolbar-field.select select{width:100%}
.lite-toolbar .grow{flex:1 1 220px}
.lite-toolbar .push{margin-left:auto}
.toolbar-row{display:flex;flex-wrap:wrap;gap:.65rem;align-items:center;justify-content:space-between}
.toolbar-row.primary{justify-content:flex-start}
.toolbar-row.filters{flex-wrap:nowrap;align-items:center}
.toolbar-row.filters .toolbar-group{flex-wrap:nowrap;flex:1 1 auto}
.toolbar-row.filters .toolbar-group label{white-space:nowrap}
.toolbar-row.pagination{justify-content:center;width:100%}
.toolbar-row.pagination .toolbar-group{display:grid;grid-template-columns:minmax(5.5rem,auto) auto minmax(5.5rem,auto);gap:.65rem;align-items:center;justify-content:center}
.memory-table-wrap{border:1px solid var(--border);border-radius:10px;overflow:auto;background:color-mix(in srgb,var(--surface) 90%, transparent)}
.lite-main .memory-table-wrap{border:none;border-radius:0;background:transparent}
.memory-table{width:100%;border-collapse:collapse;min-width:980px}
.memory-table thead th{position:sticky;top:0;background:color-mix(in srgb,var(--surface) 96%, var(--surface-2));z-index:1;text-align:left;padding:.76rem .82rem;font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;color:var(--text-secondary);font-weight:600;border-bottom:1px solid var(--border)}
.memory-table tbody td{padding:.76rem .82rem;border-top:1px solid var(--border);vertical-align:top}
.memory-table th.updated-col,.memory-table td.updated-col{width:8.5rem;white-space:nowrap}
.memory-table th.actions-col,.memory-table td.actions-col{width:6rem}
.memory-table tbody tr:hover{background:var(--table-hover)}
.memory-title{font-weight:600;color:var(--text);margin:0 0 .18rem;font-size:.96rem}
.memory-title-link{color:inherit;text-decoration:none}
.memory-title-link:hover{text-decoration:underline;text-underline-offset:.12em}
.memory-content{max-width:420px;color:var(--text-secondary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.memory-chip-row{display:flex;flex-wrap:wrap;gap:.4rem}
.row-actions{display:flex;gap:.35rem;justify-content:flex-end}
.row-actions form{margin:0}
.icon-button{display:inline-flex;align-items:center;justify-content:center;width:1.9rem;height:1.9rem;padding:0;border-radius:6px;background:transparent;color:var(--text-secondary);border:1px solid transparent;text-decoration:none}
.icon-button:hover{background:color-mix(in srgb,var(--surface-2) 68%, transparent);border-color:var(--border);color:var(--text)}
.icon-button img{display:block;width:1rem;height:1rem;object-fit:contain}
.split-panel{display:grid;grid-template-columns:1.1fr 1.4fr;gap:1rem}
.lite-main .split-panel{gap:0;padding:1rem 1.4rem}
.lite-main .split-panel > .card:first-child{border-right:1px solid var(--border);padding-right:1rem}
.lite-main .split-panel > .card:last-child{padding-left:1rem}
.lite-main .split-panel > .card{border:none;border-radius:0;background:transparent;padding-top:0;padding-bottom:0}
.empty-state{padding:1.4rem;color:var(--text-secondary)}
.proactive-shell{display:grid;gap:0;padding:1rem 1.4rem;min-width:0}
.proactive-shell.flat{padding:1rem 1.4rem 0;background:transparent;border:none;border-radius:0}
.proactive-shell .panel-header{padding:0 0 1rem}
.proactive-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0}
.proactive-list{display:grid;gap:.75rem}
.proactive-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.85rem;align-items:start;padding:.9rem 0;border-top:1px solid var(--border)}
.proactive-row:first-child{border-top:none;padding-top:0}
.proactive-meta{display:flex;flex-wrap:wrap;gap:.45rem;margin:.3rem 0 .4rem}
.proactive-row .toolbar{justify-content:flex-end}
.proactive-form textarea{min-height:110px}
.proactive-form .grid{align-items:start}
.proactive-grid > .settings-block{border:none;border-radius:0;background:transparent;padding:0}
.proactive-grid > .settings-block:first-child{padding:0 1rem 0 0;border-right:1px solid var(--border);min-width:0}
.proactive-grid > .settings-block:last-child{padding:0 0 0 1rem;min-width:0}
.proactive-grid .memory-table-wrap{border:none;border-radius:0;background:transparent}
.proactive-grid .memory-table{width:100%;min-width:0}
.proactive-grid .memory-table thead th{position:static}
.segmented-control{display:inline-flex;gap:.35rem;padding:.26rem;border:1px solid var(--border);border-radius:8px;background:color-mix(in srgb,var(--surface) 88%, transparent)}
.segmented-control input{position:absolute;opacity:0;pointer-events:none}
.segmented-control label{padding:.42rem .74rem;border-radius:6px;text-decoration:none;color:var(--text-secondary);font-size:.9rem;cursor:pointer}
.segmented-control input:checked + label{background:var(--surface-2);color:var(--text)}
.proactive-inline-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:1rem;align-items:end}
.proactive-bottom{display:grid;gap:1rem;margin-top:1rem}
.proactive-bottom-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:1rem;align-items:end}
.proactive-bottom-row.actions{align-items:center}
.proactive-bottom-row.actions .toolbar{justify-content:flex-end;margin-top:0}
.switch-field{display:flex;align-items:center;gap:.7rem;min-height:42px}
.switch-control{position:relative;display:inline-flex;width:48px;height:28px;flex:0 0 auto}
.switch-control input{position:absolute;inset:0;opacity:0;cursor:pointer}
.switch-control span{display:block;width:100%;height:100%;border:1px solid var(--border);border-radius:999px;background:color-mix(in srgb,var(--surface) 88%, transparent);transition:background .18s ease,border-color .18s ease}
.switch-control span::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:999px;background:var(--metallic);transition:transform .18s ease, background .18s ease}
.switch-control input:checked + span{background:color-mix(in srgb,var(--primary) 18%, var(--surface) 82%);border-color:color-mix(in srgb,var(--primary) 42%, var(--border) 58%)}
.switch-control input:checked + span::after{transform:translateX(20px);background:var(--primary)}
.switch-label{font-size:.95rem;color:var(--text);white-space:nowrap}
@media (max-width: 1080px){.admin-shell{grid-template-columns:1fr}.admin-sidebar{position:static}.lite-shell .admin-sidebar{min-height:auto}.lite-main{max-height:none;overflow:visible;min-height:0}.subgrid,.split-panel,.identity-grid{grid-template-columns:1fr}.memory-table{min-width:760px}.lite-shell{border-radius:14px}.lite-main .split-panel{padding:1rem}.lite-main .split-panel > .card:first-child{border-right:none;border-bottom:1px solid var(--border);padding-right:0;padding-bottom:1rem}.lite-main .split-panel > .card:last-child{padding-left:0;padding-top:1rem}}
@media (max-width: 1080px){.proactive-shell,.proactive-shell.flat{padding:1rem}.proactive-grid{grid-template-columns:1fr}.proactive-grid > .settings-block:first-child{padding:0 0 1rem;border-right:none;border-bottom:1px solid var(--border)}.proactive-grid > .settings-block:last-child{padding:1rem 0 0}.proactive-inline-row,.proactive-bottom-row,.proactive-row{grid-template-columns:1fr}.proactive-row .toolbar,.proactive-bottom-row.actions .toolbar{justify-content:flex-start}}
@media (max-width: 980px){.toolbar-row.filters{flex-wrap:wrap}.toolbar-row.filters .toolbar-group{flex-wrap:wrap}}
@media (max-width: 860px){body{padding:1rem}.toolbar{align-items:stretch}.memory-table{min-width:640px}.model-table{min-width:640px}.toolbar-field.search,.toolbar-field.select{width:100%;max-width:none}}
`;

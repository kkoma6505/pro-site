(function(){
const $ = id => document.getElementById(id);
const P = { A:1, a:0.5, b:0.5, R:1.5, k:2.2, px:1, py:1, M:10 };
const S = { N:8, w:0.6, c1:1.5, c2:1.5, maxIter:60, delay:160 };

const FUNC_CTRLS = [
  {key:'A', sym:'A', label:'기본 효용 규모', min:0.2, max:3, step:0.1},
  {key:'a', sym:'α', label:'X를 좋아하는 정도', min:0.1, max:1, step:0.05},
  {key:'b', sym:'β', label:'Y를 좋아하는 정도', min:0.1, max:1, step:0.05},
  {key:'R', sym:'R', label:'굴곡 세기 (봉우리 높이)', min:0, max:4, step:0.1, hint:'0이면 봉우리가 하나뿐인 교과서형 효용함수가 됩니다.'},
  {key:'k', sym:'k', label:'굴곡 빈도 (봉우리 개수)', min:0.5, max:4, step:0.1}
];
const BUDGET_CTRLS = [
  {key:'px', sym:'pₓ', label:'재화 X의 가격', min:0.5, max:4, step:0.1},
  {key:'py', sym:'p_y', label:'재화 Y의 가격', min:0.5, max:4, step:0.1},
  {key:'M', sym:'M', label:'소득', min:4, max:20, step:0.5}
];
const PSO_CTRLS = [
  {key:'N', sym:'N', label:'입자 수', min:2, max:40, step:1},
  {key:'w', sym:'w', label:'관성', min:0, max:1.2, step:0.05},
  {key:'c1', sym:'c₁', label:'개인 기억의 힘', min:0, max:3, step:0.1},
  {key:'c2', sym:'c₂', label:'무리 정보의 힘', min:0, max:3, step:0.1},
  {key:'maxIter', sym:'T', label:'최대 반복 횟수', min:10, max:200, step:5},
  {key:'delay', sym:'Δt', label:'한 단계 간격 (ms)', min:30, max:600, step:10}
];
const FUNC_PRESETS = [
  {name:'봉우리 많은 산맥', v:{A:1, a:0.5, b:0.5, R:1.5, k:2.2, px:1, py:1, M:10}},
  {name:'교과서형 (R=0)', v:{A:1, a:0.4, b:0.6, R:0, k:2.2, px:1, py:1, M:10}},
  {name:'깊은 함정', v:{A:0.6, a:0.3, b:0.7, R:3, k:1.4, px:1.5, py:1, M:12}},
  {name:'촘촘한 굴곡', v:{A:1.2, a:0.5, b:0.5, R:1.2, k:3.6, px:1, py:1.2, M:12}}
];
const PSO_PRESETS = [
  {name:'균형', v:{w:0.6, c1:1.5, c2:1.5}},
  {name:'무리 따라가기', v:{w:0.3, c1:0.3, c2:2.6}},
  {name:'각자 탐색', v:{w:0.7, c1:2.6, c2:0.3}},
  {name:'관성 과다', v:{w:1.1, c1:1.0, c2:1.0}}
];

/* ---------- 모형 ---------- */
function U(x,y){ x=Math.max(x,0); y=Math.max(y,0);
  return P.A*Math.pow(x,P.a)*Math.pow(y,P.b) + P.R*Math.sin(P.k*x)*Math.sin(P.k*y); }
const xMax = () => P.M/P.px;
const yOf = x => (P.M - P.px*x)/P.py;
const f = x => U(x, yOf(x));

let truth = {x:0,y:0,u:0,peaks:0,range:1};
function analyzeLine(){
  const n=3000, xm=xMax(), v=[];
  let best=-Infinity, bx=0, lo=Infinity;
  for(let i=0;i<=n;i++){ const x=xm*i/n, u=f(x); v.push(u); if(u>best){best=u;bx=x;} if(u<lo)lo=u; }
  let peaks=0;
  for(let i=0;i<=n;i++){
    const l = i>0 ? v[i-1] : -Infinity, r = i<n ? v[i+1] : -Infinity;
    if(v[i]>l && v[i]>=r) peaks++;
  }
  truth = {x:bx, y:yOf(bx), u:best, peaks, range:Math.max(best-lo,1e-9)};
}

/* ---------- PSO ---------- */
function newSwarm(n){
  const xm=xMax();
  const sw = Array.from({length:n}, () => {
    const x=Math.random()*xm, u=f(x);
    return {x, v:(Math.random()-0.5)*xm*0.1, bx:x, bu:u, prev:x};
  });
  const g={x:sw[0].bx, u:sw[0].bu};
  sw.forEach(p=>{ if(p.bu>g.u){g.x=p.bx; g.u=p.bu;} });
  return {sw, g};
}
function step(sw, g){
  const xm=xMax(), vmax=0.2*xm;
  for(const p of sw){
    p.prev=p.x;
    const r1=Math.random(), r2=Math.random();
    p.v = S.w*p.v + S.c1*r1*(p.bx-p.x) + S.c2*r2*(g.x-p.x);
    p.v = Math.max(-vmax, Math.min(vmax, p.v));
    p.x += p.v;
    if(p.x<0){p.x=0; p.v*=-0.5;}
    if(p.x>xm){p.x=xm; p.v*=-0.5;}
    const u=f(p.x);
    if(u>p.bu){p.bu=u; p.bx=p.x;}
    if(u>g.u){g.u=u; g.x=p.x;}
  }
}
const tol = () => 0.015*xMax();
const found = g => Math.abs(g.x-truth.x) < tol();

let swarm=[], gbest={x:0,u:0}, iter=0, hist=[], running=false, timer=null, firstHit=null;
function resetSwarm(){
  stop();
  const s=newSwarm(S.N); swarm=s.sw; gbest=s.g; iter=0; hist=[gbest.u];
  firstHit = found(gbest) ? 0 : null;
  setStatus('입자를 예산선 위에 무작위로 뿌렸습니다. 탐색 시작을 눌러 보세요.');
  renderDynamic();
}

/* ---------- 색상 ---------- */
const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function colors(){ return {ink:tok('--ink'), muted:tok('--muted'), line:tok('--line'), grid:tok('--grid'),
  teal:tok('--teal'), low:tok('--low'), high:tok('--high'), amber:tok('--amber'), amberInk:tok('--amber-ink'),
  indigo:tok('--indigo'), crimson:tok('--crimson'), panel:tok('--panel')}; }

/* ---------- 3D ---------- */
let surf=null;
function buildSurface(){
  const L=Math.max(P.M/P.px, P.M/P.py)*1.05, n=66, xs=[], ys=[], z=[];
  for(let i=0;i<n;i++){ xs.push(L*i/(n-1)); ys.push(L*i/(n-1)); }
  let zmin=Infinity, zmax=-Infinity;
  for(let j=0;j<n;j++){ const row=[]; for(let i=0;i<n;i++){ const u=U(xs[i],ys[j]); row.push(u); if(u<zmin)zmin=u; if(u>zmax)zmax=u; } z.push(row); }
  const cx=[], cy=[], cz=[], xm=xMax();
  for(let i=0;i<=300;i++){ const x=xm*i/300; cx.push(x); cy.push(yOf(x)); cz.push(f(x)); }
  surf={xs,ys,z,zmin,zmax,cx,cy,cz,lift:(zmax-zmin)*0.015};
}
function traces3D(){
  const c=colors(), s=surf, xm=xMax(), ym=P.M/P.py, show=$('chkTruth').checked;
  return [
    {type:'surface', x:s.xs, y:s.ys, z:s.z, colorscale:[[0,c.low],[0.55,c.teal],[1,c.high]],
      showscale:false, opacity:0.93, hovertemplate:'x=%{x:.2f}<br>y=%{y:.2f}<br>효용=%{z:.2f}<extra></extra>',
      contours:{z:{show:true, usecolormap:true, width:1, project:{z:false}}}, lighting:{ambient:0.75, diffuse:0.6, specular:0.08}},
    {type:'surface', x:[[0,xm],[0,xm]], y:[[ym,0],[ym,0]], z:[[s.zmin,s.zmin],[s.zmax,s.zmax]],
      surfacecolor:[[0,0],[0,0]], colorscale:[[0,c.amber],[1,c.amber]], showscale:false, opacity:0.28, hoverinfo:'skip'},
    {type:'scatter3d', mode:'lines', x:s.cx, y:s.cy, z:s.cz.map(v=>v+s.lift), line:{color:c.amber, width:7}, hoverinfo:'skip'},
    {type:'scatter3d', mode:'markers', x:[], y:[], z:[], marker:{size:5, color:c.indigo, line:{color:c.panel, width:1}},
      hovertemplate:'입자<br>x=%{x:.2f}, y=%{y:.2f}<br>효용=%{z:.3f}<extra></extra>'},
    {type:'scatter3d', mode:'markers', x:[], y:[], z:[], marker:{size:9, color:c.crimson, symbol:'diamond', line:{color:c.panel, width:1}},
      hovertemplate:'무리의 최고점<br>x=%{x:.2f}, y=%{y:.2f}<br>효용=%{z:.3f}<extra></extra>'},
    {type:'scatter3d', mode:'markers', x:[truth.x], y:[truth.y], z:[truth.u+s.lift*2], visible:show,
      marker:{size:11, color:'rgba(0,0,0,0)', symbol:'circle-open', line:{color:c.ink, width:3}},
      hovertemplate:'실제 최적점<br>x=%{x:.2f}, y=%{y:.2f}<br>효용=%{z:.3f}<extra></extra>'}
  ];
}
function layout3D(){
  const c=colors();
  const ax = t => ({title:{text:t, font:{size:12}}, color:c.muted, gridcolor:c.grid, zerolinecolor:c.line, backgroundcolor:'rgba(0,0,0,0)', showbackground:false});
  return {paper_bgcolor:'rgba(0,0,0,0)', margin:{l:0,r:0,t:0,b:0}, uirevision:'keep', showlegend:false,
    font:{family:'IBM Plex Sans KR, sans-serif', color:c.ink},
    scene:{xaxis:ax('x  재화 X'), yaxis:ax('y  재화 Y'), zaxis:ax('효용 U'),
      camera:{eye:{x:1.55,y:-1.55,z:0.95}}, aspectmode:'manual', aspectratio:{x:1,y:1,z:0.7}}};
}
function render3D(){ Plotly.react('plot3d', traces3D(), layout3D(), {responsive:true, displaylogo:false}); }

/* ---------- 2D ---------- */
function layout2D(xt, yt, shapes){
  const c=colors();
  return {paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)', margin:{l:48,r:12,t:8,b:44},
    font:{family:'IBM Plex Sans KR, sans-serif', color:c.ink, size:12}, showlegend:false, uirevision:'keep2',
    xaxis:{title:{text:xt}, gridcolor:c.grid, zerolinecolor:c.line, color:c.muted},
    yaxis:{title:{text:yt}, gridcolor:c.grid, zerolinecolor:c.line, color:c.muted}, shapes};
}
function renderProfile(){
  const c=colors(), s=surf, show=$('chkTruth').checked;
  const segX=[], segY=[];
  swarm.forEach(p=>{ segX.push(p.prev,p.x,null); segY.push(f(p.prev),f(p.x),null); });
  const tr=[
    {x:s.cx, y:s.cz, mode:'lines', line:{color:c.amber, width:2.5}, hovertemplate:'x=%{x:.2f}<br>효용=%{y:.3f}<extra></extra>'},
    {x:segX, y:segY, mode:'lines', line:{color:c.indigo, width:1.2, dash:'dot'}, hoverinfo:'skip'},
    {x:swarm.map(p=>p.bx), y:swarm.map(p=>p.bu), mode:'markers', marker:{size:8, color:'rgba(0,0,0,0)', line:{color:c.indigo, width:1.2}}, hovertemplate:'개인 최고점<br>x=%{x:.2f}<extra></extra>'},
    {x:swarm.map(p=>p.x), y:swarm.map(p=>f(p.x)), mode:'markers', marker:{size:8, color:c.indigo}, hovertemplate:'입자<br>x=%{x:.2f}<br>효용=%{y:.3f}<extra></extra>'},
    {x:[gbest.x], y:[gbest.u], mode:'markers', marker:{size:15, color:c.crimson, symbol:'star'}, hovertemplate:'무리의 최고점<br>x=%{x:.2f}<br>효용=%{y:.3f}<extra></extra>'}
  ];
  const shapes = show ? [{type:'line', x0:truth.x, x1:truth.x, yref:'paper', y0:0, y1:1, line:{color:c.ink, width:1.5, dash:'dash'}}] : [];
  Plotly.react('profile', tr, layout2D('x  재화 X 구매량 (y = (M − pₓx) / p_y)', '효용', shapes), {responsive:true, displaylogo:false, displayModeBar:false});
}
function renderConv(){
  const c=colors(), show=$('chkTruth').checked;
  const tr=[{x:hist.map((_,i)=>i), y:hist, mode:'lines+markers', line:{color:c.crimson, width:2, shape:'hv'}, marker:{size:4}, hovertemplate:'%{x}번째 반복<br>최고 효용=%{y:.3f}<extra></extra>'}];
  const shapes = show ? [{type:'line', xref:'paper', x0:0, x1:1, y0:truth.u, y1:truth.u, line:{color:c.ink, width:1.5, dash:'dash'}}] : [];
  const L=layout2D('반복 횟수', '찾은 최고 효용', shapes);
  L.xaxis.range=[0, Math.max(S.maxIter, iter)];
  Plotly.react('conv', tr, L, {responsive:true, displaylogo:false, displayModeBar:false});
}
function renderDynamic(){
  if(!window.Plotly || !surf) return;
  const lift=surf.lift;
  Plotly.restyle('plot3d', {
    x:[swarm.map(p=>p.x), [gbest.x]],
    y:[swarm.map(p=>yOf(p.x)), [yOf(gbest.x)]],
    z:[swarm.map(p=>f(p.x)+lift*1.5), [gbest.u+lift*2.5]]
  }, [3,4]);
  renderProfile(); renderConv(); renderReadout();
}
function renderAll(){ if(!window.Plotly) return; render3D(); renderDynamic(); }

/* ---------- 텍스트 ---------- */
const n2 = v => (Math.round(v*100)/100).toFixed(2);
function renderFormula(){
  const t=P.R>0 ? ` + ${n2(P.R)}·sin(${n2(P.k)}x)·sin(${n2(P.k)}y)` : '';
  $('formula').innerHTML = `U(x, y) = ${n2(P.A)}·x<sup>${n2(P.a)}</sup>·y<sup>${n2(P.b)}</sup>${t}<br>${n2(P.px)}x + ${n2(P.py)}y = ${n2(P.M)}<small>효용함수와 예산선 (값을 바꾸면 즉시 반영됩니다)</small>`;
}
function renderReadout(){
  const show=$('chkTruth').checked;
  let rows = `<dt>반복</dt><dd>${iter} / ${S.maxIter}</dd>
    <dt>무리의 최고점</dt><dd>x = ${n2(gbest.x)}, y = ${n2(yOf(gbest.x))}, U = ${gbest.u.toFixed(3)}</dd>
    <dt>능선 위 봉우리</dt><dd>${truth.peaks}개</dd>`;
  if(show){
    rows += `<dt>실제 최적점</dt><dd>x = ${n2(truth.x)}, y = ${n2(truth.y)}, U = ${truth.u.toFixed(3)}</dd>
      <dt>효용 차이</dt><dd>${(truth.u-gbest.u).toFixed(4)}</dd>`;
    if(P.R===0){
      const xs=P.a*P.M/((P.a+P.b)*P.px);
      rows += `<dt>이론해</dt><dd>x* = αM / ((α+β)pₓ) = ${n2(xs)}</dd>`;
    }
  }
  $('readout').innerHTML=rows;
}
function setStatus(msg, warn){ const el=$('status'); el.textContent=msg; el.classList.toggle('warn', !!warn); }

/* ---------- 실행 ---------- */
function tick(){
  if(iter>=S.maxIter){ finish(); return false; }
  step(swarm, gbest); iter++; hist.push(gbest.u);
  if(firstHit===null && found(gbest)) firstHit=iter;
  renderDynamic();
  if(iter>=S.maxIter){ finish(); return false; }
  return true;
}
function loop(){ if(!running) return; if(tick()) timer=setTimeout(loop, S.delay); }
function start(){ if(iter>=S.maxIter) resetSwarm(); running=true; $('btnRun').textContent='일시정지'; setStatus('입자들이 서로 정보를 주고받으며 능선을 따라 이동하고 있습니다.'); loop(); }
function stop(){ running=false; clearTimeout(timer); $('btnRun').textContent = iter>=S.maxIter ? '처음부터 다시' : (iter>0 ? '이어서 탐색' : '탐색 시작'); }
function finish(){
  stop(); $('chkTruth').checked=true; render3D(); renderDynamic();
  if(found(gbest)) setStatus(`성공: ${firstHit}번째 반복에서 실제 최적점 근처에 도달했습니다. 가격이나 굴곡을 바꿔 다시 해 보세요.`);
  else setStatus('국소 최적점에 머물렀습니다. 무리가 한 봉우리에 너무 빨리 몰렸기 때문입니다. 입자 수, 관성, 개인 기억의 힘을 늘려 보세요.', true);
}
function batch(){
  stop();
  const runs=30; let ok=0, sumHit=0;
  for(let r=0;r<runs;r++){
    const s=newSwarm(S.N); let hit=found(s.g)?0:null;
    for(let t=1;t<=S.maxIter;t++){ step(s.sw, s.g); if(hit===null && found(s.g)) hit=t; }
    if(found(s.g)){ ok++; sumHit+=hit; }
  }
  const rate=Math.round(ok/runs*100);
  const avg = ok ? ` 성공한 실험은 평균 ${(sumHit/ok).toFixed(1)}번째 반복에서 최적점에 도달했습니다.` : '';
  setStatus(`30번 중 ${ok}번 실제 최적점을 찾았습니다 (성공률 ${rate}%).${avg}`, rate<60);
}

/* ---------- 컨트롤 생성 ---------- */
function buildCtrls(host, defs, obj, onChange){
  $(host).innerHTML = defs.map(d=>`<div class="ctrl"><div class="top"><label for="c_${d.key}"><span class="sym">${d.sym}</span>${d.label}</label><output id="o_${d.key}"></output></div>
    <input type="range" id="c_${d.key}" min="${d.min}" max="${d.max}" step="${d.step}" value="${obj[d.key]}">${d.hint?`<div class="hint">${d.hint}</div>`:''}</div>`).join('');
  defs.forEach(d=>{
    const el=$('c_'+d.key), out=$('o_'+d.key);
    const fmt = () => out.textContent = Number.isInteger(d.step) ? obj[d.key] : Number(obj[d.key]).toFixed(d.step<0.1?2:1);
    fmt();
    el.addEventListener('input', ()=>{ obj[d.key]=parseFloat(el.value); fmt(); onChange(d.key); });
  });
}
function syncCtrls(defs, obj){ defs.forEach(d=>{ $('c_'+d.key).value=obj[d.key]; $('c_'+d.key).dispatchEvent(new Event('input')); }); }

let rebuildPending=false;
function onModelChange(){
  if(rebuildPending) return; rebuildPending=true;
  requestAnimationFrame(()=>{ rebuildPending=false;
    renderFormula(); analyzeLine(); buildSurface();
    $('chkTruth').checked=false;
    const s=newSwarm(S.N); stop(); swarm=s.sw; gbest=s.g; iter=0; hist=[gbest.u]; firstHit=found(gbest)?0:null; stop();
    setStatus('효용함수나 예산이 바뀌어 지형이 새로 만들어졌습니다. 입자도 새로 뿌렸습니다.');
    renderAll();
  });
}
function onPsoChange(key){
  if(key==='N') resetSwarm();
  else if(key==='maxIter') renderDynamic();
}

function presetRow(host, list, obj, defs){
  $(host).innerHTML = list.map((p,i)=>`<button data-i="${i}">${p.name}</button>`).join('');
  $(host).querySelectorAll('button').forEach(b=>b.addEventListener('click', ()=>{
    Object.assign(obj, list[+b.dataset.i].v); syncCtrls(defs, obj);
  }));
}

function init(){
  buildCtrls('funcCtrls', FUNC_CTRLS, P, onModelChange);
  buildCtrls('budgetCtrls', BUDGET_CTRLS, P, onModelChange);
  buildCtrls('psoCtrls', PSO_CTRLS, S, onPsoChange);
  presetRow('funcPresets', FUNC_PRESETS, P, FUNC_CTRLS.concat(BUDGET_CTRLS));
  presetRow('psoPresets', PSO_PRESETS, S, PSO_CTRLS.filter(d=>['w','c1','c2'].includes(d.key)));
  $('btnRun').addEventListener('click', ()=> running ? (stop(), setStatus('일시정지했습니다. 한 단계씩 진행하며 입자의 움직임을 관찰해 보세요.')) : start());
  $('btnStep').addEventListener('click', ()=>{ stop(); if(iter>=S.maxIter) resetSwarm(); else tick(); });
  $('btnReset').addEventListener('click', resetSwarm);
  $('btnBatch').addEventListener('click', batch);
  $('chkTruth').addEventListener('change', ()=>{ Plotly.restyle('plot3d', {visible:[$('chkTruth').checked]}, [5]); renderDynamic(); });
  try{ window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderAll); }catch(e){}

  renderFormula(); analyzeLine(); buildSurface();
  const s=newSwarm(S.N); swarm=s.sw; gbest=s.g; hist=[gbest.u]; firstHit=found(gbest)?0:null;
  if(!window.Plotly){ $('plot3d').innerHTML='<div class="loading">그래프 라이브러리를 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 새로고침해 주세요.</div>'; return; }
  $('plot3d').innerHTML='';
  renderAll();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

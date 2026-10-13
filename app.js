(function(){
const $ = id => document.getElementById(id);
const P = { a:0.5, b:0.5, R:2, p:2, q:2, px:1, py:1, M:10 };
const S = { N:8, w:0.6, c1:1.5, c2:1.5 };
const PSO_CTRLS = [
  {key:'N', sym:'N', label:'입자 수', min:2, max:40, step:1},
  {key:'w', sym:'w', label:'관성', min:0, max:1.2, step:0.05},
  {key:'c1', sym:'c₁', label:'개인 기억의 힘', min:0, max:3, step:0.1},
  {key:'c2', sym:'c₂', label:'무리 정보의 힘', min:0, max:3, step:0.1}
];
const PSO_PRESETS = [
  {name:'균형', v:{w:0.6, c1:1.5, c2:1.5}},
  {name:'무리 따라가기', v:{w:0.3, c1:0.3, c2:2.6}},
  {name:'각자 탐색', v:{w:0.7, c1:2.6, c2:0.3}},
  {name:'관성 과다', v:{w:1.1, c1:1.0, c2:1.0}}
];

/* ---------- 굴곡 있는 효용의 예산선 위 극대화 ---------- */
function utility(x,y){ return Math.pow(Math.max(0,x),P.a)*Math.pow(Math.max(0,y),P.b)
  + P.R*Math.sin(P.p*x)*Math.sin(P.q*y); }
const xMax=()=>P.M/P.px, yMax=()=>P.M/P.py;
const yOf=x=>(P.M-P.px*x)/P.py;
const f=x=>utility(x,yOf(x));
const truth={x:0,y:yOf(0),u:f(0),min:Infinity};
for(let i=0;i<=20000;i++){const x=xMax()*i/20000,u=f(x);truth.min=Math.min(truth.min,u);if(u>truth.u){truth.x=x;truth.y=yOf(x);truth.u=u;}}
const profileRange=[Math.min(0,truth.min)-0.25,truth.u*1.15];

/* ---------- PSO ---------- */
function newSwarm(n){
  const xm=xMax();
  const sw=Array.from({length:n},()=>{const x=Math.random()*xm,u=f(x);return {x,v:(Math.random()-0.5)*xm*0.1,bx:x,bu:u,prevX:x};});
  const best=sw.reduce((a,p)=>p.bu>a.bu?p:a,sw[0]);
  return {sw,g:{x:best.bx,u:best.bu}};
}
function step(sw,g){
  const before={x:g.x,u:g.u};
  const vmax=0.2*xMax();
  for(const p of sw){
    p.prevX=p.x;
    const r1=Math.random(),r2=Math.random();
    p.v=S.w*p.v+S.c1*r1*(p.bx-p.x)+S.c2*r2*(g.x-p.x);
    p.v=Math.max(-vmax,Math.min(vmax,p.v));p.x=Math.max(0,Math.min(xMax(),p.x+p.v));
    const u=f(p.x);if(u>p.bu){p.bu=u;p.bx=p.x;}
  }
  const best=sw.reduce((a,p)=>p.bu>a.bu?p:a,sw[0]);g.x=best.bx;g.u=best.bu;
  return before;
}

let swarm=[],gbest={x:0,u:0},iter=0,hist=[],stepLog=[],animating=false;
function resetSwarm(){
  if(animating)return;
  const s=newSwarm(S.N); swarm=s.sw; gbest=s.g; iter=0; hist=[gbest.u]; stepLog=[];
  renderIterationLog();
  setStatus('입자를 예산선 위에 무작위로 뿌렸습니다. 한 단계씩 진행해 보세요.');
  renderDynamic();
}

/* ---------- 색상 ---------- */
const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function colors(){ return {ink:tok('--ink'), muted:tok('--muted'), line:tok('--line'), grid:tok('--grid'),
  teal:tok('--teal'), low:tok('--low'), high:tok('--high'), amber:tok('--amber'), amberInk:tok('--amber-ink'),
  indigo:tok('--indigo'), crimson:tok('--crimson'), panel:tok('--panel')}; }

/* ---------- 2D ---------- */
function layout2D(xt, yt, shapes){
  const c=colors();
  return {paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)', margin:{l:48,r:12,t:8,b:44},
    font:{family:'IBM Plex Sans KR, sans-serif', color:c.ink, size:12}, showlegend:false, uirevision:'keep2',
    xaxis:{title:{text:xt}, gridcolor:c.grid, zerolinecolor:c.line, color:c.muted},
    yaxis:{title:{text:yt}, gridcolor:c.grid, zerolinecolor:c.line, color:c.muted}, shapes};
}
function movingSegments(startXs,viewXs,yFn){
  const x=[],y=[];swarm.forEach((p,i)=>{x.push(startXs[i],viewXs[i],null);y.push(yFn(startXs[i]),yFn(viewXs[i]),null);});return {x,y};
}
/* 예산 경계에서 삼각형을 잘라 양쪽 지형에 서로 다른 투명도를 적용한다. */
let terrain=null;
function buildTerrain(){
  const meshes=[0,1].map(()=>({x:[],y:[],z:[],i:[],j:[],k:[],vertices:new Map()}));
  const cost=p=>P.px*p.x+P.py*p.y-P.M;
  function clip(poly,over){
    const out=[];
    poly.forEach((a,i)=>{const b=poly[(i+1)%poly.length],da=cost(a),db=cost(b),inside=over?da>=0:da<=0,next=over?db>=0:db<=0;
      if(inside)out.push(a);
      if(inside!==next){const t=da/(da-db);out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}
    });return out;
  }
  function add(mesh,poly){
    const ids=poly.map(p=>{const key=p.x.toFixed(8)+','+p.y.toFixed(8);if(mesh.vertices.has(key))return mesh.vertices.get(key);
      const id=mesh.x.length;mesh.vertices.set(key,id);mesh.x.push(p.x);mesh.y.push(p.y);mesh.z.push(utility(p.x,p.y));return id;});
    for(let t=1;t+1<ids.length;t++){if(new Set([ids[0],ids[t],ids[t+1]]).size<3)continue;mesh.i.push(ids[0]);mesh.j.push(ids[t]);mesh.k.push(ids[t+1]);}
  }
  const n=100,Lx=xMax()*1.05,Ly=yMax()*1.05;
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const a={x:Lx*i/n,y:Ly*j/n},b={x:Lx*(i+1)/n,y:a.y},c={x:b.x,y:Ly*(j+1)/n},d={x:a.x,y:c.y};
    for(const tri of [[a,b,c],[a,c,d]]){add(meshes[0],clip(tri,true));add(meshes[1],clip(tri,false));}
  }
  meshes.forEach(m=>delete m.vertices);
  const z=meshes.flatMap(m=>m.z);terrain={meshes,min:Math.min(...z),max:Math.max(...z)};
}
function path3D(startXs,viewXs){
  const x=[],y=[],z=[];startXs.forEach((start,i)=>{for(let s=0;s<=16;s++){const v=start+(viewXs[i]-start)*s/16;x.push(v);y.push(yOf(v));z.push(f(v));}x.push(null);y.push(null);z.push(null);});return {x,y,z};
}
function stems3D(xs){const x=[],y=[],z=[];xs.forEach(v=>{x.push(v,v,null);y.push(yOf(v),yOf(v),null);z.push(0,f(v),null);});return {x,y,z};}
function renderBudget(viewXs=swarm.map(p=>p.x),bestX=gbest.x,pbestXs=swarm.map(p=>p.bx)){
  if(!terrain)buildTerrain();
  const c=colors(),path=path3D(swarm.map(p=>p.prevX),viewXs),stems=stems3D(viewXs);
  const ridge=Array.from({length:601},(_,i)=>xMax()*i/600);
  const surfaces=terrain.meshes.map((mesh,i)=>({...mesh,type:'mesh3d',intensity:mesh.z,intensitymode:'vertex',
    colorscale:[[0,c.low],[0.5,c.teal],[1,c.high]],cmin:terrain.min,cmax:terrain.max,showscale:false,
    opacity:i===0?1:0.24,lighting:{ambient:0.75,diffuse:0.65,specular:0.08},
    hovertemplate:'x=%{x:.2f}, y=%{y:.2f}<br>U=%{z:.3f}<extra></extra>'}));
  const traces=[...surfaces,
    {type:'surface',x:[[0,xMax()],[0,xMax()]],y:[[yMax(),0],[yMax(),0]],z:[[Math.min(0,terrain.min),Math.min(0,terrain.min)],[terrain.max,terrain.max]],
      colorscale:[[0,c.amber],[1,c.amber]],showscale:false,opacity:0.12,hoverinfo:'skip'},
    {type:'scatter3d',mode:'lines',x:ridge,y:ridge.map(yOf),z:ridge.map(f),line:{color:c.amber,width:6},hoverinfo:'skip'},
    {type:'scatter3d',mode:'lines',...path,line:{color:c.indigo,width:4},opacity:0.45,hoverinfo:'skip'},
    {type:'scatter3d',mode:'lines',...stems,line:{color:c.indigo,width:3},opacity:0.28,hoverinfo:'skip'},
    {type:'scatter3d',mode:'markers',x:pbestXs,y:pbestXs.map(yOf),z:pbestXs.map(f),marker:{size:4,color:c.teal},hovertemplate:'pbest<br>U=%{z:.3f}<extra></extra>'},
    {type:'scatter3d',mode:'markers',x:viewXs,y:viewXs.map(yOf),z:viewXs.map(f),marker:{size:6,color:c.indigo,line:{color:c.panel,width:1}},hovertemplate:'입자<br>x=%{x:.2f}, y=%{y:.2f}<br>U=%{z:.3f}<extra></extra>'},
    {type:'scatter3d',mode:'markers',x:[bestX],y:[yOf(bestX)],z:[f(bestX)],marker:{size:9,color:c.crimson,symbol:'diamond'},hovertemplate:'gbest<br>U=%{z:.3f}<extra></extra>'},
    {type:'scatter3d',mode:'markers',x:[truth.x],y:[truth.y],z:[truth.u],visible:$('chkTruth').checked,marker:{size:10,color:c.ink,symbol:'circle-open'},hovertemplate:'예산선 위 실제 최적점<br>U=%{z:.3f}<extra></extra>'}
  ];
  const ax=t=>({title:{text:t},color:c.muted,gridcolor:c.grid,zerolinecolor:c.line,showbackground:false});
  const L={paper_bgcolor:'rgba(0,0,0,0)',margin:{l:0,r:0,t:0,b:0},showlegend:false,uirevision:'budget-3d',
    font:{family:'IBM Plex Sans KR, sans-serif',color:c.ink},scene:{xaxis:ax('재화 X'),yaxis:ax('재화 Y'),zaxis:ax('효용 U'),
      camera:{eye:{x:1.55,y:-1.55,z:1}},aspectmode:'manual',aspectratio:{x:1,y:1,z:0.7}}};
  return Plotly.react('landscape',traces,L,{responsive:true,displaylogo:false});
}
function renderProfile(viewXs=swarm.map(p=>p.x),bestX=gbest.x,pbestXs=swarm.map(p=>p.bx)){
  const c=colors(),xs=Array.from({length:201},(_,i)=>xMax()*i/200),seg=movingSegments(swarm.map(p=>p.prevX),viewXs,f);
  const stemX=[],stemY=[];viewXs.forEach(x=>{stemX.push(x,x,null);stemY.push(0,f(x),null);});
  const utilityLine=xs.map(f);
  const traces=[
    {type:'scatter',mode:'lines',x:xs,y:utilityLine,line:{color:c.amber,width:3},hovertemplate:'x=%{x:.2f}<br>U=%{y:.3f}<extra></extra>'},
    {type:'scatter',mode:'lines',x:seg.x,y:seg.y,line:{color:c.indigo,width:2},opacity:0.3,hoverinfo:'skip'},
    {type:'scatter',mode:'lines',x:stemX,y:stemY,line:{color:c.indigo,width:2},opacity:0.22,hoverinfo:'skip'},
    {type:'scatter',mode:'markers',x:pbestXs,y:pbestXs.map(f),marker:{size:9,color:'rgba(0,0,0,0)',line:{color:c.teal,width:1.4}},hovertemplate:'pbest<br>x=%{x:.2f}<br>U=%{y:.3f}<extra></extra>'},
    {type:'scatter',mode:'markers',x:viewXs,y:viewXs.map(f),marker:{size:9,color:c.indigo,line:{color:c.panel,width:1}},hovertemplate:'입자<br>x=%{x:.2f}<br>U=%{y:.3f}<extra></extra>'},
    {type:'scatter',mode:'markers',x:[bestX],y:[f(bestX)],marker:{size:14,color:c.crimson,symbol:'star'},hovertemplate:'gbest<br>x=%{x:.3f}<br>U=%{y:.3f}<extra></extra>'},
    {type:'scatter',mode:'markers',x:[truth.x],y:[truth.u],visible:$('chkTruth').checked,marker:{size:12,color:'rgba(0,0,0,0)',symbol:'circle-open',line:{color:c.ink,width:2}},hovertemplate:'예산선 위 실제 최적점<extra></extra>'}
  ];
  const L=layout2D('재화 X 구매량 (x)','효용 U(x, y(x))');L.xaxis.range=[0,xMax()];L.yaxis.range=profileRange;
  return Plotly.react('profile',traces,L,{responsive:true,displaylogo:false,displayModeBar:false});
}
function renderConv(){
  const c=colors(),tr=[{x:hist.map((_,i)=>i),y:hist,mode:'lines+markers+text',line:{color:c.crimson,width:2,shape:'hv'},marker:{size:7},
    text:hist.map((u,i)=>i===hist.length-1?`gbest ${u.toFixed(3)}`:''),textposition:'top center',cliponaxis:false,
    customdata:hist.map((_,i)=>i===0?'초기 배치':`${i}단계`),
    hovertemplate:'%{customdata}<br>gbest 효용=%{y:.4f}<extra></extra>'}];
  const values=$('chkTruth').checked?[...hist,truth.u]:hist;
  const low=Math.min(...values),high=Math.max(...values),padding=Math.max(0.08,(high-low)*0.2);
  const L=layout2D('단계','gbest 효용');L.xaxis.range=[-0.3,Math.max(1,iter)+0.4];L.xaxis.dtick=Math.max(1,Math.ceil(iter/8));
  L.yaxis.range=[low-padding,high+padding];L.margin={l:48,r:38,t:24,b:36};
  if($('chkTruth').checked)L.shapes=[{type:'line',xref:'paper',x0:0,x1:1,y0:truth.u,y1:truth.u,line:{color:c.ink,width:1.5,dash:'dash'}}];
  Plotly.react('conv',tr,L,{responsive:true,displaylogo:false,displayModeBar:false});
}
function renderDynamic(){ if(!window.Plotly)return;renderBudget();renderProfile();renderConv();renderReadout(); }
function renderAll(){ renderDynamic(); }

function setAnimationControls(disabled){
  $('btnStep').disabled=disabled;$('btnReset').disabled=disabled;
  $('chkTruth').disabled=disabled;
  document.querySelectorAll('#psoCtrls input,#psoPresets button').forEach(el=>el.disabled=disabled);
}
function animateMovement(startXs,startPbests,startBestX){
  const endXs=swarm.map(p=>p.x),endPbests=swarm.map(p=>p.bx),endBestX=gbest.x;
  const duration=720;let lastDraw=0;
  return new Promise((resolve,reject)=>{
    const draw=async now=>{
      try{
      const t=Math.min(1,(now-startTime)/duration),ease=1-Math.pow(1-t,3);
      if(now-lastDraw>28||t===1){
        const xs=startXs.map((x,i)=>x+(endXs[i]-x)*ease);
        const pb=startPbests.map((x,i)=>x+(endPbests[i]-x)*ease);
        const bx=startBestX+(endBestX-startBestX)*ease;
        const seg=path3D(startXs,xs),stems=stems3D(xs),profileSeg=movingSegments(startXs,xs,f);
        const stemX=[],stemY=[];xs.forEach(x=>{stemX.push(x,x,null);stemY.push(0,f(x),null);});
        await Promise.all([
          Plotly.restyle('landscape',{x:[seg.x,stems.x,pb,xs,[bx]],y:[seg.y,stems.y,pb.map(yOf),xs.map(yOf),[yOf(bx)]],
            z:[seg.z,stems.z,pb.map(f),xs.map(f),[f(bx)]]},[4,5,6,7,8]),
          Plotly.restyle('profile',{x:[profileSeg.x,stemX,pb,xs,[bx]],y:[profileSeg.y,stemY,pb.map(f),xs.map(f),[f(bx)]]},[1,2,3,4,5])
        ]);
        lastDraw=now;
      }
      if(t<1)requestAnimationFrame(draw);else resolve();
      }catch(error){reject(error);}
    };
    const startTime=performance.now();requestAnimationFrame(draw);
  });
}

/* ---------- 텍스트 ---------- */
const n2 = v => (Math.round(v*100)/100).toFixed(2);
function renderFormula(){
  $('formula').innerHTML = `U(x, y) = x<sup>a</sup> · y<sup>b</sup><br>+ ${P.R}sin(px) · sin(qy)<br>${P.px}x + ${P.py}y = ${P.M}<small>a = ${P.a}, b = ${P.b}, p = ${P.p}, q = ${P.q}<br>예산 이내 지형은 반투명, 예산 초과 지형은 불투명합니다.</small>`;
}
function renderReadout(){
  $('readout').innerHTML=`<dt>단계</dt><dd>${iter}</dd>
    <dt>현재 gbest</dt><dd>x = ${n2(gbest.x)}, y = ${n2(yOf(gbest.x))}</dd>
    <dt>현재 최고 효용</dt><dd>U = ${gbest.u.toFixed(4)}</dd>
    <dt>예산선 위 최대 효용</dt><dd>U* ≈ ${truth.u.toFixed(4)}</dd>`;
}
function renderIterationLog(){
  const list=$('iterationLog'), summary=$('iterationSummary');
  if(!list || !summary) return;
  const current=`(x = ${n2(gbest.x)}, y = ${n2(yOf(gbest.x))}), U = ${gbest.u.toFixed(3)}`;
  summary.textContent=iter===0 ? `초기 gbest: ${current}. 아직 단계를 진행하지 않았습니다.` : `${iter}단계 진행 · 현재 gbest: ${current}`;
  if(stepLog.length===0){
    list.innerHTML='<li class="iteration-empty">첫 단계를 진행하면 탐색 과정이 여기에 표시됩니다.</li>';
    return;
  }
  list.innerHTML=stepLog.map(entry=>{
    const now=`(x = ${n2(entry.x)}, y = ${n2(yOf(entry.x))}), U = ${entry.u.toFixed(3)}`;
    const caption=entry.improved
      ? `gbest 갱신: U ${entry.oldU.toFixed(3)} → ${entry.u.toFixed(3)} (+${(entry.u-entry.oldU).toFixed(3)}), x=${n2(entry.x)}, y=${n2(yOf(entry.x))}.`
      : `gbest 유지: ${now}.`;
    return `<li class="iteration-entry ${entry.improved?'is-improved':'is-stable'}"><strong class="iteration-number">${entry.n}단계</strong><p>${caption} pbest 갱신 ${entry.personalUpdates}개.</p></li>`;
  }).join('');
  list.scrollTop=list.scrollHeight;
}
function setStatus(msg, warn){ const el=$('status'); el.textContent=msg; el.classList.toggle('warn', !!warn); }

/* ---------- 한 단계 탐색 ---------- */
async function advanceOneStep(){
  if(animating)return;animating=true;setAnimationControls(true);
  const startXs=swarm.map(p=>p.x),startPbests=swarm.map(p=>p.bx),startUtilities=swarm.map(p=>p.bu),startBestX=gbest.x;
  const previous=step(swarm,gbest);iter++;hist.push(gbest.u);
  const personalUpdates=swarm.filter((p,i)=>p.bu>startUtilities[i]).length;
  stepLog.push({n:iter,oldX:previous.x,oldU:previous.u,x:gbest.x,u:gbest.u,
    improved:gbest.u>previous.u,personalUpdates});
  renderConv();renderReadout();
  await Promise.all([renderBudget(startXs,previous.x,startPbests),renderProfile(startXs,previous.x,startPbests)]);
  setStatus(`${iter}단계: 입자들이 이동하고 있습니다…`);
  let animationFailed=false;
  try{ await animateMovement(startXs,startPbests,startBestX); }
  catch(e){animationFailed=true;await Promise.all([renderBudget(),renderProfile()]);}
  finally{ animating=false;setAnimationControls(false); }
  renderIterationLog();renderReadout();renderConv();
  if(animationFailed){setStatus('입자 위치를 갱신했습니다. 다음 단계를 눌러 탐색을 이어가세요.');return;}
  setStatus(gbest.u>=truth.u-0.001
    ? `예산선 위 최적해에 가까워졌습니다. ${iter}단계의 이동과 gbest 갱신을 확인해 보세요.`
    : `${iter}단계 이동 완료 · 다음 단계를 눌러 탐색을 이어가세요.`);
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
function onPsoChange(key){ if(key==='N') resetSwarm(); }

function presetRow(host, list, obj, defs){
  $(host).innerHTML = list.map((p,i)=>`<button data-i="${i}">${p.name}</button>`).join('');
  $(host).querySelectorAll('button').forEach(b=>b.addEventListener('click', ()=>{
    Object.assign(obj, list[+b.dataset.i].v); syncCtrls(defs, obj);
  }));
}

function init(){
  buildCtrls('psoCtrls', PSO_CTRLS, S, onPsoChange);
  presetRow('psoPresets', PSO_PRESETS, S, PSO_CTRLS.filter(d=>['w','c1','c2'].includes(d.key)));
  $('btnStep').addEventListener('click', advanceOneStep);
  $('btnReset').addEventListener('click', resetSwarm);
  $('chkTruth').addEventListener('change', renderDynamic);
  try{ window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderAll); }catch(e){}

  renderFormula();
  const s=newSwarm(S.N); swarm=s.sw; gbest=s.g; hist=[gbest.u];
  renderIterationLog();
  if(!window.Plotly){ $('landscape').innerHTML='<div class="loading">그래프 라이브러리를 불러오지 못했습니다. 페이지를 새로고침해 주세요.</div>'; return; }
  $('landscape').innerHTML='';
  renderAll();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

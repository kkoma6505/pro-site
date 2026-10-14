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
function planStep(sw,g){
  const vmax=0.2*xMax();
  return sw.map(p=>{
    const r1=Math.random(),r2=Math.random();
    const inertia=S.w*p.v,personal=S.c1*r1*(p.bx-p.x),social=S.c2*r2*(g.x-p.x);
    const rawV=inertia+personal+social,v=Math.max(-vmax,Math.min(vmax,rawV)),x=Math.max(0,Math.min(xMax(),p.x+v));
    return {...p,r1,r2,inertia,personal,social,rawV,nextV:v,nextX:x,nextU:f(x),improved:f(x)>p.bu};
  });
}
function commitPositions(sw,plan){plan.forEach((next,i)=>{sw[i].prevX=next.x;sw[i].x=next.nextX;sw[i].v=next.nextV;});}
function commitPersonal(sw,plan){plan.forEach((next,i)=>{if(next.improved){sw[i].bu=next.nextU;sw[i].bx=next.nextX;}});}
function commitGlobal(sw,g){
  const best=sw.reduce((a,p)=>p.bu>a.bu?p:a,sw[0]);g.x=best.bx;g.u=best.bu;
}
function step(sw,g){
  const before={x:g.x,u:g.u},plan=planStep(sw,g);
  commitPositions(sw,plan);commitPersonal(sw,plan);commitGlobal(sw,g);
  return before;
}

let swarm=[],gbest={x:0,u:0},iter=0,hist=[],stepLog=[],animating=false,slowState=null;
function resetSwarm(){
  if(animating)return;
  slowState=null;
  const s=newSwarm(S.N); swarm=s.sw; gbest=s.g; iter=0; hist=[gbest.u]; stepLog=[];
  renderIterationLog();
  setStatus('입자를 예산선 위에 무작위로 뿌렸습니다. 한 단계씩 진행해 보세요.');
  renderDynamic();
  populateFocus();updateLearningMode();setAnimationControls(false);
}

/* ---------- 색상 ---------- */
const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function colors(){ return {ink:tok('--ink'), muted:tok('--muted'), line:tok('--line'), grid:tok('--grid'),
  teal:tok('--teal'), low:tok('--low'), high:tok('--high'), amber:tok('--amber'), amberInk:tok('--amber-ink'),
  indigo:tok('--indigo'), crimson:tok('--crimson'), panel:tok('--panel')}; }
function focusIndex(){return Math.max(0,Math.min(swarm.length-1,Number($('focusParticle').value)||0));}
function particleMarker(size,c){return {size:swarm.map((_,i)=>$('chkSlow').checked&&i===focusIndex()?size+2:size),
  color:swarm.map((_,i)=>$('chkSlow').checked&&i===focusIndex()?c.amber:c.indigo),line:{color:c.panel,width:1}};}

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
    {type:'scatter3d',mode:'markers',x:viewXs,y:viewXs.map(yOf),z:viewXs.map(f),marker:particleMarker(6,c),hovertemplate:'입자<br>x=%{x:.2f}, y=%{y:.2f}<br>U=%{z:.3f}<extra></extra>'},
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
    {type:'scatter',mode:'markers',x:viewXs,y:viewXs.map(f),marker:particleMarker(9,c),hovertemplate:'입자<br>x=%{x:.2f}<br>U=%{y:.3f}<extra></extra>'},
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
  $('chkSlow').disabled=disabled||!!slowState;$('focusParticle').disabled=disabled||!!slowState;
  document.querySelectorAll('#psoCtrls input,#psoPresets button').forEach(el=>el.disabled=disabled||!!slowState);
}
function animateMovement(startXs,startPbests,startBestX,duration=720){
  const endXs=swarm.map(p=>p.x),endPbests=swarm.map(p=>p.bx),endBestX=gbest.x;
  let lastDraw=0;
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

/* 학습 모드에서는 위치와 기억을 실제 순서대로 갱신하고, 클릭 사이에 멈춘다. */
function populateFocus(){
  $('focusParticle').innerHTML=swarm.map((_,i)=>`<option value="${i}">입자 ${i+1}</option>`).join('');
  $('focusParticle').value='0';
}
function learningCaption(phase,message){
  const labels=['속도 계산','위치 이동','pbest 비교','gbest 비교'];
  $('learningExplanation').innerHTML=`<ol class="learning-phases">${labels.map((label,i)=>`<li class="${phase===i+1?'active':''}" ${phase===i+1?'aria-current="step"':''}>${i+1}. ${label}</li>`).join('')}</ol><p>${message}</p>`;
}
function updateLearningMode(){
  const slow=$('chkSlow').checked;
  document.querySelector('.wrap').classList.toggle('learning-mode',slow);
  $('learningExplanation').hidden=!slow;$('focusLabel').hidden=!slow;
  $('btnStep').textContent=slow?'① 속도 계산 보기 ▶':'한 단계 진행 ▶';
  if(slow)learningCaption(0,'한 시행을 네 과정으로 나눕니다. 주황색 점의 계산값을 살펴보세요. 각 과정 뒤에는 다음 버튼을 누를 때까지 멈춥니다.');
}
async function advanceSlow(){
  if(animating)return;
  if(!slowState){
    slowState={phase:1,plan:planStep(swarm,gbest),before:{...gbest},startXs:swarm.map(p=>p.x),startPbests:swarm.map(p=>p.bx),focus:focusIndex()};
    const p=slowState.plan[slowState.focus];
    learningCaption(1,`<strong>${iter+1}시행 · 입자 ${slowState.focus+1}: 속도 계산</strong><br>v′ = wv + c₁r₁(pbest − x) + c₂r₂(gbest − x). 관성은 이전 움직임을, 개인 기억과 군집 정보는 좋은 위치로 향하는 힘을 더합니다.<br>r₁=${p.r1.toFixed(3)}, r₂=${p.r2.toFixed(3)} · 관성 ${p.inertia.toFixed(3)} + 개인 기억 ${p.personal.toFixed(3)} + 군집 정보 ${p.social.toFixed(3)} = ${p.rawV.toFixed(3)}. 속도 제한 적용 후 v′=${p.nextV.toFixed(3)}. 아직 점과 기억은 움직이지 않았습니다.`);
    $('btnStep').textContent='② 천천히 이동 보기 ▶';setAnimationControls(false);return;
  }
  const state=slowState,p=state.plan[state.focus];
  if(state.phase===1){
    animating=true;setAnimationControls(true);commitPositions(swarm,state.plan);
    learningCaption(2,`<strong>${iter+1}시행 · 입자 ${state.focus+1}: 위치 이동</strong><br>x′ = x + v′: ${p.x.toFixed(3)} + (${p.nextV.toFixed(3)}) → ${p.nextX.toFixed(3)}. 위치가 예산선의 범위를 벗어나면 끝점에서 멈춥니다.<br>y′ = (M − pₓx′)/pᵧ = ${yOf(p.nextX).toFixed(3)}. 점과 수선이 함께 움직입니다. 이동 후 U=${p.nextU.toFixed(3)}이며, pbest와 gbest는 아직 이전 기록입니다.`);
    setStatus(`${iter+1}시행 · 위치를 천천히 이동하는 중입니다.`);
    try{
      await Promise.all([renderBudget(state.startXs,state.before.x,state.startPbests),renderProfile(state.startXs,state.before.x,state.startPbests)]);
      await animateMovement(state.startXs,state.startPbests,state.before.x,2600);
    }catch(e){await Promise.all([renderBudget(),renderProfile()]);}
    finally{animating=false;state.phase=2;setAnimationControls(false);}
    $('btnStep').textContent='③ pbest 비교 보기 ▶';setStatus('이동 완료 · 다음 버튼으로 개인 최고 기록을 비교하세요.');return;
  }
  if(state.phase===2){
    commitPersonal(swarm,state.plan);state.phase=3;
    learningCaption(3,`<strong>${iter+1}시행 · 입자 ${state.focus+1}: pbest 비교</strong><br>새 위치의 효용 ${p.nextU.toFixed(3)}을 이전 개인 최고 효용 ${p.bu.toFixed(3)}과 비교합니다. ${p.improved?`더 높으므로 pbest를 x=${p.nextX.toFixed(3)}로 갱신합니다.`:'더 높지 않으므로 이전 pbest를 유지합니다.'}<br>전체 ${swarm.length}개 입자 중 ${state.plan.filter(n=>n.improved).length}개가 개인 기록을 갱신했습니다. 군집 최고점은 다음 과정에서 비교합니다.`);
    await Promise.all([renderBudget(),renderProfile()]);$('btnStep').textContent='④ gbest 비교 보기 ▶';return;
  }
  commitGlobal(swarm,gbest);iter++;hist.push(gbest.u);
  const improved=gbest.u>state.before.u;
  stepLog.push({n:iter,oldX:state.before.x,oldU:state.before.u,x:gbest.x,u:gbest.u,improved,personalUpdates:state.plan.filter(n=>n.improved).length});
  learningCaption(4,`<strong>${iter}시행: gbest 비교 · 시행 완료</strong><br>모든 입자의 pbest 중 효용이 가장 큰 기록을 군집 최고점으로 선택합니다. 이전 gbest U=${state.before.u.toFixed(3)}, 비교 후 U=${gbest.u.toFixed(3)}.<br>${improved?`더 좋은 기록을 발견해 빨간 최고점을 x=${n2(gbest.x)}, y=${n2(yOf(gbest.x))}로 갱신했습니다.`:'더 좋은 기록이 없어 군집 최고점을 유지했습니다.'} 다음 시행의 모든 입자는 이 gbest를 참조해 속도를 계산합니다.`);
  slowState=null;setAnimationControls(false);$('btnStep').textContent='다음 시행 · 속도 계산 ▶';
  renderDynamic();renderIterationLog();setStatus(`${iter}시행 완료 · 속도 계산부터 다시 살펴볼 수 있습니다.`);
}

/* ---------- 한 단계 탐색 ---------- */
async function advanceOneStep(){
  if($('chkSlow').checked)return advanceSlow();
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
  $('chkSlow').addEventListener('change',()=>{updateLearningMode();renderDynamic();requestAnimationFrame(()=>Plotly.Plots.resize('landscape'));});
  $('focusParticle').addEventListener('change',()=>{renderDynamic();learningCaption(0,`주황색 입자 ${focusIndex()+1}의 실제 속도와 기록 갱신값을 설명합니다. 속도 계산 버튼을 눌러 시작하세요.`);});
  try{ window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderAll); }catch(e){}

  renderFormula();
  const s=newSwarm(S.N); swarm=s.sw; gbest=s.g; hist=[gbest.u];
  populateFocus();updateLearningMode();
  renderIterationLog();
  if(!window.Plotly){ $('landscape').innerHTML='<div class="loading">그래프 라이브러리를 불러오지 못했습니다. 페이지를 새로고침해 주세요.</div>'; return; }
  $('landscape').innerHTML='';
  renderAll();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

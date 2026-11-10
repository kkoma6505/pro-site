(function(){
  const $=id=>document.getElementById(id),svg=$('hill'),explain=$('explain');
  const progress=$('progress'),values=$('values'),button=$('next'),reset=$('reset'),status=$('status');
  const objective=x=>25-(x-5)*(x-5),maxRounds=5;
  const colors={indigo:css('--indigo'),teal:css('--teal'),crimson:css('--crimson'),amber:css('--amber'),muted:css('--muted'),line:css('--line'),panel:css('--panel')};
  const fmt=n=>Number(n).toFixed(2),sx=x=>58+x*60,sy=u=>292-(u/26)*245;
  const params={w:.65,c1:1.4,c2:1.6,vmax:2.4};
  let particles=[],best=null,round=0,history=[],visualX=[],visualBest=null,animating=false;
  function css(name){return getComputedStyle(document.documentElement).getPropertyValue(name).trim();}
  function refreshBest(){const p=particles.reduce((a,b)=>a.pvalue>b.pvalue?a:b);best={x:p.pbest,u:p.pvalue};}
  function startRun(){
    particles=Array.from({length:3},(_,i)=>{const x=Math.random()*10;return {i,x,v:(Math.random()-.5)*1.4,pbest:x,pvalue:objective(x)};});
    refreshBest();visualX=particles.map(p=>p.x);visualBest={...best};round=0;history=[];animating=false;button.disabled=false;reset.disabled=false;render();
    status.textContent='입자를 무작위로 배치했습니다. 다음 시행을 누르면 현재 집단 최고 효용을 기준으로 입자들이 움직입니다.';
  }
  function plans(){return particles.map(p=>{
    const r1=Math.random(),r2=Math.random();
    const inertia=params.w*p.v,personal=params.c1*r1*(p.pbest-p.x),social=params.c2*r2*(best.x-p.x);
    const raw=inertia+personal+social,v=Math.max(-params.vmax,Math.min(params.vmax,raw));
    const x=Math.max(0,Math.min(10,p.x+v));
    return {...p,r1,r2,inertia,personal,social,raw,v,nextX:x,nextU:objective(x)};
  });}
  function draw(){
    let out='<title>한 봉우리 효용 곡선에서 연속으로 탐색하는 입자</title><line class="axis" x1="58" y1="292" x2="658" y2="292"/><line class="axis" x1="58" y1="47" x2="58" y2="292"/>';
    [0,5,10,15,20,25].forEach(v=>{const y=sy(v);out+=`<line class="axis" x1="54" y1="${y}" x2="658" y2="${y}" opacity=".35"/><text class="tick" x="46" y="${y+4}" text-anchor="end">${v}</text>`;});
    for(let x=0;x<=10;x+=2)out+=`<text class="tick" x="${sx(x)}" y="316" text-anchor="middle">${x}</text>`;
    out+='<text class="tick" x="360" y="338" text-anchor="middle">위치 x</text><text class="tick" transform="translate(16 170) rotate(-90)" text-anchor="middle">효용의 정도</text>';
    let curvePath='';
    for(let i=0;i<=100;i++){const x=i/10;curvePath+=(i?'L':'M')+sx(x).toFixed(1)+','+sy(objective(x)).toFixed(1)+' ';}
    out+=`<path class="curve-area" d="${curvePath} L658,292 L58,292 Z"/><path class="curve" d="${curvePath}"/>`;
    if(animating&&visualX.length===particles.length){particles.forEach((p,i)=>{const from=animFrom[i],to=p.x;out+=`<line x1="${sx(from)}" y1="${sy(objective(from))}" x2="${sx(to)}" y2="${sy(objective(to))}" stroke="${colors.indigo}" stroke-width="2" opacity=".25"/>`;});}
    particles.forEach((p,i)=>{const x=visualX[i]??p.x;out+=`<line class="marker-line" x1="${sx(x)}" y1="${sy(objective(x))}" x2="${sx(x)}" y2="292" stroke="${colors.indigo}"/><circle class="pbest-dot" cx="${sx(p.pbest)}" cy="${sy(p.pvalue)}" r="5"/><circle class="particle-dot" cx="${sx(x)}" cy="${sy(objective(x))}" r="8" fill="${i===0?colors.amber:colors.indigo}"/><text class="particle-label" x="${sx(x)}" y="${sy(objective(x))-13}" text-anchor="middle">입자 ${i+1}</text>`;});
    if(visualBest){const bx=sx(visualBest.x),by=sy(visualBest.u);out+=`<circle class="gbest-dot" cx="${bx}" cy="${by}" r="8"><title>집단이 찾은 최고 효용 ${fmt(visualBest.u)}</title></circle>`;}
    svg.innerHTML=out;
  }
  let animFrom=[];
  function animateMovement(fromX,fromBest,duration=850){
    const toX=particles.map(p=>p.x),toBest={...best},start=performance.now();animFrom=fromX.slice();animating=true;
    return new Promise(resolve=>{function frame(now){const t=Math.min(1,(now-start)/duration),ease=1-Math.pow(1-t,3);visualX=fromX.map((x,i)=>x+(toX[i]-x)*ease);visualBest={x:fromBest.x+(toBest.x-fromBest.x)*ease,u:fromBest.u+(toBest.u-fromBest.u)*ease};draw();if(t<1)requestAnimationFrame(frame);else{visualX=toX;visualBest=toBest;animating=false;resolve();}}requestAnimationFrame(frame);});
  }
  function updatePanel(entry){
    progress.innerHTML=Array.from({length:maxRounds+1},(_,i)=>`<li class="${i===round?'active':''}" ${i===round?'aria-current="step"':''}>${i===0?'시작':`${i}회차`}</li>`).join('');
    values.innerHTML=`<div class="value">진행한 시행<b>${round} / ${maxRounds}</b></div><div class="value">집단 최고 효용<b>${fmt(best.u)}</b></div><div class="value">실제 봉우리<b>25.00</b></div>`;
    if(!entry){explain.innerHTML=`<p><strong>무작위 시작</strong> 입자 세 개가 서로 다른 위치에서 시작합니다. 곡선의 높이는 각 위치에서의 효용의 정도이고, 빨간 점은 현재 집단의 최고 효용입니다.</p><p>첫 시행은 이 최고 기록을 기준으로 속도를 계산합니다. 시행을 진행할수록 새로 찾은 기록이 다음 이동의 기준이 됩니다.</p>`;status.textContent='아직 시행을 진행하지 않았습니다. 현재 집단 최고 효용을 확인한 뒤 다음 시행을 눌러보세요.';}
    else{const change=entry.improved?`집단 최고 효용이 ${fmt(entry.old.u)}에서 ${fmt(entry.next.u)}로 갱신됐습니다.`:`이번 시행에서는 더 높은 효용을 찾지 못해 ${fmt(entry.next.u)}를 유지합니다.`;explain.innerHTML=`<p><strong>${entry.n}회차 시행 완료</strong> 입자들이 이전 집단 최고 효용 위치 ${fmt(entry.old.x)}를 참고해 이동했습니다.</p><p>${change}</p><p>다음 시행의 입자들은 갱신된 집단 최고 효용 위치 ${fmt(best.x)}를 기준으로 움직입니다.</p>`;status.textContent=round===maxRounds?'5회 연속 시행을 마쳤습니다. 새 무리로 시작하면 다른 무작위 배치로 다시 살펴볼 수 있습니다.':`${round}회차가 끝났습니다. 다음 시행에는 현재 집단 최고 효용 위치가 반영됩니다.`;}
    button.textContent=round>=maxRounds?'5회 시행 완료':'다음 시행 진행 →';button.disabled=round>=maxRounds||animating;
    $('trialCount').textContent=`${round} / ${maxRounds}회`;
    $('trialResult').textContent=history.length?`현재 집단 최고 효용: ${fmt(best.u)} · 위치 x=${fmt(best.x)}`:'첫 시행을 진행하면 회차별 최고 효용이 여기에 기록됩니다.';
    $('history').innerHTML=history.map(h=>`<li class="${h.improved?'updated':''}"><strong>${h.n}회차</strong> · ${h.improved?`최고 효용 갱신 ${fmt(h.old.u)} → ${fmt(h.next.u)}`:`최고 효용 유지 ${fmt(h.next.u)}`}</li>`).join('');
  }
  function render(){draw();updatePanel(history[history.length-1]||null);}
  async function advance(){
    if(animating||round>=maxRounds)return;
    const plan=plans(),fromX=particles.map(p=>p.x),old={...best};
    plan.forEach((q,i)=>{const p=particles[i];p.x=q.nextX;p.v=q.v;if(q.nextU>p.pvalue){p.pbest=q.nextX;p.pvalue=q.nextU;}});
    refreshBest();round++;
    const entry={n:round,old,next:{...best},improved:best.u>old.u};history.push(entry);
    animating=true;animFrom=fromX.slice();button.disabled=true;reset.disabled=true;updatePanel(entry);draw();
    await animateMovement(fromX,old);
    reset.disabled=false;render();
  }
  button.addEventListener('click',advance);reset.addEventListener('click',startRun);
  startRun();
})();

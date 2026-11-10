(function(){
  const svg=document.getElementById('hill'), explain=document.getElementById('explain');
  const progress=document.getElementById('progress'), values=document.getElementById('values');
  const button=document.getElementById('next'), status=document.getElementById('status');
  const resetButton=document.getElementById('reset');
  const steps=['현재 상태','속도 계산','위치 이동','개별 최고 효용 비교','무리 최고 효용 비교'];
  const colors={indigo:getComputedStyle(document.documentElement).getPropertyValue('--indigo').trim()||'#3949ab',teal:getComputedStyle(document.documentElement).getPropertyValue('--teal').trim()||'#2f6f73',crimson:getComputedStyle(document.documentElement).getPropertyValue('--crimson').trim()||'#c2334d',muted:getComputedStyle(document.documentElement).getPropertyValue('--muted').trim()||'#5c6b70',line:getComputedStyle(document.documentElement).getPropertyValue('--line').trim()||'#d3dcd9'};
  // 한 봉우리 함수 f(x)=25-(x-5)^2, 탐색 범위는 0부터 10입니다.
  const objective=x=>25-(x-5)*(x-5), w=.5,c1=1,c2=1,r1=.5,r2=.5;
  let particles, gbest, phase, pending, visualX=[];
  const fmt=n=>Number(n).toFixed(2);
  const sx=x=>58+x*60, sy=u=>292-(u/26)*245;
  function initial(){particles=[{x:1,v:0,pbest:1,pvalue:objective(1)},{x:3,v:0,pbest:3,pvalue:objective(3)},{x:8,v:0,pbest:8,pvalue:objective(8)}];const best=particles.reduce((a,p)=>p.pvalue>a.pvalue?p:a);gbest={pbest:best.pbest,pvalue:best.pvalue};visualX=particles.map(p=>p.x);phase=0;pending=null;button.disabled=false;resetButton.disabled=false;render();}
  function curve(){let d='';for(let i=0;i<=100;i++){const x=i/10;d+=(i?'L':'M')+sx(x).toFixed(1)+','+sy(objective(x)).toFixed(1)+' ';}return d;}
  function particleData(){return pending||particles.map((p,i)=>{const inertia=w*p.v,personal=c1*r1*(p.pbest-p.x),social=c2*r2*(gbest.pbest-p.x),velocity=inertia+personal+social,nextX=Math.max(0,Math.min(10,p.x+velocity));return {...p,i,inertia,personal,social,velocity,nextX,nextValue:objective(nextX)};});}
  function draw(){
    const plan=particleData();
    let out='<title>효용 함수 위 입자와 최고 기록</title><line class="axis" x1="58" y1="292" x2="658" y2="292"/><line class="axis" x1="58" y1="47" x2="58" y2="292"/>';
    [0,5,10,15,20,25].forEach(v=>{const y=sy(v);out+=`<line class="axis" x1="54" y1="${y}" x2="658" y2="${y}" opacity=".35"/><text class="tick" x="46" y="${y+4}" text-anchor="end">${v}</text>`;});
    for(let x=0;x<=10;x+=2)out+=`<text class="tick" x="${sx(x)}" y="316" text-anchor="middle">${x}</text>`;
    out+='<text class="tick" x="360" y="338" text-anchor="middle">위치 x</text><text class="tick" transform="translate(16 170) rotate(-90)" text-anchor="middle">효용 f(x)</text>';
    const curvePath=curve();
    out+=`<path class="curve-area" d="${curvePath} L658,292 L58,292 Z"/><path class="curve" d="${curvePath}"/>`;
    // 기록 위치를 현재 위치와 구분해 세로 보조선과 표식으로 표현합니다.
    particles.forEach((p,i)=>{const col=colors.indigo,x=visualX[i]??p.x;out+=`<line class="marker-line" x1="${sx(x)}" y1="${sy(objective(x))}" x2="${sx(x)}" y2="292" stroke="${col}"/><circle class="particle-dot" cx="${sx(x)}" cy="${sy(objective(x))}" r="8" fill="${col}"/><text class="particle-label" x="${sx(x)}" y="${sy(objective(x))-13}" text-anchor="middle">입자 ${i+1}</text>`;
      out+=`<circle class="pbest-dot" cx="${sx(p.pbest)}" cy="${sy(p.pvalue)}" r="5"/>`;});
    out+=`<circle class="gbest-dot" cx="${sx(gbest.pbest)}" cy="${sy(gbest.pvalue)}" r="7"><title>무리 최고 효용 위치 x=${fmt(gbest.pbest)}, 효용 ${fmt(gbest.pvalue)}</title></circle>`;
    if(phase>=2){const plan=particleData();plan.forEach(p=>{out+=`<line x1="${sx(p.x)}" y1="${sy(objective(p.x))}" x2="${sx(p.nextX)}" y2="${sy(p.nextValue)}" stroke="${colors.teal}" stroke-width="2"/>`;});}
    if(phase>=3){const plan=particleData();plan.forEach(p=>{out+=`<circle cx="${sx(p.x)}" cy="${sy(objective(p.x))}" r="11" fill="none" stroke="${p.nextValue>p.pvalue?colors.teal:colors.muted}" stroke-width="2"/>`;});}
    if(phase>=4){const best=particles.reduce((a,p)=>p.pvalue>a.pvalue?p:a);out+=`<circle class="gbest-dot" cx="${sx(best.pbest)}" cy="${sy(best.pvalue)}" r="11"/>`;}
    svg.innerHTML=out;
  }
  function animateParticles(duration=850){
    const from=visualX.slice(),to=particles.map(p=>p.x),start=performance.now();
    return new Promise(resolve=>{function frame(now){const t=Math.min(1,(now-start)/duration),ease=1-Math.pow(1-t,3);visualX=from.map((x,i)=>x+(to[i]-x)*ease);draw();if(t<1)requestAnimationFrame(frame);else{visualX=to;resolve();}}requestAnimationFrame(frame);});
  }
  function explainPhase(){
    const plan=particleData();
    const plans=plan.map(p=>`입자 ${p.i+1}: ${fmt(p.velocity)}`).join(' · ');
    const moved=plan.map(p=>`입자 ${p.i+1}은 x=${fmt(p.x)}에서 ${fmt(p.nextX)}로 이동`).join(', ');
    if(phase===0){explain.innerHTML='<p><strong>현재 상태</strong> 입자들은 x=1, 3, 8에서 시작합니다. 곡선의 높이는 각 위치에서의 효용의 정도를 나타내며, 빨간 점은 무리가 찾은 최고 효용입니다.</p><p>입자 1을 따라가며 네 과정을 하나씩 확인해 보세요.</p>';button.textContent='① 속도 계산 보기 →';}
    if(phase===1){const p=plan[0];explain.innerHTML=`<p><strong>속도 계산</strong> 입자 1은 현재 x=${fmt(p.x)}에 있고, 개별 입자가 찾은 최고 효용의 위치는 ${fmt(p.pbest)}, 무리가 찾은 최고 효용의 위치는 ${fmt(gbest.pbest)}입니다.</p><p>지난 이동의 관성이 ${fmt(p.inertia)}, 개별 기록을 향하는 힘이 ${fmt(p.personal)}, 무리의 최고 기록을 향하는 힘이 ${fmt(p.social)}만큼 속도에 보태집니다. 세 영향이 합쳐져 입자 1은 <strong>${fmt(p.velocity)}</strong>만큼 움직일 예정입니다.</p><p>다른 입자의 새 속도: ${plans}</p>`;button.textContent='② 입자 이동 보기 →';}
    if(phase===2){explain.innerHTML=`<p><strong>입자 이동</strong> ${moved}합니다. 그래프 위 점이 새 위치로 이동하는 모습을 확인하세요.</p><p>입자는 새 위치에서 효용을 확인하지만, 지금은 아직 최고 기록을 바꾸지 않았습니다.</p>`;button.textContent='③ 개별 최고 효용 비교 보기 →';}
    if(phase===3){const wins=plan.filter(p=>p.nextValue>p.pvalue);explain.innerHTML=`<p><strong>개별 최고 효용 비교</strong> 새 위치에서 얻은 효용과 각 입자의 최고 효용 기록을 비교합니다.</p><p>${wins.length?wins.map(p=>`입자 ${p.i+1}: ${fmt(p.pvalue)} → ${fmt(p.nextValue)}로 개별 최고 효용 갱신`).join('<br>'):'이번 이동에서는 개별 최고 효용 기록이 바뀌지 않습니다.'}</p><p>이제 개별 최고 효용 중 가장 높은 기록을 고릅니다.</p>`;button.textContent='④ 무리 최고 효용 비교 보기 →';}
    if(phase===4){explain.innerHTML=`<p><strong>무리 최고 효용 비교</strong> 모든 입자의 최고 효용 기록 중 가장 높은 값은 <strong>${fmt(gbest.pvalue)}</strong>입니다. 무리가 찾은 최고 효용의 위치는 x=${fmt(gbest.pbest)}입니다.</p><p>한 시행이 끝났습니다. 다음 시행의 모든 입자는 이 위치를 참고해 속도를 계산합니다.</p>`;button.textContent='처음 배치에서 다시 보기 ↻';}
    progress.innerHTML=steps.map((s,i)=>`<li class="${i===phase?'active':''}" ${i===phase?'aria-current="step"':''}>${s}</li>`).join('');
    values.innerHTML=`<div class="value">현재 시행<b>${phase===4?'완료':'1 / 1'}</b></div><div class="value">무리가 찾은 최고 효용<b>${fmt(gbest.pvalue)}</b></div><div class="value">실제 봉우리<b>25.00</b></div>`;
    status.textContent=phase===4?'좋은 위치를 찾으면 기억에 저장하고, 다음 이동의 기준으로 공유합니다.':'파란 점은 현재 위치, 초록 테두리는 개인 기록, 빨간 점은 무리 최고 기록입니다.';
  }
  function render(){draw();explainPhase();}
  button.addEventListener('click',async()=>{
    if(phase===4){initial();return;}
    if(phase===0)pending=particleData();
    phase++;
    if(phase===2){pending.forEach((p,i)=>{particles[i].x=p.nextX;particles[i].v=p.velocity;});button.disabled=true;resetButton.disabled=true;render();await animateParticles();button.disabled=false;resetButton.disabled=false;render();return;}
    if(phase===3){const plan=particleData();plan.forEach((p,i)=>{if(p.nextValue>particles[i].pvalue){particles[i].pbest=p.nextX;particles[i].pvalue=p.nextValue;}});}
    if(phase===4){const best=particles.reduce((a,p)=>p.pvalue>a.pvalue?p:a);gbest={pbest:best.pbest,pvalue:best.pvalue};}
    render();
  });
  document.getElementById('reset').addEventListener('click',initial);
  initial();
})();

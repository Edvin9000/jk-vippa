'use strict';
// One fixed-purpose teaching model. No propagation solver or simulation framework.
const $ = id => document.getElementById(id);
const initial = mode => ({mode, j:0, k:0, kBar:1, clk:0, q:0, clear:false, preset:false});
let state = initial('jk'), history = [], step = 0, pulseNumber = 0;
let autoTimer = null, pulseTimer = null, raceTimer = null, pathTimers = [];
let busy = false, raceCount = 0;
const names = ['Hold – minne', 'Reset', 'Set', 'Toggle – växling'];
function evaluateJK(j,k,q) { return j ? (k ? 1-q : 1) : (k ? 0 : q); }
function effectiveK() { return state.mode === 'sn' ? 1-state.kBar : state.k; }
function operation() { return state.j*2+effectiveK(); }
function record() {
  history.push({...state, qBar:1-state.q, step:step++, pulse:pulseNumber});
  history = history.filter(s=>s.pulse >= pulseNumber-7).slice(-64);
}
function commit() { record(); render(); }
function setClock(value) {
  if(value === state.clk) return;
  state.clk = value;
  if(value) {
    pulseNumber++;
    if(state.mode === 'sn') {
      if(!state.clear && !state.preset) state.q = evaluateJK(state.j, 1-state.kBar, state.q);
    } else state.q = evaluateJK(state.j,state.k,state.q);
    animatePath();
  } else {
    stopRace();
    if(state.mode === 'race') cancelPath();
    if(state.mode === 'sn') animatePath('fall');
  }
  commit();
  if(value && state.mode === 'race') startRace();
}
function startRace() {
  stopRace();
  if(state.clk && state.j && state.k) raceTimer = setInterval(()=>{
    state.q = 1-state.q; raceCount++; commit(); animatePath();
  },250);
}
function stopRace() { clearInterval(raceTimer); raceTimer = null; }
function cancelPath() {
  pathTimers.forEach(clearTimeout); pathTimers=[];
  document.querySelectorAll('.path-active').forEach(n=>n.classList.remove('path-active'));
  $('pathStep').textContent='';
}
function animatePath(reason='clock') {
  cancelPath();
  if(!$('path').checked) return;
  const op=operation(), upper=op===2 || (op===3 && state.q===1);
  let route, delay=120;
  if(state.mode==='sn') {
    if(state.clear || state.preset) {
      route=[[state.clear?'clearBar':'presetBar','Aktiv låg ingång → asynkron styrning'],['ic','CLR̅ / PRE̅ går före klockan'],['q','Q styrs utan klockflank'],['qBar','Q̅ är motsatsen']];
    } else if(reason==='fall') {
      route=[['clk','Fallande flank: Q behåller sitt tillstånd']];
    } else if(reason==='input' || !state.clk || reason==='async') {
      route=[['j','J och K̅ anger nästa operation'],['kBar','K̅ = 0 betyder K = 1'],['ic','Väntar på nästa uppåtflank; Q hålls kvar']];
    } else {
      route=[['clk','↑ Uppåtflanken läser J och K̅'],['ic',names[op]],['q','Q visas efter flanken'],['qBar','Q̅ är motsatsen']];
    }
  } else if(state.mode==='race' && state.clk && state.j && state.k) {
    // Finish a full visual route before the next 250 ms feedback toggle.
    delay=70;
    route=[[upper?'upper':'lower','Den aktiva ingångsvägen påverkar låskretsen'],['latch','Q och Q̅ växlar'],['feedback','Återkoppling: CLK är fortfarande hög → nästa växling']];
  } else if(!state.clk || op===0) {
    route=[['clk',state.clk?'CLK är hög':'CLK är låg'],['latch','Låskretsen behåller sitt tillstånd']];
  } else {
    route=[[upper?'j':'k',upper?'J aktiverar övre vägen':'K aktiverar nedre vägen'],[upper?'upper':'lower','Tre NAND bildar en 3-ingångars NAND'],['latch','Latchens lagrade tillstånd visas'],['q','Q visas'],['qBar','Q̅ är motsatsen'],['feedback','Tillståndet återkopplas']];
  }
  route.forEach(([group,label],i)=>pathTimers.push(setTimeout(()=>{
    document.querySelectorAll('.path-active').forEach(n=>n.classList.remove('path-active'));
    document.querySelectorAll(`[data-stage="${group}"]`).forEach(n=>n.classList.add('path-active'));
    $('pathStep').textContent=label;
  },i*delay)));
  pathTimers.push(setTimeout(cancelPath,route.length*delay+(state.mode==='race'?30:100)));
}
function stopClocks() {
  clearInterval(autoTimer); clearTimeout(pulseTimer); autoTimer=pulseTimer=null;
  busy=false; stopRace(); cancelPath();
  if(state.clk) setClock(0); else render();
  cancelPath();
}
function pulseClock() {
  if(busy || autoTimer) return;
  if(state.clk) setClock(0);
  busy=true; setClock(1);
  pulseTimer=setTimeout(()=>{setClock(0);pulseTimer=setTimeout(()=>{busy=false;pulseTimer=null;render();},500);},500);
}
// Extend the timeline without evaluating logic or generating a clock edge.
function nextStep() {
  if(busy || autoTimer || (state.mode==='race' && state.clk && state.j && state.k)) return;
  record(); drawHistory();
}
function reset(mode=state.mode) {
  stopClocks(); state=initial(mode); history=[];step=0;pulseNumber=0;raceCount=0;
  $('circuit').innerHTML = mode==='sn' ? icMarkup() : circuitMarkup();
  commit();
}
function setInput(key) {
  state[key]=1-state[key];
  if(state.mode==='race' && state.clk) {
    if(!(state.j && state.k)) state.q=evaluateJK(state.j,state.k,state.q);
    startRace();
  }
  commit(); animatePath('input');
}
function setAsync(key) {
  state[key]=!state[key];
  if(state[key]) {state[key==='clear'?'preset':'clear']=false;state.q=key==='clear'?0:1;}
  commit(); animatePath('async');
}
// SVG geometry intentionally matches the Master–Slave sister site.
function markupHelpers() {
  const out=[];
  const wire=(d,s,stage=s)=>out.push(`<path d="${d}" class="wire" data-signal="${s}" data-stage="${stage}"/>`);
  const dot=(x,y,s)=>out.push(`<circle cx="${x}" cy="${y}" r="4" class="junction" data-signal="${s}"/>`);
  const text=(x,y,t,c='svg-label',anchor='start')=>out.push(`<text x="${x}" y="${y}" class="${c}" text-anchor="${anchor}">${t}</text>`);
  const value=(x,y,label,s)=>{text(x,y,label);out.push(`<text x="${x+65}" y="${y}" class="signal-value" data-signal="${s}"></text>`);};
  const gate=(x,y,id,stage)=>out.push(`<g class="gate" data-stage="${stage}"><path d="M${x} ${y-32} H${x+38} C${x+82} ${y-32} ${x+82} ${y+32} ${x+38} ${y+32} H${x} Z" class="gate-shape"/><circle cx="${x+74}" cy="${y}" r="6" class="gate-shape"/><text x="${x+31}" y="${y+6}" class="gate-id">${id}</text></g>`);
  return {out,wire,dot,text,value,gate};
}
function circuitMarkup() {
  const {out,wire,dot,text,value,gate}=markupHelpers();
  out.push('<rect x="175" y="90" width="540" height="130" class="group-box"/><rect x="175" y="280" width="540" height="130" class="group-box"/>');
  text(440,45,'INGÅNGSLOGIK','section-label','middle');text(965,45,'KORSKOPPLAD LATCH','section-label','middle');
  text(350,113,'J · CLK · Q̅ → 3-ingångars NAND','svg-label','middle');
  text(350,397,'K · CLK · Q → 3-ingångars NAND','svg-label','middle');
  // Upper: NAND(J,CLK), tied-input inverter, NAND(AND(J,CLK),Qbar).
  wire('M50 144 H200','j');wire('M50 334 H200','k');
  wire('M55 250 H150 V176 H200','clk');wire('M150 250 V366 H200','clk');dot(150,250,'clk');
  for(const [y,p,id,stage] of [[160,'u',1,'upper'],[350,'l',4,'lower']]) {
    wire(`M280 ${y} H315 V${y-16} H360`,p+'1',stage);
    wire(`M315 ${y} V${y+16} H360`,p+'1',stage);dot(315,y,p+'1');
    wire(`M440 ${y} H495 V${y-16} H560`,p+'2',stage);
    wire(`M640 ${y} H810 V${y===160?y-16:y+16} H850`,p+'3',stage);
    gate(200,y,'N'+id,stage);gate(360,y,'N'+(id+1),stage);gate(560,y,'N'+(id+2),stage);
    gate(850,y,y===160?'N7':'N8','latch');
    value(723,y===160?y-26:y+50,y===160?'S̅':'R̅',p+'3');
  }
  wire('M930 160 H1215','q');wire('M930 350 H1215','qBar');
  // Local cross-coupling: crossing has no junction.
  wire('M980 160 V215 L780 295 V334 H850','q','latch');
  wire('M980 350 V295 L780 215 V176 H850','qBar','latch');
  dot(980,160,'q');dot(980,350,'qBar');
  // Outer feedback tracks are separated from the latch and from each other.
  wire('M1100 350 V70 H520 V176 H560','qBar','feedback');
  wire('M1140 160 V440 H520 V366 H560','q','feedback');
  dot(1100,350,'qBar');dot(1140,160,'q');
  text(680,63,'← Q̅ återkopplas till J-sidan','svg-label');
  text(680,466,'← Q återkopplas till K-sidan','svg-label');
  value(55,125,'J','j');value(55,315,'K','k');value(55,235,'CLK','clk');
  value(1160,138,'Q','q');value(1160,381,'Q̅','qBar');
  text(440,480,'2 kapslar 7400 · 4 NAND per kapsel','svg-label','middle');
  return out.join('');
}
function icMarkup() {
  const {out,wire,text,value}=markupHelpers();
  out.push('<rect x="460" y="80" width="390" height="330" rx="12" class="gate-shape" data-stage="ic"/>');
  text(655,135,'SN74LS109AN','ic-title');text(655,168,'Vippa 1 av 2 · funktionellt block','ic-note');
  for(const [y,s,label] of [[220,'j','J'],[290,'kBar','K̅'],[360,'clk','CLK ↑']]) {
    wire(`M160 ${y} H460`,s);value(170,y-20,label,s);text(480,y+7,label);
  }
  out.push('<path d="M460 345 L477 360 L460 375" class="gate-shape"/>');
  for(const [y,s,label] of [[220,'q','Q'],[320,'qBar','Q̅']]) {wire(`M850 ${y} H1130`,s);value(1000,y-20,label,s);text(795,y+7,label);}
  wire('M570 40 V80','clearBar');wire('M740 40 V80','presetBar');value(530,28,'CLR̅','clearBar');value(705,28,'PRE̅','presetBar');
  out.push('<circle cx="570" cy="86" r="6" class="gate-shape"/><circle cx="740" cy="86" r="6" class="gate-shape"/>');
  text(655,454,'K̅ = 0 betyder K = 1 · Toggle vid J = 1, K̅ = 0','ic-note');
  text(655,482,'↑ Endast uppåtflank, utom asynkron CLR̅ / PRE̅','ic-note');
  return out.join('');
}
function signals() {
  const s={...state,qBar:1-state.q,clearBar:+!state.clear,presetBar:+!state.preset};
  s.u1=1-(s.j&s.clk);s.u2=1-s.u1;s.u3=1-(s.u2&s.qBar);
  s.l1=1-(s.k&s.clk);s.l2=1-s.l1;s.l3=1-(s.l2&s.q);
  return s;
}
function render() {
  const sn=state.mode==='sn',race=state.mode==='race',s=signals();
  document.querySelectorAll('[data-mode]').forEach(n=>n.setAttribute('aria-current',n.dataset.mode===state.mode?'page':'false'));
  $('subtitle').textContent=sn?'K̅ · uppåtflank och asynkrona ingångar':race?'Återkoppling medan CLK är hög':'8 NAND · återkoppling och minne';
  for(const [id,v,label] of [['j',s.j,'J'],['k',sn?s.kBar:s.k,sn?'K̅':'K']]) {
    $(id).querySelector('strong').textContent=`${label} = ${v}`;$(id).setAttribute('aria-pressed',!!v);
  }
  $('pulse').hidden=race;$('auto').hidden=race;$('hold').hidden=!race;$('level').hidden=!sn;$('async').hidden=!sn;$('raceInfo').hidden=!race;
  $('advance').disabled=busy||!!autoTimer||(race && !!state.clk && !!state.j && !!state.k);
  $('pulse').disabled=busy||!!autoTimer;$('level').disabled=busy||!!autoTimer;
  buttonLabel('auto',autoTimer?'Ⅱ 1 Hz':'▶ 1 Hz','A');$('auto').setAttribute('aria-pressed',!!autoTimer);
  $('hold').setAttribute('aria-pressed',!!state.clk);buttonLabel('hold',`CLK = ${state.clk}`,'L');buttonLabel('level',`CLK = ${state.clk}`,'L');$('level').setAttribute('aria-pressed',!!state.clk);
  $('clockHint').textContent=race?'L: lås/släpp CLK · C används inte i denna vy.':'Visuell klocka: 0,5 s hög + 0,5 s låg · labben använder 1 kHz';
  for(const [id,key,label] of [['clear','clear','CLR̅'],['preset','preset','PRE̅']]) {
    buttonLabel(id,`${label} = ${state[key]?0:1}`,id==='clear'?'D':'P');$(id).setAttribute('aria-pressed',state[key]);
    $(id).disabled=state[key==='clear'?'preset':'clear'];
  }
  $('circuitTitle').textContent=sn?'Färdig JK · positivt flankstyrd':race?'Visuell demonstration · åtta NAND · 250 ms per växling':'Egenbyggd JK · åtta 2-ingångars NAND';
  $('circuit').setAttribute('aria-label',sn?'SN74LS109AN med J, inverterad K, klocka, utgångar och asynkrona kontroller':'Åtta NAND-grindar. Q-streck återkopplas till J-sidan, Q till K-sidan.');
  $('path').disabled=false;
  $('circuit').querySelectorAll('[data-signal]').forEach(n=>{const v=s[n.dataset.signal];n.dataset.v=v;if(n.classList.contains('signal-value')) n.textContent=v;});
  $('outputs').textContent=`Q = ${s.q} · Q̅ = ${s.qBar}`;$('clockState').textContent=`CLK = ${s.clk} · ${s.clk?'HIGH':'LOW'}`;
  const op=operation();
  $('status').textContent=sn&&(s.clear||s.preset)?`${s.clear?'CLR̅ → Reset':'PRE̅ → Set'} · asynkront`:race&&s.clk&&s.j&&s.k?`Tävling · Q återkopplas och växlar igen (${raceCount} upprepningar)`:names[op];
  $('detail').textContent=sn?(s.clear||s.preset?'Den aktiva låga ingången styr Q direkt, oberoende av J, K̅ och CLK. Släpp kontrollen för vanlig klockning.':`Nästa ↑ ger ${names[op]}. Att hålla CLK hög eller ändra J/K̅ utan en ny uppåtflank ändrar inte Q. Två Toggle-pulser ger en hel period av Q.`):race?'Sätt J = K = 1 och lås CLK hög med knappen eller L. Nya Q och Q̅ återkopplas till ingångslogiken och utlöser nästa växling. Släpp CLK så stannar Q på det senast visade värdet.':[
    'När J = K = 0 behåller vippan sitt tidigare tillstånd. Båda latchingångarna är inaktiva (1).',
    'K = 1 begär Reset: vid pulsen blir Q = 0 och Q̅ = 1. Q återkopplas till K-sidan.',
    'J = 1 begär Set: vid pulsen blir Q = 1 och Q̅ = 0. Q̅ återkopplas till J-sidan.',
    'När J = K = 1 växlar Q en gång per puls i denna vy. Återkopplingen väljer vilken sida som aktiveras. Öppna Tävling för att se problemet med lång HIGH.'
  ][op];
  $('simplification').textContent=race?'Animationen är kraftigt nedslöad för att visa principen. Tidsdiagrammet är konceptuellt och inte tidsskalerat.':sn?'CLR̅ och PRE̅ har företräde framför klockan. Kombinationen båda aktiva demonstreras inte.':'Pedagogisk modell: en operation per puls. Interna nivåer är ögonblicksbilder; grindfördröjningar simuleras inte.';
  $('truthTitle').textContent=sn?'Sanningstabell · vid ↑, CLR̅ = PRE̅ = 1':'Sanningstabell · en pedagogisk klockpuls';
  $('truthHead').innerHTML=`<tr><th>J</th><th>${sn?'K̅':'K'}</th><th>Funktion</th><th>Q efter</th></tr>`;
  $('truthBody').innerHTML=[0,1,2,3].map(i=>{const j=i>>1,k=i%2,idx=j*2+(sn?1-k:k);return `<tr class="${s.j===j&&(sn?s.kBar:s.k)===k?'selected':''}"><td>${j}</td><td>${k}</td><td>${names[idx]}</td><td>${['Q (minne)','0','1','Q̅ (före)'][idx]}</td></tr>`;}).join('');
  drawHistory();
}
function drawHistory() {
  const svg=$('timing'),w=Math.max(320,svg.clientWidth),left=58,right=w-12,slot=(right-left)/Math.max(24,history.length),sn=state.mode==='sn';
  const rows=state.mode==='race'?[['CLK','clk'],['J','j'],['K','k'],['Q','q'],['Q̅','qBar']]:[['CLK','clk'],['J','j'],[sn?'K̅':'K',sn?'kBar':'k'],['Q','q'],['Q̅','qBar']];
  let out='';
  rows.forEach(([name,key],r)=>{const y=15+r*38;out+=`<text x="0" y="${y+12}" fill="#b7cad8" font-size="14">${name}</text><path d="M${left} ${y+18} H${right}" stroke="#24394b"/>`;
    history.forEach((s,i)=>{const x=left+i*slot,v=s[key],yy=y+(v?0:18),prev=history[i-1];out+=`<path d="M${x} ${yy} H${x+slot}" stroke="${v?'#ff3b30':'#8497ad'}" stroke-width="2.5"/>`;
      if(prev&&prev[key]!==v) out+=`<path d="M${x} ${y+(prev[key]?0:18)} V${yy}" stroke="#ff3b30" stroke-width="2"/>`;
      if(r===0&&s.clk&&prev&&!prev.clk&&sn) out+=`<text x="${x+3}" y="${y+32}" fill="#ffc471" font-size="13">↑</text>`;
    });
  });
  out+='<text x="0" y="217" fill="#a3b6c7" font-size="12">Steg</text>';
  history.forEach((s,i)=>{if(i%4===0)out+=`<text x="${left+i*slot}" y="217" fill="#a3b6c7" font-size="12">${s.step}</text>`;});
  svg.setAttribute('viewBox',`0 0 ${w} 225`);svg.innerHTML=out;
}
$('j').onclick=()=>setInput('j');$('k').onclick=()=>setInput(state.mode==='sn'?'kBar':'k');
$('advance').onclick=nextStep;
$('pulse').onclick=pulseClock;$('init').onclick=()=>reset();
$('auto').onclick=()=>{if(autoTimer){stopClocks();return;}stopClocks();autoTimer=setInterval(()=>setClock(1-state.clk),500);setClock(1);};
$('level').onclick=()=>setClock(1-state.clk);
$('clear').onclick=()=>setAsync('clear');$('preset').onclick=()=>setAsync('preset');
$('path').onchange=()=>{if($('path').checked)animatePath('input');else cancelPath();};
$('hold').onclick=()=>setClock(1-state.clk);
// Plain letter keys only. Never intercept browser/OS chords or text editing.
document.addEventListener('keydown',event=>{
  if(event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
  const target=event.target;
  if(target?.isContentEditable || target?.closest?.('textarea,select,input:not([type="checkbox"]):not([type="radio"]):not([type="button"])')) return;
  const key=event.key.toLowerCase();
  const controls={n:'advance',j:'j',k:'k',c:state.mode==='race'?null:'pulse',l:state.mode==='race'?'hold':state.mode==='sn'?'level':null,v:'path',a:'auto',r:'init',d:'clear',p:'preset',f:'full',t:'toggleTop',b:'toggleBottom'};
  if(['1','2','3'].includes(key)) {
    event.preventDefault();reset(['jk','race','sn'][Number(key)-1]);return;
  }
  const control=controls[key] && $(controls[key]);
  if(!control || control.disabled || control.hidden || (['d','p'].includes(key) && state.mode!=='sn')) return;
  event.preventDefault();control.click();
});
window.addEventListener('pagehide',stopClocks);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopClocks();});
 document.querySelectorAll('[data-mode]').forEach(n=>n.onclick=()=>reset(n.dataset.mode));
$('full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('fullscreenError').textContent='Helskärm stöds inte i detta webbläsarfönster.';}};
new ResizeObserver(drawHistory).observe($('timing'));
reset();
setupResizablePanels();

// Only labels built from our own fixed strings and binary state are inserted.
function buttonLabel(id,label,key) {
  $(id).innerHTML=`${label} <kbd>${key}</kbd>`;
}

// Fractional heights survive mode/viewport changes, but never exceed natural size.
function setupResizablePanels() {
  const panels=[['topPanel','toggleTop','T',1,.45],['bottomPanel','toggleBottom','B',-1,.32]].map(([id,toggleId,key,direction,viewportCap])=>({
    root:$(id),toggle:$(toggleId),key,direction,viewportCap,fraction:1,max:0,
    body:$(id).querySelector('.panel-body'),content:$(id).querySelector('.panel-content'),
    handle:$(id).querySelector('.drag-handle')
  }));
  function apply(panel) {
    const height=Math.round(panel.max*panel.fraction);
    panel.body.style.height=`${height}px`;
    panel.body.inert=height===0;
    panel.body.setAttribute('aria-hidden',height===0?'true':'false');
    panel.handle.setAttribute('aria-valuenow',Math.round(panel.fraction*100));
    panel.toggle.setAttribute('aria-expanded',height>0);
    buttonLabel(panel.toggle.id,height===0?'Visa':'Dölj',panel.key);
    const cssName=panel.direction===1?'--top-panel-height':'--bottom-panel-height';
    document.documentElement.style.setProperty(cssName,`${panel.root.getBoundingClientRect().height}px`);
  }
  function measure() {
    for(const panel of panels) {
      panel.max=Math.min(panel.content.getBoundingClientRect().height,window.innerHeight*panel.viewportCap);
      apply(panel);
    }
  }
  for(const panel of panels) {
    let drag=null;
    panel.toggle.onclick=()=>{panel.fraction=panel.fraction===0?1:0;apply(panel);};
    panel.handle.onpointerdown=event=>{
      if(event.button!==0)return;
      event.preventDefault();
      drag={y:event.clientY,height:panel.max*panel.fraction};
      panel.handle.setPointerCapture(event.pointerId);
    };
    panel.handle.onpointermove=event=>{
      if(!drag)return;
      const height=drag.height+(event.clientY-drag.y)*panel.direction;
      panel.fraction=Math.max(0,Math.min(1,height/Math.max(1,panel.max)));
      apply(panel);
    };
    panel.handle.onpointerup=panel.handle.onpointercancel=panel.handle.onlostpointercapture=()=>{drag=null;};
    // Standard keyboard behavior only when the separator itself is focused.
    panel.handle.onkeydown=event=>{
      if(!['ArrowUp','ArrowDown'].includes(event.key))return;
      event.preventDefault();
      panel.fraction=Math.max(0,Math.min(1,panel.fraction+(event.key==='ArrowDown'?1:-1)*panel.direction*.1));
      apply(panel);
    };
    new ResizeObserver(measure).observe(panel.content);
  }
  window.addEventListener('resize',measure);
  measure();
}

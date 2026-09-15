'use strict';
// One fixed-purpose teaching model. No propagation solver or simulation framework.
const $ = id => document.getElementById(id);
const initial = mode => ({mode, j:0, k:0, kBar:1, clk:0, q:0, clear:false, preset:false});
let state = initial('jk'), history = [], step = 0, pulseNumber = 0;
let autoTimer = null, pulseTimer = null, raceTimer = null, pathTimers = [];
let busy = false, holding = false, raceCount = 0;
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
  } else stopRace();
  commit();
  if(value && state.mode === 'race') startRace();
}
function startRace() {
  stopRace();
  if(state.clk && state.j && state.k) raceTimer = setInterval(()=>{
    state.q = 1-state.q; raceCount++; commit();
  },250);
}
function stopRace() { clearInterval(raceTimer); raceTimer = null; }
function cancelPath() {
  pathTimers.forEach(clearTimeout); pathTimers=[];
  document.querySelectorAll('.path-active').forEach(n=>n.classList.remove('path-active'));
  $('pathStep').textContent='';
}
function animatePath() {
  cancelPath();
  if(!$('path').checked || state.mode!=='jk') return;
  const op=operation(), upper=op===2 || (op===3 && state.q===1);
  const route=op===0 ? [['clk','CLK blir hög'],['latch','Båda latchingångarna förblir 1 → minne']] :
    [[upper?'j':'k',upper?'J aktiverar övre vägen':'K aktiverar nedre vägen'],[upper?'upper':'lower','Tre NAND bildar en 3-ingångars NAND'],['latch','Latchens lagrade tillstånd ändras'],['q','Q visas'],['qBar','Q̅ är motsatsen'],['feedback','Det nya tillståndet återkopplas']];
  route.forEach(([group,label],i)=>pathTimers.push(setTimeout(()=>{
    document.querySelectorAll('.path-active').forEach(n=>n.classList.remove('path-active'));
    document.querySelectorAll(`[data-stage="${group}"]`).forEach(n=>n.classList.add('path-active'));
    $('pathStep').textContent=label;
  },i*120)));
  pathTimers.push(setTimeout(cancelPath,route.length*120+200));
}
function stopClocks() {
  clearInterval(autoTimer); clearTimeout(pulseTimer); autoTimer=pulseTimer=null;
  busy=false; holding=false; stopRace(); cancelPath();
  if(state.clk) setClock(0); else render();
}
function pulseClock() {
  if(busy || autoTimer) return;
  if(state.clk) setClock(0);
  busy=true; setClock(1);
  pulseTimer=setTimeout(()=>{setClock(0);pulseTimer=setTimeout(()=>{busy=false;pulseTimer=null;render();},500);},500);
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
  commit();
}
function setAsync(key) {
  state[key]=!state[key];
  if(state[key]) {state[key==='clear'?'preset':'clear']=false;state.q=key==='clear'?0:1;}
  commit();
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
  text(440,113,'J · CLK · Q̅ → 3-ingångars NAND','svg-label','middle');
  text(440,397,'K · CLK · Q → 3-ingångars NAND','svg-label','middle');
  // Upper: NAND(J,CLK), tied-input inverter, NAND(AND(J,CLK),Qbar).
  wire('M50 144 H200','j');wire('M50 334 H200','k');
  wire('M55 250 H150 V176 H200','clk');wire('M150 250 V366 H200','clk');dot(150,250,'clk');
  for(const [y,p,id,stage] of [[160,'u',1,'upper'],[350,'l',4,'lower']]) {
    wire(`M280 ${y} H315 V${y-16} H360`,p+'1',stage);
    wire(`M315 ${y} V${y+16} H360`,p+'1',stage);dot(315,y,p+'1');
    wire(`M440 ${y} H495 V${y-16} H560`,p+'2',stage);
    wire(`M640 ${y} H810 V${y-16} H850`,p+'3',stage);
    gate(200,y,'N'+id,stage);gate(360,y,'N'+(id+1),stage);gate(560,y,'N'+(id+2),stage);
    gate(850,y,y===160?'N7':'N8','latch');
    value(723,y-26,y===160?'S̅':'R̅',p+'3');
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
  value(1125,138,'Q','q');value(1125,381,'Q̅','qBar');
  text(440,480,'2 kapslar 7400 · 4 NAND per kapsel','svg-label','middle');
  return out.join('');
}
function icMarkup() {
  const {out,wire,text,value}=markupHelpers();
  out.push('<rect x="460" y="80" width="390" height="330" rx="12" class="gate-shape"/>');
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
  $('kCaption').textContent=sn?'INVERTERAD INGÅNG K̅':'INGÅNG K';
  $('pulse').hidden=race;$('auto').hidden=race;$('hold').hidden=!race;$('level').hidden=!sn;$('async').hidden=!sn;$('raceInfo').hidden=!race;
  $('pulse').disabled=busy||!!autoTimer;$('level').disabled=busy||!!autoTimer;
  $('auto').textContent=autoTimer?'Ⅱ Stoppa klockan · 1 Hz':'▶ Automatisk klocka · 1 Hz';$('auto').setAttribute('aria-pressed',!!autoTimer);
  $('hold').setAttribute('aria-pressed',!!state.clk);$('level').textContent=`CLK = ${state.clk} · växla nivå`;
  $('clockHint').textContent=race?'Håll med mus/touch eller mellanslag. Alternativ: Enter låser/lossar CLK.':'Visuell klocka: 0,5 s hög + 0,5 s låg · labben använder 1 kHz';
  for(const [id,key,label] of [['clear','clear','CLR̅'],['preset','preset','PRE̅']]) {
    $(id).textContent=`${label} = ${state[key]?0:1} · ${state[key]?'aktiv':'inaktiv'}`;$(id).setAttribute('aria-pressed',state[key]);
    $(id).disabled=state[key==='clear'?'preset':'clear'];
  }
  $('circuitTitle').textContent=sn?'Färdig JK · positivt flankstyrd':race?'Visuell demonstration · åtta NAND · 250 ms per växling':'Egenbyggd JK · åtta 2-ingångars NAND';
  $('circuit').setAttribute('aria-label',sn?'SN74LS109AN med J, inverterad K, klocka, utgångar och asynkrona kontroller':'Åtta NAND-grindar. Q-streck återkopplas till J-sidan, Q till K-sidan.');
  $('path').disabled=sn||race;
  $('circuit').querySelectorAll('[data-signal]').forEach(n=>{const v=s[n.dataset.signal];n.dataset.v=v;if(n.classList.contains('signal-value')) n.textContent=v;});
  $('outputs').textContent=`Q = ${s.q} · Q̅ = ${s.qBar}`;$('clockState').textContent=`CLK = ${s.clk} · ${s.clk?'HIGH':'LOW'}`;
  const op=operation();
  $('status').textContent=sn&&(s.clear||s.preset)?`${s.clear?'CLR̅ → Reset':'PRE̅ → Set'} · asynkront`:race&&s.clk&&s.j&&s.k?`Tävling · Q återkopplas och växlar igen (${raceCount} upprepningar)`:names[op];
  $('detail').textContent=sn?(s.clear||s.preset?'Den aktiva låga ingången styr Q direkt, oberoende av J, K̅ och CLK. Släpp kontrollen för vanlig klockning.':`Nästa ↑ ger ${names[op]}. Att hålla CLK hög eller ändra J/K̅ utan en ny uppåtflank ändrar inte Q. Två Toggle-pulser ger en hel period av Q.`):race?'Sätt J = K = 1 och håll CLK hög. Nya Q och Q̅ återkopplas till ingångslogiken och utlöser nästa växling. Släpp CLK så stannar Q på det senast visade värdet.':[
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
    history.forEach((s,i)=>{const x=left+i*slot,v=s[key],yy=y+(v?0:18),prev=history[i-1];out+=`<path d="M${x} ${yy} H${x+slot}" stroke="${v?'#56dded':'#8497ad'}" stroke-width="2.5"/>`;
      if(prev&&prev[key]!==v) out+=`<path d="M${x} ${y+(prev[key]?0:18)} V${yy}" stroke="#56dded" stroke-width="2"/>`;
      if(r===0&&s.clk&&prev&&!prev.clk&&sn) out+=`<text x="${x+3}" y="${y+32}" fill="#ffc471" font-size="13">↑</text>`;
    });
  });
  out+='<text x="0" y="217" fill="#a3b6c7" font-size="12">Steg</text>';
  history.forEach((s,i)=>{if(i%4===0)out+=`<text x="${left+i*slot}" y="217" fill="#a3b6c7" font-size="12">${s.step}</text>`;});
  svg.setAttribute('viewBox',`0 0 ${w} 225`);svg.innerHTML=out;
}
$('j').onclick=()=>setInput('j');$('k').onclick=()=>setInput(state.mode==='sn'?'kBar':'k');
$('pulse').onclick=pulseClock;$('init').onclick=()=>reset();
$('auto').onclick=()=>{if(autoTimer){stopClocks();return;}stopClocks();autoTimer=setInterval(()=>setClock(1-state.clk),500);setClock(1);};
$('level').onclick=()=>setClock(1-state.clk);
$('clear').onclick=()=>setAsync('clear');$('preset').onclick=()=>setAsync('preset');
$('path').onchange=()=>{if(!$('path').checked)cancelPath();};
function releaseHold() {if(holding){holding=false;setClock(0);}}
$('hold').onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();holding=true;$('hold').setPointerCapture(e.pointerId);setClock(1);};
$('hold').onpointerup=releaseHold;$('hold').onpointercancel=releaseHold;$('hold').onlostpointercapture=releaseHold;
$('hold').onkeydown=e=>{if(e.code==='Space'){e.preventDefault();if(!e.repeat){holding=true;setClock(1);}}else if(e.code==='Enter'){e.preventDefault();if(!e.repeat){holding=!state.clk;setClock(1-state.clk);}}};
$('hold').onkeyup=e=>{if(e.code==='Space'){e.preventDefault();releaseHold();}};
$('hold').onblur=releaseHold;
window.addEventListener('blur',()=>{if(state.mode==='race')releaseHold();});
window.addEventListener('pagehide',stopClocks);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopClocks();});
 document.querySelectorAll('[data-mode]').forEach(n=>n.onclick=()=>reset(n.dataset.mode));
$('full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('fullscreenError').textContent='Helskärm stöds inte i detta webbläsarfönster.';}};
new ResizeObserver(drawHistory).observe($('timing'));
reset();

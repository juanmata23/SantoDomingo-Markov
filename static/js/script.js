let states=[],routes=[],profiles=[],labels=[],count=[],P=[],model=null,simulation=[],summary=null,critical=null,charts={},lastSettings=null,analysis=null,busy=false;
const palette=["#d4af37","#8b3030","#c7793b","#8968ae","#777"];
const $=id=>document.getElementById(id);
const fmt=n=>Number(n).toLocaleString("es-CO");
const pct=n=>Number(n).toFixed(2)+"%";
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pathText=path=>path.map(x=>"S"+x).join(" → ");
function tag(result){
 const type=result==="Inicial"?"inicial":result==="Intermedio"?"intermedio":
 result==="Final exitoso"||result==="Éxito"?"exito":
 result==="Final negativo"||result==="Abandono"?"abandono":
 result==="Error"?"error":result==="Sin finalizar"?"intermedio":"pendiente";
 return `<span class="tag ${type}">${esc(result)}</span>`;
}
function showTab(tab){
 document.querySelectorAll(".section").forEach(el=>el.classList.toggle("active",el.id===tab));
 document.querySelectorAll(".nav button").forEach(el=>el.classList.toggle("active",el.dataset.tab===tab));
 requestAnimationFrame(()=>Object.values(charts).forEach(c=>c.resize()));
 window.scrollTo({top:330,behavior:"smooth"});
}
document.querySelectorAll(".nav button").forEach(b=>b.addEventListener("click",()=>showTab(b.dataset.tab)));
$("steps").oninput=e=>$("stepsLabel").textContent=e.target.value;
$("improvement").oninput=e=>$("improveLabel").textContent=e.target.value+"%";

function renderStates(){
 const q=$("stateSearch").value.toLowerCase(),type=$("stateType").value;
 $("statesBody").innerHTML=states.filter(s=>
  (!type||s.type===type)&&(`${s.id} ${s.name} ${s.description}`.toLowerCase().includes(q))
 ).map(s=>`<tr><td style="color:var(--gold)">${s.id}</td><td>${esc(s.name)}</td><td class="muted" style="white-space:normal;min-width:260px">${esc(s.description)}</td><td>${tag(s.type)}</td></tr>`).join("");
}
function renderRoutes(){
 const profile=$("profileFilter").value,result=$("resultFilter").value;
 $("routesBody").innerHTML=routes.filter(r=>
  (!profile||r.profile===profile)&&(!result||r.result===result)
 ).map(r=>`<tr><td style="color:var(--gold)">${r.id}</td><td>${esc(r.profile)}</td><td class="route">${pathText(r.path)}</td><td>${tag(r.result)}</td><td>${r.path.length-1}</td></tr>`).join("");
}
function heatmap(matrix,isProbability){
 const max=isProbability?1:Math.max(...matrix.flat());
 let out="<table><thead><tr><th>↓ / →</th>"+states.map(s=>`<th>${s.id}</th>`).join("")+"</tr></thead><tbody>";
 for(let i=0;i<states.length;i++){
  out+=`<tr><th>S${i}</th>`;
  for(let j=0;j<states.length;j++){
   const value=matrix[i][j],intensity=value/(max||1);
   const background=`rgba(212,175,55,${.025+intensity*.88})`;
   const text=intensity>.6?"#121212":"#e4d6bc";
   out+=`<td title="S${i} → S${j}: ${isProbability?pct(value*100):value}" style="background:${background};color:${text}">${isProbability?value.toFixed(2):value}</td>`;
  }
  out+="</tr>";
 }
 return out+"</tbody></table>";
}
function renderTransitions(){
 const index=Number($("originSelect").value);
 const options=P[index].map((v,j)=>({v,j})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v);
 $("transitions").innerHTML=options.map(x=>`
 <div class="statline"><span>S${index} → S${x.j} · ${esc(states[x.j].name)}</span><strong>${pct(x.v*100)}</strong></div>
 <div class="progress" style="margin:0 0 15px"><span style="width:${x.v*100}%"></span></div>
 `).join("");
}
function chart(id,type,data,options={}){
 if(typeof Chart==="undefined"){ $(id).parentElement.setAttribute("aria-label","Chart.js no disponible"); return; }
 if(charts[id])charts[id].destroy();
 charts[id]=new Chart($(id),{
  type,data,
  options:{
   responsive:true,maintainAspectRatio:false,resizeDelay:150,animation:{duration:350},
   plugins:{legend:{labels:{color:"#d0c0a5",font:{family:"DM Sans"}}}},
   scales:type==="doughnut"?{}:{
    x:{ticks:{color:"#b1a797"},grid:{color:"#ffffff12"}},
    y:{beginAtZero:true,max:100,ticks:{color:"#b1a797",callback:v=>v+"%"},grid:{color:"#ffffff12"}}
   },
   ...options
  }
 });
}
function updateDashboard(){
 const s=summary;
 const icons=["fa-crown","fa-door-open","fa-triangle-exclamation","fa-hourglass-half","fa-clock","fa-shoe-prints"];
 const values=[...labels.map(k=>pct(s.percent[k])),s.avg.toFixed(2)];
 const names=[...labels,"Promedio de pasos"];
 $("kpis").innerHTML=names.map((name,i)=>`
 <div class="panel kpi"><i class="fa-solid ${icons[i]||"fa-shoe-prints"}"></i>
 <div class="value">${values[i]}</div><div class="label">${name}</div><div class="stripe"></div></div>
 `).join("");
 $("criticalShort").textContent=critical.index===null?"Ninguno":"S"+critical.index;
 const data=labels.map(k=>s.counts[k]);
 chart("donut","doughnut",{
  labels,datasets:[{data,backgroundColor:palette,borderColor:"#1e1b18",borderWidth:4}]
 },{cutout:"70%"});
 chart("bars","bar",{
  labels,datasets:[{label:"Usuarios (%)",data:labels.map(k=>s.percent[k]),backgroundColor:palette,borderRadius:5}]
 },{plugins:{legend:{display:false}}});
}
function renderFeed(){
 $("feed").innerHTML=simulation.slice(-25).reverse().map(r=>`
 <article class="feed-item"><header><strong style="color:var(--gold)">VISITANTE #${r.id}</strong>${tag(r.result)}</header>
 <div class="route">${pathText(r.path)}</div><div class="muted" style="font-size:11px;margin-top:6px">${r.steps} pasos</div></article>
 `).join("");
}
function downloadSimulation(){
 if(!summary||!simulation.length){alert("Primero ejecuta una simulación.");return;}
 const rows=[["Usuario","Recorrido","Estado final","Resultado","Pasos"],
 ...simulation.map(r=>[r.id,pathText(r.path),"S"+r.path.at(-1),r.result,r.steps])];
 const csv=rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(",")).join("\r\n");
 const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="simulacion_santo_domingo.csv";a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}


async function api(url,body){const r=await fetch(url,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok){let msg;try{msg=(await r.json()).error}catch{}throw Error(msg||`HTTP ${r.status}`)}return r.json()}
function renderMatrices(){const k=$("matrixProfile").value;count=model.counts[k];P=model.probabilities[k];$("countHeat").innerHTML=heatmap(count,false);$("probHeat").innerHTML=heatmap(P,true);renderTransitions()}
function table(head,rows){return '<div class="table-wrap"><table><thead><tr>'+head.map(x=>`<th>${esc(x)}</th>`).join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>`<td>${esc(x)}</td>`).join('')+'</tr>').join('')+'</tbody></table></div>'}
function updateMonitor(){for(const [id,k] of Object.entries({successCount:'Éxito',abandonCount:'Abandono',errorCount:'Error',pendingCount:'Seguimiento pendiente',unfinishedCount:'Sin finalizar'}))$(id).textContent=fmt(summary.counts[k]);$('processed').textContent=fmt(summary.total)}
function renderDiagnosis(){const i=critical.index; $('criticalName').textContent=i===null?'Sin abandonos':`S${i} · ${states[i].name}`; $('criticalInfo').textContent=`${critical.amount} abandonos directos. ${analysis.recommendation}`; $('beforeSuccess').textContent=pct(summary.percent['Éxito']);$('criticalRanking').innerHTML=table(['Estado','Abandonos','Tasa por salida'],critical.ranking.map(r=>[`S${r.index} · ${states[r.index].name}`,r.amount,pct(100*r.rate)])); const max=Math.max(...Object.values(summary.counts)); const top=labels.filter(k=>summary.counts[k]===max).join(', ');$('answers').innerHTML=[`Resultado más frecuente: ${top}.`,i===null?'Sin abandonos directos.':`Mayor pérdida: S${i}.`,i===null?'No hay estado crítico por abandono.':`Estado crítico: S${i}, con ${critical.amount} abandonos directos.`,analysis.recommendation,'La intervención reduce la probabilidad local de abandono si existen salidas alternativas.','Ejecuta la comparación para conocer los cambios.'].map((x,j)=>`<p><strong>${j+1}.</strong> ${esc(x)}</p>`).join('');}
async function runSimulation(){if(busy||!model)return;const n=Number($('users').value),steps=Number($('steps').value),seed=Number($('seed').value);const weights=profiles.map((_,i)=>Number($('weight'+i).value));if(weights.some(w=>!Number.isFinite(w)||w<0)||Math.abs(weights.reduce((a,b)=>a+b,0)-100)>1e-6){$('status').textContent='Los porcentajes deben sumar 100.';return}const settings={n,steps,seed,distribution:weights.every(w=>Math.abs(w-100/3)<.00001)?null:Object.fromEntries(profiles.map((p,i)=>[p,weights[i]/100]))};busy=true;$('runButton').disabled=true;$('status').textContent='Python está procesando los visitantes…';$('progress').style.width='0%';try{const res=await api('/api/simulate',settings);analysis=res;simulation=res.users;summary=res.summary;critical=res.critical;lastSettings=settings;$('comparisonTable').innerHTML='';$('transitionChange').innerHTML='';$('afterSuccess').textContent='—';if(charts.compareChart){charts.compareChart.destroy();delete charts.compareChart}updateMonitor();updateDashboard();renderFeed();renderDiagnosis();$('profileResults').innerHTML=table(['Perfil','Usuarios',...labels,'Pasos promedio'],profiles.map(p=>[p,res.byProfile[p].total,...labels.map(k=>pct(res.byProfile[p].percent[k])),res.byProfile[p].avg.toFixed(2)]));$('topRoutes').innerHTML=table(['Recorrido','Usuarios'],res.topRoutes.map(r=>[pathText(r.path),r.count]));$('progress').style.width='100%';$('status').textContent=`Simulación terminada: ${fmt(n)} visitantes · ${res.uniqueRoutes} rutas distintas.`}catch(e){$('status').textContent='Error: '+e.message}finally{busy=false;$('runButton').disabled=false}}
async function runImprovement(){if(busy||!lastSettings||critical.index===null)return;busy=true;$('runButton').disabled=true;const reduction=Number($('improvement').value)/100;try{const r=await api('/api/improve',{...lastSettings,reduction});const before=r.before.summary.percent,after=r.after.summary.percent;$('afterSuccess').textContent=pct(after['Éxito']);chart('compareChart','bar',{labels,datasets:[{label:'Antes',data:labels.map(k=>before[k]),backgroundColor:'#735728'},{label:'Después',data:labels.map(k=>after[k]),backgroundColor:'#d4af37'}]});$('comparisonTable').innerHTML=table(['Resultado','Antes','Después','Diferencia'],labels.map(k=>[k,pct(before[k]),pct(after[k]),(after[k]-before[k]).toFixed(2)+' p.p.']));$('transitionChange').innerHTML=table(['Matriz','P(abandono) antes','Después'],Object.entries(r.transitions).map(([k,v])=>[k,pct(v.before*100),pct(v.after*100)]));$('answers').querySelector('#comparisonAnswer')?.remove();$('answers').insertAdjacentHTML('beforeend',`<p id="comparisonAnswer">Comparación: ${labels.map(k=>esc(k)+': '+pct(before[k])+' → '+pct(after[k])).join('; ')}.</p>`)}catch(e){$('comparisonTable').textContent='Error: '+e.message}finally{busy=false;$('runButton').disabled=false}}
async function init(){try{model=await api('/api/model');({states,routes,profiles,labels}=model);$('countStates').textContent=states.length;$('countRoutes').textContent=routes.length;$('profileFilter').innerHTML+=profiles.map(p=>`<option>${esc(p)}</option>`).join('');$('matrixProfile').innerHTML=Object.keys(model.counts).map(p=>`<option>${esc(p)}</option>`).join('');$('matrixProfile').value='General';$('originSelect').innerHTML=states.map((s,i)=>`<option value="${i}">${s.id} · ${esc(s.name)}</option>`).join('');$('profileWeights').innerHTML=profiles.map((p,i)=>`<div class="control"><label>${esc(p)} (%)</label><input id="weight${i}" type="number" min="0" max="100" step="any" value="${[33.333333,33.333333,33.333334][i]}"></div>`).join('');renderStates();renderRoutes();renderMatrices();await runSimulation()}catch(e){$('status').textContent='Error de conexión: '+e.message;alert(e.message)}}
init();

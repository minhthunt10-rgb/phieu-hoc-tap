/* ================= BÁO CÁO THÁNG =================
   Đọc dữ liệu chung trên Google Sheet (qua sync.js): HS, phiếu từng buổi, bài khảo từ,
   điểm kiểm tra, nhận xét tháng → giám sát cả lớp + phiếu báo cáo tháng gửi phụ huynh. */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const KEY='gwe-bao-cao-v1';
let db={students:[],sessions:[],tests:[],checks:[],reports:[],cfg:{}};
try{const s=localStorage.getItem(KEY);if(s)db={...db,...JSON.parse(s)};}catch(e){}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(db));}catch(e){}}
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const dmy=iso=>{if(!iso)return['','',''];const[y,m,d]=iso.split('-');return[d,m,y];};
const two=n=>String(n).padStart(2,'0');
function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('on');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('on'),2600);}
const stu=id=>db.students.find(s=>s.id===id);
const khoi=s=>{const m=String(s.cls||'').match(/\d+/);return m?+m[0]:99;};
const tenRieng=n=>n.trim().split(/\s+/).pop();
const byKhoi=(a,b)=>khoi(a)-khoi(b)||tenRieng(a.name).localeCompare(tenRieng(b.name),'vi')||a.name.localeCompare(b.name,'vi');
const boDau=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[đĐ]/g,'d').toLowerCase().replace(/\s+/g,' ').trim();
const khop=(s,q)=>{const t=boDau(s.name+' '+(s.cls||''));return q.split(' ').every(w=>t.includes(w))||t.replace(/ /g,'').includes(q.replace(/ /g,''));};
const THU=['CN','T2','T3','T4','T5','T6','T7'];
const thu=iso=>{const[y,m,d]=iso.split('-').map(Number);return THU[new Date(y,m-1,d).getDay()];};
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1500);}
const fileSafe=n=>n.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').replace(/\s+/g,'_');

const month=()=>$('#gMonth').value||today().slice(0,7);
const active=()=>db.students.filter(s=>!s.deleted);

/* ---------- Tổng hợp 1 HS trong 1 tháng ---------- */
function summary(s,mon){
  const ss=db.sessions.filter(x=>x.studentId===s.id&&String(x.fDate||'').startsWith(mon)).sort((a,b)=>a.fDate.localeCompare(b.fDate)||String(a.created).localeCompare(String(b.created)));
  // 1 ngày tính 1 buổi (lỡ lưu 2 phiếu cùng ngày)
  const byDate={};ss.forEach(x=>byDate[x.fDate]=x);const days=Object.keys(byDate).sort();const sess=days.map(d=>byDate[d]);
  const hwS=sess.filter(x=>x.hw!=='none'&&x.fPct!==''&&x.fPct!=null&&!isNaN(+x.fPct));
  const hwAvg=hwS.length?Math.round(hwS.reduce((a,x)=>a+(+x.fPct),0)/hwS.length):null;
  const ts=db.tests.filter(x=>x.studentId===s.id&&String(x.date||'').startsWith(mon));
  let words=0,asked=0,nTests=ts.length;
  if(ts.length){ts.forEach(t=>{words+=+t.score||0;asked+=+t.n||0;});}
  else sess.forEach(x=>{if(x.fVScore!==''&&x.fVScore!=null&&!isNaN(+x.fVScore)){words+=+x.fVScore;asked+=+x.fVNum||0;nTests++;}});
  const att={tot:0,kha:0,cct:0};sess.forEach(x=>{if(att[x.att]!=null)att[x.att]++;});
  const checks=db.checks.filter(x=>x.studentId===s.id&&String(x.date||'').startsWith(mon));
  // điểm kiểm tra định kỳ cô nhập ngay trên phiếu buổi học (trang Phiếu học tập)
  ss.forEach(x=>{if(x.fKtScore===''||x.fKtScore==null)return;const name=x.fKtName||'Kiểm tra định kỳ';
    if(checks.some(c=>c.date===x.fDate&&String(c.name).trim().toLowerCase()===name.toLowerCase()))return;
    checks.push({date:x.fDate,name,score:x.fKtScore,max:x.fKtMax||10,note:x.fKtCmt||''});});
  checks.sort((a,b)=>a.date.localeCompare(b.date));
  const rep=db.reports.find(x=>x.id===s.id+'_'+mon);
  // buổi ghi "5+6" = học 2 ca trong 1 buổi → tính 2 buổi
  const caList=sess.flatMap(x=>Array(Math.max(1,String(x.fNo||"").split("+").filter(p=>/\d/.test(p)).length)).fill(x));
  return {sess,caList,nCa:caList.length,days,hwS,hwAvg,words,asked,nTests,att,checks,cmt:rep?rep.cmt:'',total:+s.total||12};
}
// trung bình mỗi lần khảo: "TB 21/30 (70%)"
const tbTu=m=>{const n=m.nTests||1,r=x=>Math.round(x*10)/10;return `TB ${r(m.words/n)}/${r(m.asked/n)} (${Math.round(m.words/m.asked*100)}%)`;};
const attTop=a=>{const n=a.tot+a.kha+a.cct;if(!n)return null;return a.cct>=a.tot&&a.cct>=a.kha?'Cần cải thiện':a.kha>a.tot?'Khá':'Tốt';};

/* ---------- Chọn tháng / lớp ---------- */
function fillCls(){
  const v=$('#gCls').value, cls=[...new Set(active().map(s=>String(s.cls||'').trim()).filter(Boolean))]
    .sort((a,b)=>khoi({cls:a})-khoi({cls:b})||a.localeCompare(b,'vi'));
  const ks=[...new Set(active().map(khoi))].filter(k=>k<99).sort((a,b)=>a-b);
  $('#gCls').innerHTML='<option value="">Tất cả</option>'+ks.map(k=>`<option value="k${k}">Khối ${k}</option>`).join('')
    +cls.filter(c=>!/^(khối\s*)?\d+$/i.test(c)).map(c=>`<option value="c${esc(c)}">Lớp ${esc(c)}</option>`).join('');
  if([...$('#gCls').options].some(o=>o.value===v))$('#gCls').value=v;
}
const inCls=s=>{const v=$('#gCls').value;if(!v)return true;if(v[0]==='k')return khoi(s)===+v.slice(1);return String(s.cls||'').trim()===v.slice(1);};
const listed=()=>active().filter(inCls).sort(byKhoi);

/* ---------- Tabs ---------- */
let tab='gs';
$$('nav.tabs button').forEach(b=>b.onclick=()=>{tab=b.dataset.v;
  $$('nav.tabs button').forEach(x=>x.classList.toggle('on',x===b));
  $$('.view').forEach(v=>v.classList.toggle('on',v.id==='v-'+tab));renderAll();});
function renderAll(){fillCls();if(tab==='gs')renderGS();if(tab==='kt')renderKT();if(tab==='pt')renderPT();}
// đổi tháng: nhận xét đang gõ dở được lưu vào tháng cũ trước
let lastMon='';
$('#gMonth').onchange=()=>{if(cmtDirty&&lastMon){const m=$('#gMonth').value;$('#gMonth').value=lastMon;saveCmt(true);$('#gMonth').value=m;}
  lastMon=month();cmtDirty=false;renderAll();};
$('#gCls').onchange=renderAll;

/* ---------- 1. Giám sát ---------- */
function renderGS(){
  const mon=month(),list=listed(),cur=mon===today().slice(0,7);
  let warnN=0;
  const rows=list.map((s,i)=>{const m=summary(s,mon),f=[];
    if(m.hwAvg!=null&&m.hwAvg<80)f.push('BTVN thấp');
    if(m.asked&&m.words/m.asked<.7)f.push('Khảo từ yếu');
    if(m.sess.length&&!m.checks.length)f.push('Chưa có điểm KT');
    if(cur&&m.days.length){const last=new Date(m.days[m.days.length-1]);if((Date.now()-last)/864e5>10)f.push('10 ngày chưa học');}
    if(!m.sess.length)f.push('Chưa có buổi nào');
    if(f.length)warnN++;
    const ck=m.checks[m.checks.length-1];
    return `<tr class="st" data-id="${s.id}"><td>${i+1}</td><td><b>${esc(s.name)}</b><div class="hint">${esc(s.cls)}</div>${f.map(x=>`<span class="flag">${x}</span>`).join('')}</td>
      <td class="num"><b>${m.nCa}</b>/${m.total}</td>
      <td class="num ${m.hwAvg!=null&&m.hwAvg<80?'warn':''}">${m.hwAvg==null?'—':m.hwAvg+'%'}</td>
      <td class="num ${m.asked&&m.words/m.asked<.7?'warn':''}">${m.asked?`${m.words}/${m.asked}<div class="hint">${tbTu(m)}</div>`:'—'}</td>
      <td class="num">${ck?`${esc(ck.score)}/${esc(ck.max)}`:'—'}${m.checks.length>1?`<div class="hint">${m.checks.length} bài</div>`:''}</td>
      <td class="num">${m.cmt?'<span class="good">✓</span>':'—'}</td></tr>`;}).join('');
  $('#gsCount').textContent=`${list.length} HS · ${warnN} em cần chú ý`;
  $('#gsTable').innerHTML='<tr><th>#</th><th>Học sinh</th><th class="num">Đã học</th><th class="num">BTVN TB</th><th class="num">Từ thuộc</th><th class="num">Điểm KT gần nhất</th><th class="num">Nhận xét</th></tr>'
    +(rows||'<tr><td colspan="7" class="hint">Chưa có học sinh (đợi đồng bộ từ Sheet chung, hoặc thêm HS ở trang Phiếu học tập).</td></tr>');
  $$('#gsTable tr.st').forEach(tr=>tr.onclick=()=>{ptSid=tr.dataset.id;$('#pFind').value='';$('nav.tabs button[data-v=pt]').click();});
}

/* ---------- 2. Điểm kiểm tra ---------- */
const C_CHIPS=['Kiểm tra 2 tuần – Unit …','Kiểm tra tháng','Kiểm tra 15 phút','Kiểm tra giữa kỳ','Kiểm tra cuối kỳ','Thi thử'];
$('#cChips').innerHTML=C_CHIPS.map(t=>`<button type="button">${esc(t)}</button>`).join('');
$$('#cChips button').forEach(b=>b.onclick=()=>{const t=$('#cName');t.value=b.textContent;t.focus();const i=t.value.indexOf('…');if(i>=0)t.setSelectionRange(i,i+1);renderKT();});
$('#cDate').value=today();
['cDate','cName'].forEach(id=>$('#'+id).addEventListener('change',renderKT));
const sameCheck=(sid)=>db.checks.find(x=>x.studentId===sid&&x.date===$('#cDate').value&&x.name.trim().toLowerCase()===$('#cName').value.trim().toLowerCase());
function renderKT(){
  const list=listed();
  $('#cList').innerHTML=list.length?'<div class="kt-row hint"><span>Học sinh</span><span>Điểm</span><span>Nhận xét (nếu có)</span></div>'+list.map(s=>{const c=sameCheck(s.id);
    return `<div class="kt-row" data-id="${s.id}"><b>${esc(s.name)} <span class="hint">${esc(s.cls)}</span></b>
      <input type="number" step="0.25" min="0" class="sc" value="${c?esc(c.score):''}" inputmode="decimal">
      <input type="text" class="nt" value="${c?esc(c.note||''):''}"></div>`;}).join(''):'<p class="hint">Chưa có học sinh ở lớp này.</p>';
  const ins=$$('#cList .sc');ins.forEach((inp,i)=>inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();(ins[i+1]||$('#cSave')).focus();}}));
  const mon=month(), grp={};
  db.checks.filter(x=>String(x.date).startsWith(mon)&&stu(x.studentId)&&inCls(stu(x.studentId))).forEach(x=>{const k=x.date+'|'+x.name;(grp[k]=grp[k]||[]).push(x);});
  const keys=Object.keys(grp).sort().reverse();
  $('#cHist').innerHTML=keys.length?'<tr><th>Ngày</th><th>Bài kiểm tra</th><th>Số HS</th><th>Điểm TB</th><th></th></tr>'+keys.map(k=>{const g=grp[k],[d,m]=dmy(g[0].date);
    const avg=(g.reduce((a,x)=>a+(+x.score/(+x.max||10))*10,0)/g.length).toFixed(1);
    return `<tr><td>${d}/${m}</td><td>${esc(g[0].name)}</td><td>${g.length}</td><td>${avg}/10</td><td><button class="btn g" data-k="${esc(k)}" style="padding:5px 9px">Mở</button></td></tr>`;}).join('')
    :'<tr><td class="hint">Chưa có bài kiểm tra nào trong tháng.</td></tr>';
  $$('#cHist button').forEach(b=>b.onclick=()=>{const g=grp[b.dataset.k][0];$('#cDate').value=g.date;$('#cName').value=g.name;$('#cMax').value=g.max||10;renderKT();window.scrollTo({top:0,behavior:'smooth'});});
}
$('#cSave').onclick=()=>{
  const date=$('#cDate').value,name=$('#cName').value.trim(),max=+$('#cMax').value||10;
  if(!date){toast('Chọn ngày kiểm tra');return;} if(!name||name.includes('…')){toast('Gõ tên bài kiểm tra (thay chỗ "…")');return;}
  let n=0,del=0,bad=0;
  $$('#cList .kt-row[data-id]').forEach(r=>{const sid=r.dataset.id,v=r.querySelector('.sc').value.trim(),note=r.querySelector('.nt').value.trim(),old=sameCheck(sid);
    if(v===''){if(old){SYNC.remove('checks',old.id);db.checks=db.checks.filter(x=>x!==old);del++;}return;}
    if(+v<0||+v>max){bad++;return;}
    const c=old||{id:uid(),studentId:sid};Object.assign(c,{date,name,score:+v,max,note});
    if(!old)db.checks.push(c);SYNC.touch('checks',c);n++;});
  persist();renderKT();
  toast(bad?`⚠️ ${bad} điểm lớn hơn thang ${max} – chưa lưu các ô đó`:`Đã lưu điểm ${n} HS`+(del?`, xoá ${del}`:''));
};

/* ---------- 3. Phiếu tháng ---------- */
let ptSid='';
const P_CHIPS=['Tháng này con đi học đều, hoàn thành tốt bài tập về nhà.','Con tiến bộ rõ ở phần từ vựng, thuộc bài nhanh hơn tháng trước.',
  'Con nắm chắc ngữ pháp đã học, làm bài cẩn thận.','Con cần dành thêm thời gian học thuộc từ vựng ở nhà.','Con cần làm BTVN đầy đủ hơn, PH nhắc con giúp cô ạ.',
  'Điểm kiểm tra của con ổn định, tiếp tục phát huy nhé!','Tháng sau con tập trung ôn …','Con nghỉ … buổi, PH sắp xếp cho con học bù giúp cô ạ.'];
$('#pChips').innerHTML=P_CHIPS.map(t=>`<button type="button">${esc(t)}</button>`).join('');
$$('#pChips button').forEach(b=>b.onclick=()=>{const t=$('#pCmt');const st=t.value?t.value.length+1:0;t.value=t.value?t.value+'\n'+b.textContent:b.textContent;
  const i=t.value.indexOf('…',st);t.focus();if(i>=0)t.setSelectionRange(i,i+1);cmtDirty=true;drawPT();});
let cmtDirty=false;
$('#pCmt').addEventListener('input',()=>{cmtDirty=true;drawPT();});
function fillPT(){
  const q=boDau($('#pFind').value),all=listed(),found=q?all.filter(s=>khop(s,q)):all;
  $('#pStudent').innerHTML=found.length?found.map(s=>`<option value="${s.id}">${esc(s.name)}${s.cls?' – '+esc(s.cls):''}</option>`).join(''):'<option value="">(Không có học sinh)</option>';
  if(!found.some(s=>s.id===ptSid)){if(q||!stu(ptSid)||!inCls(stu(ptSid)))ptSid=found.length?found[0].id:'';}
  if(found.some(s=>s.id===ptSid))$('#pStudent').value=ptSid;
}
$('#pFind').addEventListener('input',()=>{fillPT();loadCmt();drawPT();});
// sang HS khác: nhận xét đang gõ dở của HS trước được lưu luôn
$('#pStudent').onchange=()=>{if(cmtDirty)saveCmt(true);ptSid=$('#pStudent').value;loadCmt();drawPT();};
$('#pNext').onclick=()=>{if(cmtDirty)saveCmt(true);const o=$$('#pStudent option').map(x=>x.value),i=o.indexOf(ptSid);if(o.length){ptSid=o[(i+1)%o.length];$('#pStudent').value=ptSid;loadCmt();drawPT();}};
function loadCmt(){const r=db.reports.find(x=>x.id===ptSid+'_'+month());$('#pCmt').value=r?r.cmt:'';cmtDirty=false;}
function saveCmt(quiet){
  if(!stu(ptSid))return false;
  const id=ptSid+'_'+month(),cmt=$('#pCmt').value.trim();let r=db.reports.find(x=>x.id===id);
  if(!r){r={id,studentId:ptSid,month:month()};db.reports.push(r);}
  r.cmt=cmt;SYNC.touch('reports',r);persist();cmtDirty=false;if(!quiet)toast('Đã lưu nhận xét tháng');return true;
}
$('#pSave').onclick=()=>saveCmt();
function renderPT(){fillPT();if(!cmtDirty)loadCmt();drawPT();}

function sheetHTML(){
  const s=stu(ptSid);if(!s)return '';
  const mon=month(),[y,m]=mon.split('-'),M=summary(s,mon),L=window.LOGO||'';
  const cmt=$('#pCmt').value.trim();
  // ô ngày học: đủ số buổi của gói (8/12), buổi chưa học để ô nét đứt
  const slots=Math.max(M.total,M.nCa);
  const days=Array.from({length:slots},(_,i)=>{const x=M.caList[i];if(!x)return `<div class="bc-day off"><span class="n">BUỔI ${i+1}</span></div>`;
    const[d,mm]=dmy(x.fDate);return `<div class="bc-day"><span class="n">BUỔI ${i+1}</span><span class="hw">${d}/${mm}</span><span class="w">${thu(x.fDate)}</span></div>`;}).join('');
  const att=attTop(M.att);
  const bars=M.hwS.length?`<div class="bc-chart"><div class="t">MỨC HOÀN THÀNH BTVN TỪNG BUỔI</div>
    <div class="bc-bars">${M.hwS.map(x=>`<div class="bc-bar"><span class="v">${+x.fPct}%</span><div class="b${+x.fPct<80?' lo':''}" style="height:${Math.max(3,+x.fPct*.72)}px"></div></div>`).join('')}</div>
    <div class="bc-lbl">${M.hwS.map(x=>{const[d,mm]=dmy(x.fDate);return `<span>${d}/${mm}</span>`;}).join('')}</div></div>`:'';
  const checks=M.checks.length?`<table class="bc-tbl"><tr><th style="width:70px">Ngày</th><th>Bài kiểm tra</th><th style="width:78px">Điểm</th><th>Nhận xét</th></tr>`
    +M.checks.map(c=>{const[d,mm]=dmy(c.date);return `<tr><td class="c">${d}/${mm}</td><td>${esc(c.name)}</td><td class="c"><span class="hw">${esc(c.score)}</span>/${esc(c.max)}</td><td>${c.note?`<span class="hw">${esc(c.note)}</span>`:''}</td></tr>`;}).join('')+'</table>'
    :'<div class="bc-none">Tháng này con chưa có bài kiểm tra định kỳ.</div>';
  return `<div class="sheet bc f-lora">
   <img class="wm" src="${L}">
   <div class="in">
    <div class="sh-top"><img class="logo" src="${L}"><div class="sh-motto">KIÊN TRÌ - YÊU THƯƠNG - TIẾN BỘ</div><div class="sh-tag">MS. MINH THƯ</div></div>
    <div class="sh-title">📚 BÁO CÁO HỌC TẬP 📚</div>
    <div class="sh-sub">KẾT QUẢ HỌC TẬP THÁNG ${+m}/${y} – GỬI PHỤ HUYNH HỌC VIÊN</div>
    <div class="sh-info">
      <div><div class="sh-lab">HỌ TÊN HỌC VIÊN | LỚP</div><div class="sw o"><div class="sh-box"><span class="hw">${esc(s.name)}${s.cls?' | '+esc(s.cls):''}</span></div></div></div>
      <div><div class="sh-lab">THÁNG</div><div class="sw o"><div class="sh-box"><span class="hw">${two(+m)}</span>&nbsp;<b>/ ${y}</b></div></div></div>
      <div><div class="sh-lab">SỐ BUỔI ĐI HỌC</div><div class="sw o"><div class="sh-box"><span class="hw">${two(M.nCa)}</span>&nbsp;<b>/</b>&nbsp;<span class="hw">${M.total}</span></div></div></div>
    </div>
    <div class="sh-h green">CHUYÊN CẦN – CÁC BUỔI CON ĐÃ HỌC</div>
    <div class="bc-days">${days}</div>
    <div class="bc-sum">Con đã học <span class="hw">${M.nCa}</span> / ${M.total} buổi trong tháng ${+m}</div>
    <div class="sh-h purple">KẾT QUẢ HỌC TẬP</div>
    <div class="bc-stats">
      <div class="sw p"><div class="bc-st"><div class="t">TỪ VỰNG ĐÃ THUỘC</div><div class="big">${M.asked?M.words:'—'}${M.asked?' <small>từ</small>':''}</div><div class="s">${M.asked?`/ ${M.asked} từ · ${M.nTests} lần khảo<br>${tbTu(M)}`:'Chưa khảo từ'}</div></div></div>
      <div class="sw p"><div class="bc-st"><div class="t">HOÀN THÀNH BTVN</div><div class="big">${M.hwAvg==null?'—':M.hwAvg+'<small>%</small>'}</div><div class="s">${M.hwS.length?`trung bình ${M.hwS.length} buổi`:'Chưa có BTVN'}</div></div></div>
      <div class="sw p"><div class="bc-st"><div class="t">TINH THẦN HỌC TẬP</div><div class="big" style="font-size:${att&&att.length>4?24:30}px">${att||'—'}</div><div class="s">${att?[['tot','tốt'],['kha','khá'],['cct','cần cố gắng']].filter(([k])=>M.att[k]).map(([k,t])=>`${M.att[k]} buổi ${t}`).join(' · '):''}</div></div></div>
    </div>
    ${bars}
    <div class="sh-h navy">ĐIỂM KIỂM TRA</div>
    ${checks}
    <div class="sh-h green">NHẬN XÉT CỦA GIÁO VIÊN</div>
    <div class="bc-cmt"><div class="tx">${cmt?`<span class="hw">${esc(cmt)}</span>`:'<span class="ph">(Cô viết nhận xét ở ô bên trái)</span>'}</div>${cmt?'<img class="stamp" src="stamp.png" alt="">':''}</div>
   </div>
   <div class="sh-foot"><div><span>THÔNG TIN LIÊN HỆ</span><span>SĐT: 0966.101.957 (Ms. Minh Thư)</span><span>GROW WITH ENGLISH</span></div></div>
  </div>`;
}
// nhận xét dài thì thu nhỏ chữ cho vừa ô
function fitCmt(root){root.querySelectorAll('.bc-cmt .tx').forEach(el=>{let s=17;el.style.fontSize=s+'px';const H=el.parentNode.clientHeight-20;
  while(s>11&&el.scrollHeight>H){s-=.5;el.style.fontSize=s+'px';}});}
function drawPT(){
  const s=stu(ptSid),M=s?summary(s,month()):null;
  $('#pInfo').innerHTML=s?`Tháng ${month().split('-').reverse().join('/')}: ${M.nCa}/${M.total} buổi · BTVN ${M.hwAvg==null?'—':M.hwAvg+'%'} · ${M.asked?M.words+' từ thuộc':'chưa khảo từ'} · ${M.checks.length} bài KT`:'';
  const h=sheetHTML(),ex=$('#bcExport');ex.innerHTML=h;fitCmt(ex);
  $('#bcPrev').innerHTML=ex.innerHTML;fitPrev();
}
function fitPrev(){const wrap=$('#bcPrevWrap'),el=$('#bcPrev');wrap.style.width='';const w=wrap.clientWidth;if(!w)return;
  const sh=el.firstElementChild?el.firstElementChild.offsetHeight:0;let k=w/630;
  if(innerWidth>900&&sh){const card=wrap.closest('.card'),other=card.offsetHeight-wrap.offsetHeight;k=Math.max(.45,Math.min(k,(innerHeight-76-12-other)/sh));wrap.style.width=630*k+'px';}
  el.style.transform=`scale(${k})`;wrap.style.height=sh*k+'px';}
addEventListener('resize',fitPrev);

/* ---------- Xuất ảnh + Zalo ---------- */
const pngName=()=>{const s=stu(ptSid);return `BaoCaoThang_${fileSafe(s?s.name:'HS')}_${month()}.png`;};
async function makePNG(){
  if(!window.html2canvas){toast('Chưa tải được công cụ chụp ảnh – kiểm tra mạng internet');throw new Error('no html2canvas');}
  if(!stu(ptSid)){toast('Chọn học sinh trước đã ạ');throw new Error('no student');}
  if(cmtDirty)saveCmt(true);
  await document.fonts.ready;drawPT();
  const c=await html2canvas($('#bcExport .sheet'),{scale:2,backgroundColor:'#ffffff',logging:false});
  return new Promise(res=>c.toBlob(res,'image/png'));
}
// link nhóm Zalo: dùng chung link cô đã lưu ở trang Phiếu học tập (chỉ nằm trong máy)
function zaloLink(){
  let l=db.cfg.zalo;
  if(!l){try{l=(JSON.parse(localStorage.getItem('gwe-phieu-hoc-tap-v1')||'{}').cfg||{}).zalo;}catch(e){}}
  if(!l){l=(prompt('Dán link nhóm Zalo để sao chép ảnh xong tự mở nhóm (chỉ cần làm 1 lần):')||'').trim();
    if(!/^https:\/\/zalo\.me\//.test(l)){if(l)toast('Link phải bắt đầu bằng https://zalo.me/');return null;}}
  db.cfg.zalo=l;persist();return l;
}
function openZalo(){const l=zaloLink();if(l&&!window.open(l,'_blank'))location.href=l;}
$('#bDown').onclick=async()=>{try{download(await makePNG(),pngName());}catch(e){console.error(e);}};
$('#bCopy').onclick=async()=>{if(!stu(ptSid)){toast('Chọn học sinh trước đã ạ');return;}try{
  await navigator.clipboard.write([new ClipboardItem({'image/png':makePNG()})]);
  toast('Đã sao chép ảnh – vào nhóm Zalo bấm Ctrl+V');openZalo();
}catch(e){console.error(e);toast('Trình duyệt không cho sao chép ảnh – đã tải ảnh về máy');try{download(await makePNG(),pngName());openZalo();}catch(_){}}};
$('#bShare').onclick=async()=>{try{const b=await makePNG(),f=new File([b],pngName(),{type:'image/png'});
  if(navigator.canShare&&navigator.canShare({files:[f]}))await navigator.share({files:[f]});
  else{download(b,pngName());toast('Máy này không hỗ trợ chia sẻ trực tiếp – đã tải ảnh về');}}catch(e){if(e.name!=='AbortError')console.error(e);}};

/* ---------- Đồng bộ + khởi động ---------- */
const SYNC=createSync({app:'bao-cao',cols:['students','sessions','tests','checks','reports'],get:c=>db[c],set:(c,a)=>db[c]=a,save:persist,onChange:()=>{
  // đang gõ dở trong bảng điểm thì không vẽ lại (mất số đang gõ)
  if(tab==='kt'&&$('#v-kt').contains(document.activeElement)){fillCls();return;}
  renderAll();}});
$('#appLogo').src=window.LOGO||'';
$('#gMonth').value=lastMon=today().slice(0,7);
renderAll();
document.fonts&&document.fonts.ready.then(()=>{if(tab==='pt')drawPT();});

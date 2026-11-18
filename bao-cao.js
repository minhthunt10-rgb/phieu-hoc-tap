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

/* Gộp điểm cô nhập trên phiếu buổi vào danh sách điểm kiểm tra.
   kt = thẻ "Kiểm tra định kỳ" cũ, sc = ô vàng ✍️ Nhập điểm (nhận xét = fScCmt, không in trên phiếu).
   Mỗi dòng nhớ nguồn (src/ref) để sửa nhận xét / xóa ở ô "Điểm kiểm tra trong khóa"; dòng đã xóa thì phiếu có ktHide/scHide. */
function addSessChecks(cs,ss){
  const has=(d,n)=>cs.some(c=>c.date===d&&String(c.name).trim().toLowerCase()===n.toLowerCase());
  ss.forEach(x=>{
    if(!x.ktHide&&x.fKtScore!==''&&x.fKtScore!=null){const n=x.fKtName||'Kiểm tra định kỳ';if(!has(x.fDate,n))cs.push({date:x.fDate,name:n,score:x.fKtScore,max:x.fKtMax||10,note:x.fKtCmt||'',src:'kt',ref:x});}
    if(!x.scHide&&x.scOn&&x.fScVal!==''&&x.fScVal!=null){const n=String(x.fScName||'Điểm kiểm tra').replace(/[:\s]+$/,'');if(!has(x.fDate,n))cs.push({date:x.fDate,name:n,score:String(x.fScVal).replace(',','.'),max:x.fScMax||10,note:x.fScCmt||'',src:'sc',ref:x});}});
  return cs.sort((p,q)=>String(p.date).localeCompare(String(q.date)));
}
/* ---------- Tổng hợp 1 HS trong 1 tháng ---------- */
function summary(s,mon,rng){
  // rng={a,b}: tổng hợp theo khoảng ngày (cả khóa) thay vì theo tháng
  const inR=d=>rng?(d>=rng.a&&d<=rng.b):d.startsWith(mon);
  const ss=db.sessions.filter(x=>x.studentId===s.id&&inR(String(x.fDate||''))).sort((a,b)=>a.fDate.localeCompare(b.fDate)||String(a.created).localeCompare(String(b.created)));
  // 1 ngày tính 1 buổi (lỡ lưu 2 phiếu cùng ngày)
  const byDate={};ss.forEach(x=>byDate[x.fDate]=x);const days=Object.keys(byDate).sort();const sess=days.map(d=>byDate[d]);
  const hwS=sess.filter(x=>!x.abs&&x.hw!=='none'&&x.fPct!==''&&x.fPct!=null&&!isNaN(+x.fPct));
  const hwAvg=hwS.length?Math.round(hwS.reduce((a,x)=>a+(+x.fPct),0)/hwS.length):null;
  // số từ thuộc: khảo đi khảo lại cùng 1 Unit không cộng dồn – mỗi từ chỉ tính 1 lần, lấy kết quả lần khảo gần nhất
  const ts=db.tests.filter(x=>x.studentId===s.id&&inR(String(x.date||''))).sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.created).localeCompare(String(b.created)));
  let words=0,asked=0,nTests=0;const wl={};
  ts.forEach(t=>{nTests++;const u=boDau(t.unit);
    if(t.items&&t.items.length)t.items.forEach(it=>{wl[u+'|'+boDau(it.en)]=!!it.ok;});
    else wl['T|'+u+'|'+t.n]={s:+t.score||0,n:+t.n||0};});
  // chưa có bài trang Khảo từ: dùng điểm khảo trên phiếu (cùng Unit + cùng số từ = khảo lại → lấy lần sau)
  if(!ts.length)sess.forEach(x=>{if(!x.abs&&x.fVScore!==''&&x.fVScore!=null&&!isNaN(+x.fVScore)){nTests++;wl['P|'+boDau(x.fVUnit)+'|'+(x.fVNum||'')]={s:+x.fVScore,n:+x.fVNum||0};}});
  Object.values(wl).forEach(v=>{if(typeof v==='boolean'){asked++;if(v)words++;}else{words+=v.s;asked+=v.n;}});
  const att={tot:0,kha:0,cct:0};sess.forEach(x=>{if(!x.abs&&att[x.att]!=null)att[x.att]++;});
  const checks=addSessChecks(db.checks.filter(x=>x.studentId===s.id&&inR(String(x.date||''))).map(c=>({...c,src:'c',ref:c})),ss);
  const rep=db.reports.find(x=>x.id===s.id+'_'+mon);
  // buổi ghi "5+6" = học 2 ca trong 1 buổi → tính 2 buổi
  // buổi học bù không tính thêm buổi của khóa → ghi riêng
  const buList=sess.filter(x=>x.bu);
  const caList=sess.filter(x=>!x.bu).flatMap(x=>Array(Math.max(1,String(x.fNo||"").split("+").filter(p=>/\d/.test(p)).length)).fill(x));
  // buổi nghỉ (có phép / không phép) vẫn tính buổi của khóa
  const nCp=caList.filter(x=>x.abs==='cp').length,nKp=caList.filter(x=>x.abs==='kp').length;
  return {sess,caList,buList,nCa:caList.length,nCp,nKp,days,hwS,hwAvg,words,asked,nTests,att,checks,cmt:rep?rep.cmt:'',total:+s.total||12};
}
// trung bình mỗi lần khảo: "TB 21/30 (70%)"
// tỉ lệ từ thuộc (mỗi từ tính 1 lần, theo lần khảo gần nhất)
const tbTu=m=>`đúng ${Math.round(m.words/m.asked*100)}%`;
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
function renderAll(){fillCls();if(tab==='gs')renderGS();if(tab==='kt')renderKT();if(tab==='pt')renderPT();if(tab==='tw')renderTW();}
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
const P_CHIPS=['Khóa này con đi học đều, hoàn thành tốt bài tập về nhà.','Con tiến bộ rõ ở phần từ vựng, thuộc bài nhanh hơn khóa trước.',
  'Con nắm chắc ngữ pháp đã học, làm bài cẩn thận.','Con cần dành thêm thời gian học thuộc từ vựng ở nhà.','Con cần làm BTVN đầy đủ hơn, PH nhắc con giúp cô ạ.',
  'Điểm kiểm tra của con ổn định, tiếp tục phát huy nhé!','Khóa sau con tập trung ôn …','Con nghỉ … buổi, PH sắp xếp cho con học bù giúp cô ạ.'];
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
  fillK();
}
/* ---------- Khóa học: tách từ phiếu buổi – buổi số quay về 1 = sang khóa mới ---------- */
const noNs=v=>(String(v||'').match(/\d+/g)||[]).map(Number);
function khoas(s){
  if(!s)return [];
  const ss=db.sessions.filter(x=>x.studentId===s.id&&!x.bu&&x.fDate).sort((a,b)=>a.fDate.localeCompare(b.fDate)||String(a.created).localeCompare(String(b.created)));
  const K=[];let prev=0;
  ss.forEach(x=>{const n=noNs(x.fNo),mn=n.length?Math.min(...n):null;
    if(!K.length||(mn===1&&prev>1&&K[K.length-1].a!==x.fDate))K.push({a:x.fDate});
    if(n.length)prev=Math.max(...n);});
  K.forEach((k,i)=>{k.i=i+1;k.b=K[i+1]?addD(K[i+1].a,-1):'9999-12-31';});
  return K;
}
let ptK=null; // ngày bắt đầu khóa đang xem
const curK=()=>{const K=khoas(stu(ptSid));return K.find(k=>k.a===ptK)||K[K.length-1]||null;};
const kEnd=(s,k)=>{if(k.b!=='9999-12-31')return k.b;const d=db.sessions.filter(x=>x.studentId===s.id&&x.fDate>=k.a).map(x=>x.fDate).sort().pop();return d||k.a;};
function fillK(){
  const s=stu(ptSid),K=khoas(s);
  $('#pKhoa').innerHTML=K.length?K.slice().reverse().map(k=>`<option value="${k.a}">Khóa ${k.i}: ${dmS(k.a)} – ${k.b==='9999-12-31'?'nay':dmS(k.b)}</option>`).join(''):'<option value="">(Chưa có phiếu buổi nào)</option>';
  const c=curK();ptK=c?c.a:null;if(c)$('#pKhoa').value=c.a;
}
$('#pFind').addEventListener('input',()=>{fillPT();loadCmt();drawPT();});
// sang HS khác: nhận xét đang gõ dở của HS trước được lưu luôn
$('#pStudent').onchange=()=>{if(cmtDirty)saveCmt(true);ptSid=$('#pStudent').value;ptK=null;fillK();loadCmt();drawPT();};
$('#pKhoa').onchange=()=>{if(cmtDirty)saveCmt(true);ptK=$('#pKhoa').value;loadCmt();drawPT();};
$('#pNext').onclick=()=>{if(cmtDirty)saveCmt(true);const o=$$('#pStudent option').map(x=>x.value),i=o.indexOf(ptSid);if(o.length){ptSid=o[(i+1)%o.length];$('#pStudent').value=ptSid;ptK=null;fillK();loadCmt();drawPT();}};
const kRepId=()=>{const k=curK();return k?ptSid+'_K'+k.a:'';};
function loadCmt(){const r=db.reports.find(x=>x.id===kRepId());$('#pCmt').value=r?r.cmt:'';cmtDirty=false;}
function saveCmt(quiet){
  if(!stu(ptSid)||!curK())return false;
  const id=kRepId(),cmt=$('#pCmt').value.trim();let r=db.reports.find(x=>x.id===id);
  if(!r){r={id,studentId:ptSid,month:'K'+curK().a};db.reports.push(r);}
  r.cmt=cmt;SYNC.touch('reports',r);persist();cmtDirty=false;if(!quiet)toast('Đã lưu nhận xét khóa');return true;
}
$('#pSave').onclick=()=>saveCmt();
function renderPT(){fillPT();if(!cmtDirty)loadCmt();drawPT();}

function sheetHTML(){
  const s=stu(ptSid),k=curK();if(!s||!k)return '';
  const M=summary(s,'',{a:k.a,b:k.b}),L=window.LOGO||'',end=kEnd(s,k);
  const cmt=$('#pCmt').value.trim();
  const dl=xs=>xs.map(x=>{const[d,mm]=dmy(x.fDate);return d+'/'+mm;}).join(', ');
  const nghiCp=M.caList.filter(x=>x.abs==='cp'),nghiKp=M.caList.filter(x=>x.abs==='kp'),bu=M.buList;
  const uniq=xs=>xs.filter((x,i)=>xs.indexOf(x)===i);
  // chuyên cần gọn: số buổi + (nếu có) ngày nghỉ, buổi học bù
  const cc=`<div class="bm-cc"><span>Số buổi học: <span class="hw">${two(M.nCa)}</span> / <b>${M.total}</b></span>`
    +(nghiCp.length?`<span class="no">Nghỉ có phép: <b>${uniq(nghiCp).length}</b> buổi (${dl(uniq(nghiCp))})</span>`:'')
    +(nghiKp.length?`<span class="no">Nghỉ không phép: <b>${uniq(nghiKp).length}</b> buổi (${dl(uniq(nghiKp))})</span>`:'')
    +(bu.length?`<span>Học bù: <b>${bu.length}</b> buổi (${dl(bu)})</span>`:'')+'</div>';
  const att=attTop(M.att);
  const bars=M.hwS.length?`<div class="bc-chart" style="margin-top:0"><div class="t">TRUNG BÌNH ${M.hwAvg}% · ${M.hwS.length} BUỔI</div>
    <div class="bc-bars">${M.hwS.map(x=>`<div class="bc-bar"><span class="v">${+x.fPct}%</span><div class="b${+x.fPct<80?' lo':''}" style="height:${Math.max(3,+x.fPct*.46)}px"></div></div>`).join('')}</div>
    <div class="bc-lbl">${M.hwS.map(x=>{const[d,mm]=dmy(x.fDate);return `<span>${d}/${mm}</span>`;}).join('')}</div></div>`:'<div class="bc-none">Tháng này chưa có BTVN.</div>';
  const checks=M.checks.length?`<table class="bc-tbl"><tr><th style="width:70px">Ngày</th><th>Bài kiểm tra</th><th style="width:78px">Điểm</th><th>Nhận xét</th></tr>`
    +M.checks.map(c=>{const[d,mm]=dmy(c.date);return `<tr><td class="c">${d}/${mm}</td><td>${esc(c.name)}</td><td class="c"><span class="hw">${esc(c.score)}</span>/${esc(c.max)}</td><td>${c.note?`<span class="hw">${esc(c.note)}</span>`:''}</td></tr>`;}).join('')+'</table>'
    :'<div class="bc-none">Tháng này con chưa có bài kiểm tra định kỳ.</div>';
  return `<div class="sheet c2 rm bc f-lora">
   <img class="wm" src="${L}">
   <div class="in">
    <div class="sh-top"><img class="logo" src="logo-c2.png"><div class="sh-motto">KIÊN TRÌ - YÊU THƯƠNG - TIẾN BỘ</div><div class="sh-tag">MS. MINH THƯ</div></div>
    <div class="sh-title">BÁO CÁO KHÓA</div>
    <div class="sh-sub">KẾT QUẢ HỌC TẬP CẢ KHÓA – GỬI PHỤ HUYNH HỌC VIÊN</div>
    <div class="sh-info">
      <div><div class="sh-lab">HỌ TÊN HỌC VIÊN | LỚP</div><div class="sw o"><div class="sh-box"><span class="hw">${esc(s.name)}${s.cls?' | '+esc(s.cls):''}</span></div></div></div>
      <div><div class="sh-lab">THỜI GIAN KHÓA</div><div class="sw o"><div class="sh-box" style="white-space:nowrap"><span class="hw">${dmS(k.a)}</span>&nbsp;<b>–</b>&nbsp;<span class="hw">${dmS(end)}</span><b>/${end.slice(0,4)}</b></div></div></div>
    </div>
    <div class="sh-h n1">KẾT QUẢ HỌC TẬP</div>
    <div class="bc-stats">
      <div class="sw p"><div class="bc-st"><div class="t">TỪ VỰNG THUỘC (TB)</div><div class="big">${M.asked?Math.round(M.words/M.asked*100)+'<small>%</small>':'—'}</div><div class="s">${M.asked?`${M.words}/${M.asked} từ · ${M.nTests} lần khảo`:'Chưa khảo từ'}</div></div></div>
      <div class="sw p"><div class="bc-st"><div class="t">HOÀN THÀNH BTVN</div><div class="big">${M.hwAvg==null?'—':M.hwAvg+'<small>%</small>'}</div><div class="s">${M.hwS.length?`trung bình ${M.hwS.length} buổi`:'Chưa có BTVN'}</div></div></div>
      <div class="sw p"><div class="bc-st"><div class="t">TINH THẦN HỌC TẬP</div><div class="big" style="font-size:${att&&att.length>4?19:24}px">${att||'—'}</div><div class="s">${att?[['tot','tốt'],['kha','khá'],['cct','cần cố gắng']].filter(([k])=>M.att[k]).map(([k,t])=>`${M.att[k]} buổi ${t}`).join(' · '):''}</div></div></div>
    </div>
    <div class="sh-h n2">ĐIỂM KIỂM TRA</div>
    ${checks}
    <div class="sh-h n3">MỨC ĐỘ HOÀN THÀNH BTVN</div>
    ${bars}
    <div class="sh-h n4">CHUYÊN CẦN</div>
    ${cc}
    <div class="sh-h n5">NHẬN XÉT CỦA GIÁO VIÊN</div>
    <div class="bc-cmt"><div class="tx">${cmt?`<span class="hw">${esc(cmt)}</span>`:'<span class="ph">(Cô viết nhận xét ở ô bên trái)</span>'}</div></div>
   </div>
   <div class="sh-foot"><div><span>THÔNG TIN LIÊN HỆ</span><span>SĐT: 0966.101.957 (Ms. Minh Thư)</span><span>GROW WITH ENGLISH</span></div></div>
  </div>`;
}
// nhận xét dài thì thu nhỏ chữ cho vừa ô
function fitCmt(root){root.querySelectorAll('.bc-cmt .tx').forEach(el=>{let s=17;el.style.fontSize=s+'px';const H=el.parentNode.clientHeight-20;
  while(s>11&&el.scrollHeight>H){s-=.5;el.style.fontSize=s+'px';}});}
function drawPT(){
  const s=stu(ptSid),k=curK(),M=s&&k?summary(s,'',{a:k.a,b:k.b}):null;
  $('#pInfo').innerHTML=M?`Khóa ${k.i} (từ ${dmS(k.a)}): ${M.nCa}/${M.total} buổi · BTVN ${M.hwAvg==null?'—':M.hwAvg+'%'} · ${M.asked?M.words+' từ thuộc':'chưa khảo từ'} · ${M.checks.length} bài KT`:'';
  drawPChecks(M);
  const h=sheetHTML(),ex=$('#bcExport');ex.innerHTML=h;fitCmt(ex);
  $('#bcPrev').innerHTML=ex.innerHTML;fitPrev();
}
/* Ô "Điểm kiểm tra trong khóa" (cô yêu cầu 2026-11-18): liệt kê mọi dòng điểm, sửa nhận xét, xóa dòng trùng.
   Điểm nhập ở trang Báo cáo → xóa hẳn; điểm từ phiếu buổi → chỉ ẩn khỏi báo cáo (phiếu vẫn giữ nguyên). */
function drawPChecks(M){
  const box=$('#pChecks');if(!box)return;const cs=M?M.checks:[];
  const k=curK(),dd=$('#paDate');if(dd&&k){dd.min=k.a;dd.max=k.b==='9999-12-31'?'':k.b;if(!dd.value||dd.value<k.a||(dd.max&&dd.value>dd.max))dd.value=dd.max&&today()>dd.max?dd.max:(today()<k.a?k.a:today());}
  if(!cs.length){box.innerHTML='<p class="hint" style="margin:0">Khóa này chưa có điểm kiểm tra.</p>';return;}
  const SRC={c:'trang Báo cáo',kt:'phiếu (thẻ kiểm tra cũ)',sc:'phiếu – ô ✍️ Nhập điểm'};
  box.innerHTML=cs.map((c,i)=>`<div class="pck"><div class="pck-h"><b>${dmS(c.date)}</b> · ${esc(c.name)}: <b class="pck-s">${esc(String(c.score).replace('.',','))}/${esc(String(isNaN(+c.max)?c.max:+c.max).replace('.',','))}</b>
    <button type="button" class="pck-del" data-i="${i}" title="Xóa dòng điểm này">🗑</button></div>
    <input type="text" class="pck-n" data-i="${i}" value="${esc(c.note||'')}" placeholder="Nhận xét (không in trên phiếu)">
    <div class="hint pck-src">Nguồn: ${SRC[c.src]||''}</div></div>`).join('');
  const save=c=>{if(c.src==='c')SYNC.touch('checks',c.ref);else SYNC.touch('sessions',c.ref);persist();};
  box.querySelectorAll('.pck-n').forEach(inp=>inp.onchange=()=>{const c=cs[+inp.dataset.i],v=inp.value.trim();
    if(c.src==='c')c.ref.note=v;else if(c.src==='kt')c.ref.fKtCmt=v;else c.ref.fScCmt=v;
    save(c);toast('Đã lưu nhận xét điểm');drawPT();});
  box.querySelectorAll('.pck-del').forEach(b=>b.onclick=()=>{const c=cs[+b.dataset.i];
    if(!confirm(`Xóa dòng điểm "${c.name}: ${c.score}/${c.max}" (${dmS(c.date)}) khỏi báo cáo?`+(c.src==='c'?'':'\n(Phiếu buổi học vẫn giữ nguyên, chỉ ẩn khỏi báo cáo.)')))return;
    if(c.src==='c'){SYNC.remove('checks',c.ref.id);db.checks=db.checks.filter(x=>x!==c.ref);persist();}
    else{c.ref[c.src==='kt'?'ktHide':'scHide']=1;save(c);}
    toast('Đã xóa dòng điểm');drawPT();});
}
// ➕ Nhập thêm điểm ngay trong ô Điểm kiểm tra trong khóa (cô yêu cầu 2026-11-19) → lưu vào checks như trang Điểm KT
$('#paAdd').onclick=()=>{
  if(!stu(ptSid)){toast('Chọn học sinh trước đã ạ');return;}
  const num=v=>String(v||'').trim().replace(',','.'),d=$('#paDate').value,name=$('#paName').value.trim(),sc=num($('#paScore').value),mx=num($('#paMax').value)||'10';
  if(!d||!name||sc===''||isNaN(+sc)||isNaN(+mx)){toast('Nhập đủ ngày, tên bài và điểm ạ');return;}
  const c={id:uid(),studentId:ptSid,date:d,name,score:+sc,max:+mx,note:$('#paNote').value.trim()};
  db.checks.push(c);SYNC.touch('checks',c);persist();
  ['paName','paScore','paMax','paNote'].forEach(i=>$('#'+i).value='');
  toast('Đã lưu điểm');drawPT();
};
function fitPrev(){const wrap=$('#bcPrevWrap'),el=$('#bcPrev');wrap.style.width='';const w=wrap.clientWidth;if(!w)return;
  const sh=el.firstElementChild?el.firstElementChild.offsetHeight:0;let k=w/630;
  if(innerWidth>900&&sh){const card=wrap.closest('.card'),other=card.offsetHeight-wrap.offsetHeight;k=Math.max(.45,Math.min(k,(innerHeight-76-12-other)/sh));wrap.style.width=630*k+'px';}
  el.style.transform=`scale(${k})`;wrap.style.height=sh*k+'px';}
addEventListener('resize',fitPrev);

/* ---------- Xuất ảnh + Zalo ---------- */
const pngName=()=>{const s=stu(ptSid);const k=curK();return `BaoCaoKhoa_${fileSafe(s?s.name:'HS')}_K${k?k.i:''}.png`;};
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

/* ---------- 4. Báo cáo tuần (kiểm tra sát, gửi PH mỗi tuần) ----------
   Điểm kiểm tra sát lưu vào checks (như điểm KT thường → phiếu tháng cũng thấy).
   Nhận xét tuần lưu vào reports, id = <hs>_W<thứ 2 đầu tuần>. Lộ trình + ngày thi đọc từ lịch trên máy cô (không đồng bộ). */
const LICH=()=>{try{return JSON.parse(localStorage.getItem('gwe-lich-hoc-v1')||'{}');}catch(e){return {};}};
const isoD=x=>x.getFullYear()+'-'+two(x.getMonth()+1)+'-'+two(x.getDate());
const addD=(iso,n)=>{const d=new Date(iso+'T00:00:00');d.setDate(d.getDate()+n);return isoD(d);};
const monOf=iso=>{const d=new Date(iso+'T00:00:00');d.setDate(d.getDate()-(d.getDay()+6)%7);return isoD(d);};
const dmS=iso=>{const[d,m]=dmy(iso);return d+'/'+m;};
const dowI=iso=>(new Date(iso+'T00:00:00').getDay()+6)%7;
const baseName=n=>boDau(String(n||'').replace(/\(.*?\)/g,'').split(/\s[–-]\s/)[0]);
// bộ bài kiểm tra sát theo loại lộ trình [tên, thang điểm]
const SAT={
  movers:[['Part 3 – điền từ vào truyện',6],['Part 5 – hoàn thành câu theo truyện',7],['Part 4 – chọn từ đúng',5],['Khiên Nghe',5],['Khiên Đọc – Viết',5],['Khiên Nói',5]],
  ielts:[['IELTS Listening (số câu đúng)',40],['IELTS Reading (số câu đúng)',40],['IELTS Writing Task 1 (band)',9],['IELTS Writing Task 2 (band)',9],['IELTS Speaking (band)',9]],
  khac:[['Kiểm tra từ vựng',10],['Kiểm tra ngữ pháp',10],['Kiểm tra đọc hiểu',10]]};
// quy đổi số câu đúng /40 ra band (bảng tham khảo IELTS Academic)
const BAND={L:[[39,9],[37,8.5],[35,8],[32,7.5],[30,7],[26,6.5],[23,6],[18,5.5],[16,5],[13,4.5],[10,4],[8,3.5],[6,3],[4,2.5]],
  R:[[39,9],[37,8.5],[35,8],[33,7.5],[30,7],[27,6.5],[23,6],[19,5.5],[15,5],[13,4.5],[10,4],[8,3.5],[6,3],[4,2.5]]};
const band=(name,sc,max)=>{if(+max!==40)return '';const t=/listening/i.test(name)?'L':/reading/i.test(name)?'R':'';if(!t)return '';const r=BAND[t].find(([n])=>+sc>=n);return r?' ≈ '+r[1]:'';};
let twSid='',twLink=null;
const twMon=()=>monOf($('#wDay').value||today());
const twIds=()=>[twSid].concat(twLink&&stu(twLink)&&twLink!==twSid?[twLink]:[]);
const planType=ids=>{const P=LICH().plans||{},k=ids.map(i=>(P[i]||{}).thi||'').join(' ');return /movers/.test(k)?'movers':/ielts/.test(k)?'ielts':'khac';};
function checksIn(ids,a,b){
  const ss=db.sessions.filter(x=>ids.includes(x.studentId)&&x.fDate>=a&&x.fDate<=b);
  return addSessChecks(db.checks.filter(x=>ids.includes(x.studentId)&&x.date>=a&&x.date<=b).map(c=>({...c,src:'c',ref:c})),ss);
}
function weekData(){
  const s=stu(twSid);if(!s)return null;
  const ids=twIds(),a=twMon(),b=addD(a,6),L=LICH(),P=L.plans||{},days=L.days||{};
  const byK={};db.sessions.filter(x=>ids.includes(x.studentId)&&x.fDate>=a&&x.fDate<=b).forEach(x=>byK[x.studentId+x.fDate]=x);
  const sess=Object.values(byK).sort((p,q)=>p.fDate.localeCompare(q.fDate));
  const ck=checksIn(ids,a,b),all=checksIn(ids,'0000','9999');
  const prog=[...new Set(ck.map(c=>c.name))].map(n=>{const xs=all.filter(c=>c.name===n),cur=ck.filter(c=>c.name===n).pop(),
    prev=xs.filter(c=>c.date<a).pop()||null,first=xs[0]&&xs[0].date<a&&xs[0]!==prev?xs[0]:null;return {n,cur,prev,first};});
  // lộ trình (có thể 2 hồ sơ: lớp + kèm)
  let done=0,tot=0,exam='',ten=[];const next=[],learn=[];
  const lastD=id=>db.sessions.filter(x=>x.studentId===id).map(x=>x.fDate||'').sort().pop()||'';
  ids.forEach(id=>{const p=P[id];if(!p||!p.items)return;
    const isD=it=>!!(it.ses&&db.sessions.some(x=>x.id===it.ses));
    tot+=p.items.length;done+=p.items.filter(isD).length;if(p.exam&&(!exam||p.exam<exam))exam=p.exam;
    if(p.thi&&window.LT_THI&&LT_THI[p.thi])ten.push(LT_THI[p.thi].ten.split(' – ')[0].replace(/\s*\(.*\)$/,''));
    p.items.filter(it=>isD(it)&&it.date>=a&&it.date<=b).forEach(it=>learn.push({d:it.date,k:it.k,id}));
    // xếp ngày cho buổi chưa học theo lịch tuần của em (giống tab Lộ trình)
    const o=days[id]||{},pend=p.items.filter(it=>!isD(it));if(!Object.keys(o).length)return;
    let d=today();const ld=lastD(id);if(ld>=d)d=addD(ld,1);const lim=addD(b,7);
    for(let i=0,g=0;i<pend.length&&g<60&&d<=lim;g++,d=addD(d,1)){if(dowI(d) in o){next.push({d,k:pend[i].k,id,u:pend[i].u});i++;}}});
  next.sort((p,q)=>p.d.localeCompare(q.d));
  return {s,ids,a,b,sess,ck,prog,done,tot,exam,ten:[...new Set(ten)],next,learn};
}
// ô chọn HS + hồ sơ gộp + tuần
function fillTW(){
  const q=boDau($('#wFind').value),all=listed(),found=q?all.filter(s=>khop(s,q)):all;
  // em có lộ trình luyện thi lên đầu danh sách
  const P=LICH().plans||{},thi=s=>P[s.id]&&P[s.id].thi?0:1;found.sort((x,y)=>thi(x)-thi(y));
  $('#wStudent').innerHTML=found.length?found.map(s=>`<option value="${s.id}">${thi(s)?'':'🎯 '}${esc(s.name)}${s.cls?' – '+esc(s.cls):''}</option>`).join(''):'<option value="">(Không có học sinh)</option>';
  if(!found.some(s=>s.id===twSid))twSid=found.length?found[0].id:'';
  if(twSid)$('#wStudent').value=twSid;
  const s=stu(twSid),others=active().filter(x=>x.id!==twSid);
  if(twLink===null&&s){const same=others.filter(x=>baseName(x.name)===baseName(s.name));twLink=same.length===1?same[0].id:'';}
  $('#wLink').innerHTML='<option value="">— Không gộp —</option>'+others.sort(byKhoi).map(x=>`<option value="${x.id}">${esc(x.name)}${x.cls?' – '+esc(x.cls):''}</option>`).join('');
  $('#wLink').value=twLink||'';
}
function renderWC(){
  const ids=twIds(),a=twMon(),b=addD(a,6);let d=$('#wcDate').value;
  if(!d||d<a||d>b){d=today()>=a&&today()<=b?today():(db.sessions.filter(x=>ids.includes(x.studentId)&&x.fDate>=a&&x.fDate<=b).map(x=>x.fDate).sort().pop()||a);$('#wcDate').value=d;}
  const pre=SAT[planType(ids)].map(x=>[...x]),names=pre.map(x=>x[0]);
  db.checks.filter(c=>ids.includes(c.studentId)&&c.date>=a&&c.date<=b&&!names.includes(c.name)).forEach(c=>{names.push(c.name);pre.push([c.name,c.max||10]);});
  const cur=n=>db.checks.find(c=>ids.includes(c.studentId)&&c.date===d&&c.name===n);
  $('#wcList').innerHTML='<div class="wc-row hint"><span>Bài / phần</span><span>Điểm</span><span></span><span>Ghi chú</span></div>'
    +pre.map(([n,m])=>{const c=cur(n);return `<div class="wc-row" data-n="${esc(n)}" data-m="${m}"><b>${esc(n)}</b><input type="number" step="0.5" min="0" class="sc" inputmode="decimal" value="${c?esc(c.score):''}"><span class="mx">/ ${m}</span><input type="text" class="nt" value="${c?esc(c.note||''):''}"></div>`;}).join('')
    +`<div class="wc-row" data-new="1"><input type="text" class="nm" placeholder="Bài khác…"><input type="number" step="0.5" min="0" class="sc"><input type="number" class="mxi" value="10" title="Thang điểm"><input type="text" class="nt"></div>`;
}
const W_CHIPS=['Tuần này con đi học đầy đủ, làm BTVN nghiêm túc.','Con tiến bộ rõ ở Part 5: đã biết gạch từ khoá và tìm câu trong truyện.','Con còn chép thừa từ / sai chính tả ở Part 5, tuần sau cô luyện thêm.',
  'Con làm Part 3 tốt hơn, chọn từ theo loại từ đúng hơn.','Listening/Reading của con tăng so với tuần trước, tiếp tục giữ nhịp nhé.','Writing con cần viết đủ ý và kiểm tra lại ngữ pháp.',
  'Speaking con trả lời tự tin hơn, cần nói dài hơn 2–3 câu.','PH nhắc con làm đủ BTVN và đọc lại sổ lỗi mỗi tối giúp cô ạ.','Tuần sau có bài kiểm tra/thi thử, PH nhắc con ngủ sớm giúp cô ạ.'];
$('#wChips').innerHTML=W_CHIPS.map(t=>`<button type="button">${esc(t)}</button>`).join('');
$$('#wChips button').forEach(b=>b.onclick=()=>{const t=$('#wCmt');t.value=t.value?t.value+'\n'+b.textContent:b.textContent;wDirty=true;drawTW();});
let wDirty=false;
$('#wCmt').addEventListener('input',()=>{wDirty=true;drawTW();});
const wRepId=()=>twSid+'_W'+twMon();
function loadW(){const r=db.reports.find(x=>x.id===wRepId());$('#wCmt').value=r?r.cmt:'';wDirty=false;}
function saveW(quiet){if(!stu(twSid))return;const id=wRepId(),cmt=$('#wCmt').value.trim();let r=db.reports.find(x=>x.id===id);
  if(!r){r={id,studentId:twSid,month:'W'+twMon()};db.reports.push(r);}r.cmt=cmt;SYNC.touch('reports',r);persist();wDirty=false;if(!quiet)toast('Đã lưu nhận xét tuần');}
$('#wSave').onclick=()=>saveW();
const twGo=fn=>{if(wDirty)saveW(true);fn();loadW();renderWC();drawTW();};
$('#wFind').addEventListener('input',()=>twGo(()=>{twLink=null;fillTW();}));
$('#wStudent').onchange=()=>twGo(()=>{twSid=$('#wStudent').value;twLink=null;fillTW();});
$('#wNext').onclick=()=>twGo(()=>{const o=$$('#wStudent option').map(x=>x.value),i=o.indexOf(twSid);if(o.length){twSid=o[(i+1)%o.length];twLink=null;fillTW();}});
$('#wLink').onchange=()=>twGo(()=>{twLink=$('#wLink').value;});
$('#wDay').onchange=()=>twGo(()=>{});
$('#wPrev').onclick=()=>twGo(()=>{$('#wDay').value=addD(twMon(),-7);});
$('#wFwd').onclick=()=>twGo(()=>{$('#wDay').value=addD(twMon(),7);});
$('#wcDate').onchange=renderWC;
$('#wcSave').onclick=()=>{
  const d=$('#wcDate').value,a=twMon(),ids=twIds();if(!d||d<a||d>addD(a,6)){toast('Ngày làm bài phải nằm trong tuần đang chọn');return;}
  let n=0,del=0,bad=0;
  $$('#wcList .wc-row[data-n],#wcList .wc-row[data-new]').forEach(r=>{
    const name=r.dataset.n||r.querySelector('.nm').value.trim(),max=+(r.dataset.m||r.querySelector('.mxi').value)||10,v=r.querySelector('.sc').value.trim(),note=r.querySelector('.nt').value.trim();
    if(!name)return;const old=db.checks.find(c=>ids.includes(c.studentId)&&c.date===d&&c.name===name);
    if(v===''){if(old){SYNC.remove('checks',old.id);db.checks=db.checks.filter(x=>x!==old);del++;}return;}
    if(+v<0||+v>max){bad++;return;}
    const c=old||{id:uid(),studentId:twSid};Object.assign(c,{date:d,name,score:+v,max,note});if(!old)db.checks.push(c);SYNC.touch('checks',c);n++;});
  persist();renderWC();drawTW();toast(bad?`⚠️ ${bad} điểm lớn hơn thang điểm – chưa lưu ô đó`:`Đã lưu ${n} điểm`+(del?`, xoá ${del}`:''));
};
function renderTW(){fillTW();if(!$('#wDay').value)$('#wDay').value=today();if(!wDirty)loadW();renderWC();drawTW();}
const scTx=c=>c?`<span class="hw">${esc(c.score)}</span>/${esc(c.max)}${band(c.name||'',c.score,c.max)}`:'—';
const trend=(c,p)=>{if(!c||!p)return '';const x=c.score/(c.max||10),y=p.score/(p.max||10);return x>y+1e-9?'<span class="up">↑</span>':x<y-1e-9?'<span class="dn">↓</span>':'<span class="eq">=</span>';};
function weekSheet(){
  const D=weekData();if(!D)return '';
  const {s,a,b,sess,prog,done,tot,exam,ten,next,learn}=D,L=window.LOGO||'',cmt=$('#wCmt').value.trim(),[ay]=[a.slice(0,4)];
  const left=exam?Math.round((new Date(exam+'T00:00:00')-new Date(today()+'T00:00:00'))/864e5):null;
  const multi=D.ids.length>1,tag=id=>{if(!multi)return '';const x=stu(id);return x&&x.cls?` <small>(${esc(x.cls)})</small>`:'';};
  const gram=x=>{const l=learn.find(z=>z.d===x.fDate&&z.id===x.studentId);return l?esc(l.k):esc(String(x.fGram||'').split('\n').filter(Boolean).slice(0,2).join(' · '));};
  const rows=sess.length?`<table class="bc-tbl"><tr><th style="width:74px">Ngày</th><th>Nội dung đã học</th><th style="width:64px">BTVN</th><th style="width:70px">Khảo từ</th></tr>`
    +sess.map(x=>`<tr><td class="c">${esc(thu(x.fDate))} ${dmS(x.fDate)}${tag(x.studentId)}${x.bu?'<div style="font-size:10.5px;font-weight:700;color:var(--g2)">học bù</div>':''}</td>`+(x.abs?`<td colspan="3"><b class="dn">Nghỉ ${x.abs==='cp'?'có phép':'không phép'}</b>${x.fMakeup?' · học bù '+esc(x.fMakeup):''}</td>`
      :`<td>${gram(x)}</td><td class="c">${x.hw==='none'?'—':(x.fPct!==''&&x.fPct!=null?`<span class="hw">${+x.fPct}%</span>`:'—')}</td><td class="c">${x.fVScore!==''&&x.fVScore!=null?`<span class="hw">${esc(x.fVScore)}</span>/${esc(x.fVNum||'?')}`:'—'}</td>`)+'</tr>').join('')+'</table>'
    :'<div class="bc-none">Tuần này con chưa có buổi học nào được ghi phiếu.</div>';
  // mục 2 "Điểm kiểm tra" (cô sửa 2026-11-19): cột Đầu vào / Tuần trước chỉ hiện khi có điểm, tiêu đề cột to + căn giữa
  const hF=prog.some(r=>r.first),hP=prog.some(r=>r.prev);
  const pr=prog.length?`<table class="bc-tbl bw-kt"><tr><th>Bài kiểm tra</th>${hF?'<th style="width:96px">Đầu vào</th>':''}${hP?'<th style="width:104px">Tuần trước</th>':''}<th style="width:110px">${hF||hP?'Tuần này':'Điểm'}</th></tr>`
    +prog.map(r=>`<tr><td>${esc(r.n)}${r.cur.note?`<div><span class="hw" style="font-size:13px">${esc(r.cur.note)}</span></div>`:''}</td>${hF?`<td class="c">${scTx(r.first)}</td>`:''}${hP?`<td class="c">${scTx(r.prev)}</td>`:''}<td class="c"><b>${scTx(r.cur)}</b></td></tr>`).join('')+'</table>'
    :'<div class="bc-none">Tuần này chưa có điểm kiểm tra.</div>';
  const nx=next.length?`<div class="bw-next">${next.slice(0,6).map(n=>`<div><b class="d">${esc(thu(n.d))} ${dmS(n.d)}</b><span>${/ki[eể]m tra|thi th[uử]/i.test(n.k)?`<span class="kt">${esc(n.k)}</span>`:esc(n.k)}${tag(n.id)}</span></div>`).join('')}</div>`:'';
  return `<div class="sheet c2 rw bc bw f-lora">
   <img class="wm" src="${L}">
   <div class="in">
    <div class="sh-top"><img class="logo" src="logo-c2.png"><div class="sh-motto">KIÊN TRÌ - YÊU THƯƠNG - TIẾN BỘ</div><div class="sh-tag">MS. MINH THƯ</div></div>
    <div class="sh-title">BÁO CÁO TUẦN</div>
    <div class="sh-sub">TUẦN ${dmS(a)} – ${dmS(b)}/${b.slice(0,4)}${ten.length?' · '+esc(ten.join(' + ').toUpperCase()):''}</div>
    <div class="sh-info">
      <div><div class="sh-lab">HỌ TÊN HỌC VIÊN | LỚP</div><div class="sw o"><div class="sh-box"><span class="hw">${esc(s.name)}${s.cls?' | '+esc(s.cls):''}</span></div></div></div>
      <div><div class="sh-lab">LỘ TRÌNH ĐÃ HỌC</div><div class="sw o"><div class="sh-box">${tot?`<span class="hw">${done}</span>&nbsp;<b>/ ${tot} buổi</b>`:'<b>—</b>'}</div></div></div>
      <div><div class="sh-lab">NGÀY THI (CÒN)</div><div class="sw o"><div class="sh-box" style="white-space:nowrap">${exam?`<span class="hw">${dmS(exam)}</span>&nbsp;<b>(${Math.max(0,left)} ngày)</b>`:'<b>—</b>'}</div></div></div>
    </div>
    <div class="sh-h n1">CÁC BUỔI HỌC TRONG TUẦN</div>
    ${rows}
    <div class="sh-h n2">ĐIỂM KIỂM TRA</div>
    ${pr}
    ${nx?`<div class="sh-h n3">CÁC BUỔI SẮP TỚI</div>${nx}`:''}
    <div class="sh-h n${nx?4:3}">NHẬN XÉT CỦA GIÁO VIÊN</div>
    <div class="bc-cmt"><div class="tx">${cmt?`<span class="hw">${esc(cmt)}</span>`:'<span class="ph">(Cô viết nhận xét ở ô bên trái)</span>'}</div></div>
   </div>
   <div class="sh-foot"><div><span>THÔNG TIN LIÊN HỆ</span><span>SĐT: 0966.101.957 (Ms. Minh Thư)</span><span>GROW WITH ENGLISH</span></div></div>
  </div>`;
}
function drawTW(){
  const D=weekData();
  $('#wInfo').innerHTML=D?`Tuần ${dmS(D.a)} – ${dmS(D.b)}: ${D.sess.length} buổi · ${D.ck.length} điểm kiểm tra${D.tot?` · lộ trình ${D.done}/${D.tot}`:' · <span style="color:#b23">em chưa có lộ trình trên máy này</span>'}${D.exam?` · thi ${dmS(D.exam)}`:''}`:'';
  const ex=$('#bwExport');ex.innerHTML=weekSheet();fitCmt(ex);$('#bwPrev').innerHTML=ex.innerHTML;fitPrevW();
}
function fitPrevW(){const wrap=$('#bwPrevWrap'),el=$('#bwPrev');wrap.style.width='';const w=wrap.clientWidth;if(!w)return;
  const sh=el.firstElementChild?el.firstElementChild.offsetHeight:0;let k=w/630;
  if(innerWidth>900&&sh){const card=wrap.closest('.card'),other=card.offsetHeight-wrap.offsetHeight;k=Math.max(.45,Math.min(k,(innerHeight-76-12-other)/sh));wrap.style.width=630*k+'px';}
  el.style.transform=`scale(${k})`;wrap.style.height=sh*k+'px';}
addEventListener('resize',()=>{if(tab==='tw')fitPrevW();});
const wPng=()=>{const s=stu(twSid);return `BaoCaoTuan_${fileSafe(s?s.name:'HS')}_${twMon()}.png`;};
async function makeWPNG(){
  if(!window.html2canvas){toast('Chưa tải được công cụ chụp ảnh – kiểm tra mạng internet');throw new Error('no html2canvas');}
  if(!stu(twSid)){toast('Chọn học sinh trước đã ạ');throw new Error('no student');}
  if(wDirty)saveW(true);await document.fonts.ready;drawTW();
  const c=await html2canvas($('#bwExport .sheet'),{scale:2,backgroundColor:'#ffffff',logging:false});
  return new Promise(res=>c.toBlob(res,'image/png'));
}
$('#wDown').onclick=async()=>{try{download(await makeWPNG(),wPng());}catch(e){console.error(e);}};
$('#wCopy').onclick=async()=>{if(!stu(twSid)){toast('Chọn học sinh trước đã ạ');return;}try{
  await navigator.clipboard.write([new ClipboardItem({'image/png':makeWPNG()})]);toast('Đã sao chép ảnh – vào nhóm Zalo bấm Ctrl+V');openZalo();
}catch(e){console.error(e);toast('Trình duyệt không cho sao chép ảnh – đã tải ảnh về máy');try{download(await makeWPNG(),wPng());openZalo();}catch(_){}}};
$('#wShare').onclick=async()=>{try{const b=await makeWPNG(),f=new File([b],wPng(),{type:'image/png'});
  if(navigator.canShare&&navigator.canShare({files:[f]}))await navigator.share({files:[f]});
  else{download(b,wPng());toast('Máy này không hỗ trợ chia sẻ trực tiếp – đã tải ảnh về');}}catch(e){if(e.name!=='AbortError')console.error(e);}};

/* ---------- Đồng bộ + khởi động ---------- */
const SYNC=createSync({app:'bao-cao',cols:['students','sessions','tests','checks','reports'],get:c=>db[c],set:(c,a)=>db[c]=a,save:persist,onChange:()=>{
  // đang gõ dở trong bảng điểm thì không vẽ lại (mất số đang gõ)
  if(tab==='kt'&&$('#v-kt').contains(document.activeElement)){fillCls();return;}
  renderAll();}});
$('#appLogo').src=window.LOGO||'';
$('#gMonth').value=lastMon=today().slice(0,7);
// mở thẳng báo cáo tuần từ tab Lộ trình: bao-cao.html#tw=<mã HS>
{const m=location.hash.match(/^#tw(?:=(.+))?/);if(m){if(m[1])twSid=decodeURIComponent(m[1]);tab='tw';
  $$('nav.tabs button').forEach(x=>x.classList.toggle('on',x.dataset.v==='tw'));$$('.view').forEach(v=>v.classList.toggle('on',v.id==='v-tw'));}}
renderAll();
document.fonts&&document.fonts.ready.then(()=>{if(tab==='pt')drawPT();});

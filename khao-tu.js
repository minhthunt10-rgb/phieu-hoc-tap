/* ================= KHẢO TỪ VỰNG (mặt sau phiếu) =================
   TG gõ/dán danh sách từ → bài khảo 20–30 từ, nghĩa Việt → viết Anh.
   Chấm trên giấy (TG bấm ✓/✗) hoặc HS gõ trên máy (tự chấm). Lưu vào db.tests,
   từ sai vào db.vocab[hs] (từ chưa thuộc), điểm tự điền sang mặt trước. */
db.tests=db.tests||[]; db.vocab=db.vocab||{};
let kt=db.kt||{studentId:'',date:today(),no:'',unit:'Unit ',n:30,raw:'',items:[],testId:null};
if(!kt.testId&&kt.date!==today()){kt.date=today();kt.items.forEach(x=>{x.ans='';x.ok=null;});}
const VN=/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
let ktTimer=null;
function ktKeep(){db.kt=kt;clearTimeout(ktTimer);ktTimer=setTimeout(()=>{persist();ktRender();},150);}

/* ---------- Đọc 1 dòng: "1. coupon (n) /ˈkuːpɒn/ – phiếu giảm giá" → {en,vi} ---------- */
function parseLine(line){
  let s=String(line).replace(/^[\s•·*>\-–—]*\(?\d{1,3}\s*[.)\/:\-–]?\s+/,'').replace(/^[\s•·*]+/,'').trim();
  if(!s)return null;
  s=s.replace(/\/[^\/]*[əˈˌʃʒθðŋæɪʊɔɑɜʌː':0-9][^\/]*\//g,' ').replace(/\[[^\]]*\]/g,' ')
     .replace(/\((?:n|v|a|adj|adv|prep|conj|pron|phr\.?\s*v|n\.?\s*phr|v\.?\s*phr|idm?|exp|np|vp)\.?\)/gi,' ').replace(/\s{2,}(?=\S)/g,m=>m.length>=3?m:' ');
  let en='',vi='';
  const m=/\s+-+\s*|\s*-+\s+|[–—]+|\s*[:=→⇒|\t]\s*|\s{3,}/.exec(s);
  if(m&&m.index>0){en=s.slice(0,m.index);vi=s.slice(m.index+m[0].length);
    if(VN.test(en)&&!VN.test(vi))[en,vi]=[vi,en];}
  else{const tk=s.split(/\s+/),i=tk.findIndex(t=>VN.test(t));
    if(i<0)en=s; else if(i===0)vi=s; else{en=tk.slice(0,i).join(' ');vi=tk.slice(i).join(' ');}}
  const cl=x=>x.replace(/\s+/g,' ').replace(/^[\s,.;:\-–]+|[\s,.;:\-–]+$/g,'');
  en=cl(en);vi=cl(vi);
  return en||vi?{en,vi}:null;
}
// dòng chỉ có tiếng Anh + dòng sau chỉ có nghĩa (chữ chép từ Lens hay tách dòng) → ghép thành 1 cặp
const parseRaw=t=>String(t).split(/\n/).map(parseLine).filter(Boolean)
  .reduce((a,w)=>{const p=a[a.length-1];if(p&&p.en&&!p.vi&&!w.en&&w.vi)p.vi=w.vi;else a.push(w);return a;},[]);
$('#kNorm').onclick=()=>{const w=parseRaw($('#kRaw').value);
  kt.raw=$('#kRaw').value=w.map(x=>`${x.en||'?'} – ${x.vi||'?'}`).join('\n');ktKeep();
  toast(`${w.length} từ`+(w.some(x=>!x.en||!x.vi)?' – sửa các chỗ có dấu "?"':''));};

/* ---------- Chấm: không phân biệt hoa thường, bỏ "to ", chấp nhận đáp án a/b ---------- */
const kNorm=s=>String(s||'').normalize('NFC').toLowerCase().replace(/\([^)]*\)/g,' ').replace(/[’‘`]/g,"'")
  .replace(/[^\p{L}\p{N}' -]/gu,' ').replace(/\s+/g,' ').trim().replace(/^to /,'');
function kCheck(ans,en){
  const a=kNorm(ans); if(!a)return false;
  const alts=String(en).split(/\s*[\/;,]\s*/).concat([en]).map(kNorm).filter(Boolean);
  return alts.includes(a);
}
const kScore=()=>kt.items.filter(x=>x.ok===true).length;

/* ---------- Giao diện ---------- */
function ktOpen(){
  const opts=db.students.slice().sort(byKhoi).map(s=>`<option value="${s.id}">${esc(s.name)}${s.cls?' – '+esc(s.cls):''}</option>`).join('');
  $('#kStudent').innerHTML=db.students.length?opts:'<option value="">(Chưa có học sinh)</option>';
  if(!stu(kt.studentId)){kt.studentId=$('#kStudent').value;ktDefaults();}
  $('#kStudent').value=kt.studentId;
  ['date','no','unit','n'].forEach(k=>$('#k_'+k).value=kt[k]??'');ktNBtn();
  $('#kRaw').value=kt.raw||'';
  ktTable();ktHist();ktPool();ktRender();
}
function ktDefaults(){ // buổi số + bài lấy từ phiếu mặt trước
  const s=stu(kt.studentId); if(!s)return;
  const ss=sessOf(s.id), same=ss.find(x=>x.fDate===kt.date), last=ss[ss.length-1];
  kt.no=same?same.fNo:nextNo(s);
  const u=same?same.fVUnit:(last&&last.fNVUnit);
  if(u&&u.trim()!=='Unit')kt.unit=u;
  const n=same?same.fVNum:(last&&last.fNVNum); if(n)kt.n=+n;
}
function ktPool(){
  const p=db.vocab[kt.studentId]||[];
  $('#kPoolN').textContent=p.length;
  $('#kPoolList').innerHTML=p.length?p.map(w=>`<span class="pill" title="Sai từ ${esc(w.since||'')}">${esc(w.en)} – ${esc(w.vi)}</span>`).join(' '):'<span class="hint">Chưa có từ nào.</span>';
}
$('#kStudent').onchange=()=>{
  kt.studentId=$('#kStudent').value;
  if(kt.testId||kt.items.some(x=>x.ans||x.ok!=null)){kt.items.forEach(x=>{x.ans='';x.ok=null;});kt.testId=null;}
  ktDefaults();['no','unit','n'].forEach(k=>$('#k_'+k).value=kt[k]??'');ktNBtn();
  ktTable();ktHist();ktPool();ktKeep();
};
['date','no','unit','n'].forEach(k=>$('#k_'+k).addEventListener('input',()=>{kt[k]=$('#k_'+k).value;if(k==='date'){ktDefaults();$('#k_no').value=kt.no;}if(k==='n')ktNBtn();ktKeep();}));
// nút chọn nhanh số từ (20/25/30), ô số để gõ số khác
function ktNBtn(){$$('.kn button').forEach(b=>b.classList.toggle('on',+b.dataset.n===+kt.n));}
$$('.kn button').forEach(b=>b.onclick=()=>{kt.n=+b.dataset.n;$('#k_n').value=kt.n;ktNBtn();ktKeep();});
$('#kRaw').addEventListener('input',()=>{kt.raw=$('#kRaw').value;ktKeep();});

/* ---------- Tạo bài khảo ---------- */
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
$('#kMake').onclick=()=>{
  if(!kt.studentId){toast('Chọn học sinh trước đã ạ');return;}
  const n=+kt.n||30, seen=new Set(), uniq=w=>{const k=kNorm(w.en)||kNorm(w.vi);if(!k||seen.has(k))return false;seen.add(k);return true;};
  let pick=parseRaw($('#kRaw').value).filter(uniq);
  if(!pick.length){toast('Chưa có từ nào – gõ hoặc dán danh sách từ');return;}
  if(kt.items.some(x=>x.ans||x.ok!=null)&&!confirm('Tạo bài mới sẽ xoá phần chấm hiện tại. Tiếp tục?'))return;
  if(pick.length>n)pick=shuffle(pick.slice()).slice(0,n);
  if($('#kShuf').checked)shuffle(pick);
  kt.items=pick.map(w=>({en:w.en,vi:w.vi,ans:'',ok:null})); kt.testId=null;
  ktTable();ktKeep();
  const miss=kt.items.filter(x=>!x.vi||!x.en).length;
  toast(`Đã tạo bài khảo ${kt.items.length} từ`+(kt.items.length<n?` (danh sách chỉ có ${kt.items.length} từ)`:'')+(miss?` – ${miss} từ còn thiếu nghĩa/đáp án`:''));
};

function ktTable(){
  const T=$('#kTable');
  if(!kt.items.length){T.innerHTML='<p class="hint">Chưa có bài khảo – làm bước 2 trước.</p>';ktScoreTag();return;}
  // mỗi từ 1 khối: nghĩa + đáp án hiện đủ chữ (tự xuống dòng), dưới là ô HS viết + nút chấm
  T.innerHTML=kt.items.map((x,i)=>
    `<div class="kr" data-i="${i}"><b>${i+1}</b><div class="kr-w"><textarea rows="1" data-k="vi" placeholder="nghĩa">${esc(x.vi)}</textarea><textarea rows="1" data-k="en" placeholder="đáp án" autocapitalize="off" spellcheck="false">${esc(x.en)}</textarea></div>
     <div class="kr-g"><input type="text" data-k="ans" value="${esc(x.ans)}" placeholder="HS viết (nếu sai)" autocomplete="off" autocapitalize="off" spellcheck="false">
     <button type="button" class="mk ok">✓</button><button type="button" class="mk no">✗</button></div></div>`).join('');
  const grow=t=>{t.style.height='auto';if(t.scrollHeight)t.style.height=t.scrollHeight+2+'px';};
  T.querySelectorAll('textarea').forEach(grow);
  T.querySelectorAll('.kr').forEach(tr=>{
    const x=kt.items[+tr.dataset.i];
    tr.querySelectorAll('input,textarea').forEach(inp=>inp.addEventListener('input',()=>{
      if(inp.tagName==='TEXTAREA'){inp.value=inp.value.replace(/\n/g,' ');grow(inp);}
      x[inp.dataset.k]=inp.value.trim();
      if(inp.dataset.k!=='vi'&&x.ans)x.ok=kCheck(x.ans,x.en);
      ktMarks(tr,x);ktKeep();}));
    tr.querySelector('.ok').onclick=()=>{x.ok=x.ok===true?null:true;ktMarks(tr,x);ktKeep();};
    tr.querySelector('.no').onclick=()=>{x.ok=x.ok===false?null:false;ktMarks(tr,x);ktKeep();};
    ktMarks(tr,x);
  });
}
function ktMarks(tr,x){tr.querySelector('.ok').classList.toggle('on',x.ok===true);tr.querySelector('.no').classList.toggle('on',x.ok===false);ktScoreTag();}
function ktScoreTag(){const g=kt.items.filter(x=>x.ok!=null).length;
  $('#kScoreTag').textContent=kt.items.length?`Đúng ${kScore()}/${kt.items.length}`+(g<kt.items.length?` · còn ${kt.items.length-g} từ chưa chấm`:''):'';}
$('#kAllOk').onclick=()=>{kt.items.forEach(x=>x.ok=true);ktTable();ktKeep();toast('Đã tích đúng hết – bấm ✗ ở các từ HS viết sai');};
$('#kClear').onclick=()=>{kt.items.forEach(x=>x.ok=null);ktTable();ktKeep();};

/* ---------- HS làm trên máy ---------- */
$('#kStuMode').onclick=()=>{
  if(!kt.items.length){toast('Tạo bài khảo trước đã ạ');return;}
  const s=stu(kt.studentId)||{name:''};
  $('#kStuName').textContent=s.name;
  $('#kStuList').innerHTML=kt.items.map((x,i)=>`<div class="stu-row"><b>${i+1}</b><div class="vi">${esc(x.vi)||'<i class="hint">(chưa có nghĩa)</i>'}</div>
    <input type="text" data-i="${i}" value="${esc(x.ans)}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="next" placeholder="Viết từ tiếng Anh…"></div>`).join('');
  const ins=$$('#kStuList input');
  ins.forEach((inp,i)=>inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();(ins[i+1]||$('#kSubmit')).focus();}}));
  $('#kStu').classList.add('on');document.body.style.overflow='hidden';$('#kStu').scrollTop=0;
  setTimeout(()=>ins[0]&&ins[0].focus(),50);
};
function ktStuClose(){$('#kStu').classList.remove('on');document.body.style.overflow='';}
$('#kSubmit').onclick=()=>{
  const ins=$$('#kStuList input'), blank=ins.filter(i=>!i.value.trim()).length;
  if(blank&&!confirm(`Con còn ${blank} từ chưa viết. Nộp bài luôn?`))return;
  ins.forEach(inp=>{const x=kt.items[+inp.dataset.i];x.ans=inp.value.trim();x.ok=kCheck(x.ans,x.en);});
  ktStuClose();ktTable();ktKeep();
  toast(`Con đúng ${kScore()}/${kt.items.length} từ. TG xem lại và sửa ✓/✗ nếu cần.`);
};
$('#kStuExit').onclick=()=>{
  $$('#kStuList input').forEach(inp=>{kt.items[+inp.dataset.i].ans=inp.value.trim();});
  ktStuClose();ktTable();ktKeep();
};

/* ---------- Lưu: kết quả + từ chưa thuộc + điểm mặt trước ---------- */
function ktSave(){
  if(!kt.studentId||!kt.items.length){toast('Chưa có bài khảo để lưu');return null;}
  if(!kt.date){toast('Chưa chọn ngày');return null;}
  const left=kt.items.filter(x=>x.ok==null).length;
  if(left&&!confirm(`Còn ${left} từ chưa chấm (tính là chưa thuộc). Vẫn lưu?`))return null;
  kt.items.forEach(x=>{if(x.ok==null)x.ok=false;});
  const t={id:kt.testId||uid(),studentId:kt.studentId,date:kt.date,no:kt.no,unit:(kt.unit||'').trim(),n:kt.items.length,
    items:kt.items.map(x=>({en:x.en,vi:x.vi,ans:x.ans,ok:x.ok})),score:kScore(),created:Date.now()};
  const i=db.tests.findIndex(x=>x.id===t.id); if(i>=0)db.tests[i]=t; else db.tests.push(t);
  kt.testId=t.id;
  // từ sai → danh sách chưa thuộc; từ đúng → bỏ khỏi danh sách
  let p=db.vocab[t.studentId]||[];
  t.items.forEach(x=>{const k=kNorm(x.en);if(!k)return;const j=p.findIndex(w=>kNorm(w.en)===k);
    if(x.ok){if(j>=0)p.splice(j,1);} else if(j<0)p.push({en:x.en,vi:x.vi,since:t.date}); else p[j].vi=x.vi||p[j].vi;});
  db.vocab[t.studentId]=p;
  // điền điểm sang mặt trước (phiếu đã lưu cùng ngày + phiếu đang mở)
  const unit=t.unit&&t.unit!=='Unit'?t.unit:'';
  let synced=0;
  db.sessions.filter(x=>x.studentId===t.studentId&&x.fDate===t.date).forEach(x=>{x.fVScore=t.score;x.fVNum=t.n;if(unit)x.fVUnit=unit;synced++;});
  const f=readForm();
  if(f.studentId===t.studentId&&f.fDate===t.date){$('#fVScore').value=t.score;$('#fVNum').value=t.n;if(unit)$('#fVUnit').value=unit;updatePreview();synced=1;}
  persist();ktTable();ktHist();ktPool();ktRender();
  toast(`Đã lưu: đúng ${t.score}/${t.n}`+(synced?' – đã điền điểm vào mặt trước':' – khi mở phiếu mặt trước ngày này, điểm tự điền'));
  return t;
}
$('#kSave').onclick=ktSave;
$('#kNextStu').onclick=()=>{
  if(!ktSave())return;
  const list=$$('#kStudent option').map(o=>o.value), i=list.indexOf(kt.studentId), cls=(stu(kt.studentId).cls||'');
  const nxt=list.slice(i+1).find(id=>(stu(id).cls||'')===cls)||list[(i+1)%list.length];
  $('#kStudent').value=nxt; kt.testId=null; kt.items.forEach(x=>{x.ans='';x.ok=null;});
  if($('#kShuf').checked)shuffle(kt.items);
  $('#kStudent').onchange(); window.scrollTo({top:0,behavior:'smooth'});
};

function ktHist(){
  const list=db.tests.filter(x=>x.studentId===kt.studentId).sort((a,b)=>b.date.localeCompare(a.date)||b.created-a.created);
  $('#kHist').innerHTML=list.length?'<tr><th>Ngày</th><th>Bài</th><th>Điểm</th><th></th></tr>'+list.map(t=>{const[d,m]=dmy(t.date);
    return `<tr><td>${d}/${m}</td><td>${esc(t.unit)}</td><td><b>${t.score}/${t.n}</b></td><td style="white-space:nowrap">
    <button class="btn" data-a="op" data-id="${t.id}" style="padding:5px 9px">Mở</button> <button class="btn r" data-a="del" data-id="${t.id}" style="padding:5px 9px">Xóa</button></td></tr>`;}).join('')
    :'<tr><td class="hint">Chưa có bài khảo nào của HS này.</td></tr>';
  $$('#kHist button').forEach(b=>b.onclick=()=>{const t=db.tests.find(x=>x.id===b.dataset.id);
    if(b.dataset.a==='op'){Object.assign(kt,{date:t.date,no:t.no,unit:t.unit,n:t.n,items:t.items.map(x=>({...x})),testId:t.id});
      ['date','no','unit','n'].forEach(k=>$('#k_'+k).value=kt[k]??'');ktTable();ktKeep();window.scrollTo({top:0,behavior:'smooth'});}
    if(b.dataset.a==='del'&&confirm('Xóa bài khảo này?')){db.tests=db.tests.filter(x=>x.id!==t.id);if(kt.testId===t.id)kt.testId=null;persist();ktHist();}
  });
}
$('#kPoolClear').onclick=()=>{if(confirm('Xoá hết danh sách từ chưa thuộc của HS này?')){db.vocab[kt.studentId]=[];persist();ktPool();}};

/* ---------- Ảnh mặt sau ---------- */
function ktSheetHTML(blank){
  const s=stu(kt.studentId)||{name:'',cls:''}, [d,m,y]=dmy(kt.date), L=window.LOGO||'';
  const its=kt.items, rows=Math.max(1,Math.ceil(its.length/3));
  const cell=(x,i)=>{
    let a='',mk='';
    if(!blank){
      if(x.ok===true){a=`<span class="hw bl">${esc(x.ans||x.en)}</span>`;mk='✓';}
      else if(x.ok===false){a=(x.ans?`<span class="hw bl st">${esc(x.ans)}</span> `:'')+`<span class="hw">${esc(x.en)}</span>`;mk='✗';}
      else if(x.ans)a=`<span class="hw bl">${esc(x.ans)}</span>`;
    }
    return `<div class="kt-it"><span class="kt-n">${i+1}</span><div class="kt-c"><div class="kt-vi one" data-max="12.5" data-min="8">${esc(x.vi)}</div><div class="kt-a one" data-max="15" data-min="9">${a}</div></div><span class="kt-mk">${mk}</span></div>`;
  };
  const wrong=its.filter(x=>x.ok===false);
  const miss=blank?'':`<div class="sh-h green">TỪ CHƯA THUỘC – CON HỌC LẠI NHÉ</div>
    <div class="sw g"><div class="kt-miss">${wrong.length?wrong.map((x,i)=>`<div>${i+1}. <span class="hw">${esc(x.en)}</span> – ${esc(x.vi)}</div>`).join('')
      +'<div class="nt">Con viết mỗi từ 3 lần và học thuộc, buổi sau cô khảo lại các từ này ạ.</div>'
      :'<div class="ok"><span class="hw">Con thuộc hết các từ hôm nay. Giỏi lắm! 🎉</span></div>'}</div></div>`;
  const unit=(kt.unit||'').trim();
  return `<div class="sheet kt ${db.cfg.font==='print'?'print':''}">
   <img class="wm" src="${L}">
   <div class="in">
    <div class="sh-top"><img class="logo" src="${L}"><div class="sh-motto">KIÊN TRÌ - YÊU THƯƠNG - TIẾN BỘ</div><div class="sh-tag">MS. MINH THƯ</div></div>
    <div class="sh-title">📚 PHIẾU HỌC TẬP 📚</div>
    <div class="sh-badge">${esc(kt.no)||1}</div>
    <div class="sh-sub">THEO DÕI TIẾN ĐỘ HỌC TẬP VÀ ĐÁNH GIÁ CỦA HỌC VIÊN</div>
    <div class="sh-info">
      <div><div class="sh-lab">HỌ TÊN HỌC VIÊN | LỚP</div><div class="sw o"><div class="sh-box"><span class="hw">${esc(s.name)}${s.cls?' | '+esc(s.cls):''}</span></div></div></div>
      <div><div class="sh-lab">NGÀY HỌC</div><div class="sw o"><div class="sh-box"><span class="hw">${d}</span>&nbsp;<b>/</b>&nbsp;<span class="hw">${m}</span>&nbsp;<b>/ ${y||'2026'}</b></div></div></div>
      <div><div class="sh-lab">SỐ BUỔI / 1 KHÓA</div><div class="sw o"><div class="sh-box"><span class="hw">${two(kt.no)}</span>&nbsp;<b>/</b>&nbsp;<span class="hw">${esc(s.total||'')}</span></div></div></div>
    </div>
    <div class="sh-h navy">KHẢO TỪ VỰNG${unit&&unit!=='Unit'?` – <span class="hw" style="font-size:19px">${esc(unit)}</span>`:''}</div>
    <div class="kt-sub">Đọc nghĩa tiếng Việt – viết từ tiếng Anh</div>
    <div class="sw p"><div class="kt-box">
      <div class="kt-grid" style="grid-template-rows:repeat(${rows},auto)">${its.map(cell).join('')}</div>
      <div class="kt-tot">TỔNG: <div class="sh-box"><span class="hw">${blank?'':kScore()}</span>&nbsp;<b>/ ${its.length}</b></div></div>
    </div></div>
    ${miss}
   </div>
   <div class="sh-foot"><div><span>THÔNG TIN LIÊN HỆ</span><span>SĐT: 0966.101.957 (Ms. Minh Thư)</span><span>GROW WITH ENGLISH</span></div></div>
  </div>`;
}
function ktShrink(root){root.querySelectorAll('.one').forEach(el=>{let s=+el.dataset.max;el.style.fontSize=s+'px';
  while(s>+el.dataset.min&&el.scrollWidth>el.clientWidth+.5){s-=.5;el.style.fontSize=s+'px';}});}
function ktRender(blank){
  const h=$('#ktExport'); h.innerHTML=ktSheetHTML(blank); ktShrink(h);
  if(blank)return;
  $('#kPrev').innerHTML=h.innerHTML; ktFitPrev();
}
function ktFitPrev(){const w=$('#kPrevWrap').clientWidth;if(!w)return;const k=w/630,el=$('#kPrev');el.style.transform=`scale(${k})`;
  $('#kPrevWrap').style.height=(el.firstElementChild?el.firstElementChild.offsetHeight*k:0)+'px';}
window.addEventListener('resize',ktFitPrev);

const ktName=blank=>{const s=stu(kt.studentId);const[d,m,y]=dmy(kt.date);
  return `${blank?'DeKhaoTu':'KhaoTu'}_${(s?s.name:'HS').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').replace(/\s+/g,'_')}_${d}-${m}-${y}.png`;};
async function ktPNG(blank){
  if(!window.html2canvas){toast('Chưa tải được công cụ chụp ảnh – kiểm tra mạng internet');throw new Error('no html2canvas');}
  if(!kt.items.length){toast('Chưa có bài khảo');throw new Error('empty');}
  if(!blank&&!ktSave())throw new Error('chưa lưu');
  await document.fonts.ready; ktRender(blank);
  const c=await html2canvas($('#ktExport .sheet'),{scale:2,backgroundColor:'#ffffff',logging:false});
  if(blank)ktRender();
  return new Promise(res=>c.toBlob(res,'image/png'));
}
function ktMsg(){const s=stu(kt.studentId)||{name:''};const[d,m]=dmy(kt.date);const w=kt.items.filter(x=>x.ok===false).length;
  return `Ms. Minh Thư gửi phụ huynh kết quả khảo từ vựng ngày ${d}/${m} của con ${s.name.split(' ').pop()}: đúng ${kScore()}/${kt.items.length} từ.`+
    (w?` ${w} từ con chưa thuộc cô ghi ở cuối phiếu, PH nhắc con học lại giúp cô ạ.`:' Con thuộc hết, PH khen con giúp cô nhé ạ!');}
$('#kDown').onclick=async()=>{try{download(await ktPNG(),ktName());}catch(e){console.error(e);}};
$('#kBlank').onclick=async()=>{try{download(await ktPNG(true),ktName(true));}catch(e){console.error(e);}};
$('#kCopy').onclick=async()=>{try{const b=await ktPNG();await navigator.clipboard.write([new ClipboardItem({'image/png':b})]);toast('Đã sao chép ảnh – mở Zalo và bấm Ctrl+V');}
  catch(e){console.error(e);if(e.message!=='chưa lưu'&&e.message!=='empty'){toast('Trình duyệt không cho sao chép ảnh – đã tải ảnh về máy');try{download(await ktPNG(),ktName());}catch(_){}}}};
$('#kShare').onclick=async()=>{try{const b=await ktPNG();const f=new File([b],ktName(),{type:'image/png'});
  if(navigator.canShare&&navigator.canShare({files:[f]}))await navigator.share({files:[f],text:ktMsg()});
  else{download(b,ktName());toast('Máy này không hỗ trợ chia sẻ trực tiếp – đã tải ảnh về');}}catch(e){if(e.name!=='AbortError')console.error(e);}};
$('#kMsg').onclick=async()=>{try{await navigator.clipboard.writeText(ktMsg());toast('Đã sao chép lời nhắn');}catch(e){prompt('Sao chép lời nhắn:',ktMsg());}};

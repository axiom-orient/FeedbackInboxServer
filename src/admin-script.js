export default String.raw`
const el=id=>document.getElementById(id);
let filter='open', release='', system='', current, cursor, before, busy=false;
const drafts=JSON.parse(sessionStorage.getItem('sumday.feedback.drafts')||'{}');
let pending=JSON.parse(sessionStorage.getItem('sumday.feedback.pending')||'null');
const saveDraft=()=>{if(current){drafts[current.id]=el('body').value;sessionStorage.setItem('sumday.feedback.drafts',JSON.stringify(drafts));}};
async function api(path,body){
 const response=await fetch('/admin'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,credentials:'same-origin',redirect:'error'});
 const value=await response.json();if(!response.ok){const error=new Error(value.error||'서버 오류');error.code=value.error;throw error;}return value;
}
async function run(work){if(busy)return;busy=true;el('error').textContent='';el('notice').textContent='';document.querySelectorAll('button,select').forEach(x=>x.disabled=true);
 try{await work();}catch(error){el('error').textContent='처리 결과를 확인하지 못했습니다: '+error.message;}
 finally{busy=false;document.querySelectorAll('button,select').forEach(x=>x.disabled=false);}}
function node(tag,text){const n=document.createElement(tag);n.textContent=text;return n;}
function selectOptions(id,rows,label){
 const selected=el(id).value, previous=el(id).selectedOptions[0]?.textContent;
 el(id).replaceChildren(new Option(id==='release'?'모든 버전':'모든 OS',''));
 for(const row of rows)el(id).add(new Option(label(row),JSON.stringify(row)));
 if(selected&&!Array.from(el(id).options).some(o=>o.value===selected))el(id).add(new Option(previous,selected));
 el(id).value=selected;
}
async function loadSettings(){
 const settings=await api('/settings');
 el('appName').textContent=settings.app.name+' 문의함';document.title=settings.app.name+' · Private Inbox';
 el('appID').textContent=settings.app.id;
 selectOptions('release',settings.releases,r=>(r.version||'버전 미확인')+' · 빌드 '+(r.build||'미확인'));
 selectOptions('system',settings.systems,r=>(r.name||'OS 미확인')+' '+(r.version||''));
}
function listQuery(append){
 const query=new URLSearchParams({status:filter==='closed'?'closed':'open'});
 if(filter==='waiting')query.set('needsReply','1');
 if(release){const value=JSON.parse(release);query.set('appVersion',value.version||'');query.set('appBuild',value.build||'');}
 if(system){const value=JSON.parse(system);query.set('osName',value.name||'');query.set('osVersion',value.version||'');}
 if(append&&cursor)query.set('before',cursor);
 return query.toString();
}
async function loadList(append=false){
 const page=await api('/threads?'+listQuery(append));
 if(!append)el('list').replaceChildren();cursor=page.nextBefore;
 const rows=page.threads;
 for(const t of rows){const article=node('article',''),button=node('button',t.preview||'문의');button.onclick=()=>run(()=>open(t.id));article.append(button);
 if(t.last_body&&t.last_body!==t.preview)article.append(node('p',t.last_body));
 article.append(node('small',[(t.status==='closed'?'종료됨':t.last_sender==='user'?'답변 대기':'답변 보냄'),new Date(t.updated_at*1000).toLocaleString('ko-KR')].join(' · ')));el('list').append(article);}
 if(!el('list').children.length)el('list').append(node('p',release||system?'선택한 환경의 문의가 없습니다. 필터를 초기화해 전체 문의를 확인하세요.':filter==='waiting'?'답변을 기다리는 문의가 없습니다.':'문의가 없습니다.'));
 el('more').hidden=!cursor;document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));
}
function addMessages(messages){for(const m of messages){if(document.getElementById('m-'+m.id))continue;const n=node('div','');n.id='m-'+m.id;n.dataset.sequence=m.sequence;n.className='message '+m.sender;n.append(node('strong',m.sender==='user'?'사용자':'나'),node('p',m.body),node('small',new Date(m.createdAt*1000).toLocaleString('ko-KR')));
 if(m.sender==='user'){const details=node('details','');details.append(node('summary','앱·기기 정보'));const labels={appName:'앱',appID:'앱 식별자',appVersion:'버전',appBuild:'빌드',osName:'OS',osVersion:'OS 버전',deviceModel:'기기 종류',language:'언어'};if(m.clientContext){const dl=node('dl','');for(const [key,label]of Object.entries(labels)){dl.append(node('dt',label),node('dd',m.clientContext[key]||'미확인'));}details.append(dl);}else details.append(node('p','기록된 앱·기기 정보가 없습니다.'));n.append(details);}
 el('messages').append(n);}const ordered=Array.from(el('messages').children).sort((a,b)=>Number(a.dataset.sequence)-Number(b.dataset.sequence));el('messages').append(...ordered);}
async function open(id,append=false){
 if(pending&&pending.thread!==id)throw new Error('미확인 답변의 전송 결과를 먼저 확인하세요.');saveDraft();
 const oldHeight=el('messages').scrollHeight, oldTop=el('messages').scrollTop;
 const page=await api('/threads/'+id+(append&&before?'?before='+before:'?latest=1'));current=page.thread;before=page.previousBefore;
 if(!append)el('messages').replaceChildren();addMessages(page.messages);el('older').hidden=!before;
 el('title').textContent=current.preview||'문의';el('metadata').textContent=current.status==='closed'?'종료된 문의':'비공개 대화';
 el('ai').hidden=!current.agent_summary;el('aiText').textContent=[current.agent_kind,current.agent_priority,current.agent_summary].filter(Boolean).join(' · ');
 el('conversation').hidden=false;el('placeholder').hidden=true;el('reply').hidden=current.status==='closed'&&!(pending&&pending.thread===id);
 el('body').value=pending&&pending.thread===id?pending.body:drafts[id]||'';el('body').readOnly=!!(pending&&pending.thread===id);
 el('send').textContent=pending&&pending.thread===id?'전송 결과 다시 확인':'답변 보내기';el('pendingHelp').hidden=!(pending&&pending.thread===id);
 el('messages').scrollTop=append?oldTop+el('messages').scrollHeight-oldHeight:el('messages').scrollHeight;
}
el('body').oninput=saveDraft;
el('reply').onsubmit=event=>{event.preventDefault();run(async()=>{
 if(!pending){if(!el('body').value.trim())return;if(Array.from(el('body').value).length>5000)throw new Error('5,000자 이내로 적어 주세요.');pending={thread:current.id,id:crypto.randomUUID(),body:el('body').value};sessionStorage.setItem('sumday.feedback.pending',JSON.stringify(pending));}
 el('body').readOnly=true;el('pendingHelp').hidden=false;el('send').textContent='전송 결과 다시 확인';
 let receipt;try{receipt=await api('/threads/'+current.id+'/messages',{id:pending.id,body:pending.body});}
 catch(error){if(['invalid_message','payload_too_large','thread_closed'].includes(error.code)){pending=null;sessionStorage.removeItem('sumday.feedback.pending');el('body').readOnly=false;el('pendingHelp').hidden=true;el('send').textContent='답변 보내기';}throw error;}
 addMessages([receipt.message]);el('messages').scrollTop=el('messages').scrollHeight;el('notice').textContent='답변을 저장했습니다.';
 try{drafts[current.id]='';sessionStorage.setItem('sumday.feedback.drafts',JSON.stringify(drafts));sessionStorage.removeItem('sumday.feedback.pending');}
 catch{el('error').textContent='답변은 저장됐습니다. 브라우저의 전송 정보 정리가 실패했습니다. 같은 답변으로 다시 확인하세요.';return;}
 pending=null;el('body').value='';el('body').readOnly=false;el('pendingHelp').hidden=true;el('send').textContent='답변 보내기';
 try{await loadList();}catch{el('error').textContent='답변은 저장됐습니다. 목록을 새로고침하지 못했습니다. 새로고침을 눌러 다시 확인하세요.';}
 });};
el('close').onclick=()=>{if(pending)return void(el('error').textContent='미확인 답변을 먼저 확인하세요.');if(confirm('이 문의를 종료하면 더 답변할 수 없습니다.'))run(async()=>{await api('/threads/'+current.id+'/close',{});await open(current.id);await loadList();});};
el('block').onclick=()=>{if(confirm('이 설치의 새 문의와 답변 작성을 차단할까요? 기존 원문은 보존됩니다.'))run(async()=>{await api('/installations/'+current.installation_id+'/block',{});el('notice').textContent='설치를 차단했습니다.';});};
el('back').onclick=()=>{if(pending)return void(el('error').textContent='미확인 답변의 전송 결과를 먼저 확인하세요.');saveDraft();current=null;el('conversation').hidden=true;el('placeholder').hidden=false;};
el('more').onclick=()=>run(()=>loadList(true));el('older').onclick=()=>run(()=>open(current.id,true));
el('refresh').onclick=()=>run(async()=>{await loadSettings();await loadList();if(pending)await open(pending.thread);else if(current)await open(current.id);});
async function applyFilters(){
 saveDraft();await loadList();current=null;el('conversation').hidden=true;el('placeholder').hidden=false;
}
function pendingFilterGuard(){
 if(!pending)return false;
 el('error').textContent='미확인 답변의 전송 결과를 먼저 확인하세요.';
 el('release').value=release;el('system').value=system;return true;
}
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{if(pendingFilterGuard())return;run(async()=>{filter=b.dataset.filter;await applyFilters();});});
el('release').onchange=()=>{if(pendingFilterGuard())return;run(async()=>{release=el('release').value;await applyFilters();});};
el('system').onchange=()=>{if(pendingFilterGuard())return;run(async()=>{system=el('system').value;await applyFilters();});};
el('clearFilters').onclick=()=>{if(pendingFilterGuard())return;run(async()=>{release='';system='';el('release').value='';el('system').value='';await applyFilters();});};
run(async()=>{await loadSettings();await loadList();if(pending)await open(pending.thread);});
`;

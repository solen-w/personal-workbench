import {emptyData, uid, validateData, mergeData, sameData, filterTasks} from './core.js';
const $=id=>document.getElementById(id);
const names={all:'全部任务',today:'今日待办',upcoming:'即将到来',completed:'已完成'};
let db, state, token='', view='all', priority='all', editing=null, deleting=null, syncing=false, installPrompt;
let toastTimer; const channel='BroadcastChannel' in window ? new BroadcastChannel('workbench-data') : null;
const fresh=()=>({data:emptyData(),base:emptyData(),repo:'solen-w/personal-workbench-data',lastSync:null,revision:0});
const localDate=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
function toast(message,error=false){$('toast').textContent=message;$('toast').classList.toggle('error',error);$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),error?7000:4000);}
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open('personal-workbench',1);req.onupgradeneeded=()=>req.result.createObjectStore('documents');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(new Error('本地存储无法打开，请检查浏览器是否允许此网站保存数据。'));});}
function read(){return new Promise((resolve,reject)=>{const req=db.transaction('documents').objectStore('documents').get('state');req.onsuccess=()=>resolve(req.result||fresh());req.onerror=()=>reject(new Error('读取本地数据失败。'));});}
// 在同一事务内读取和修改，避免多个标签页用旧数据互相覆盖。
function write(change){return new Promise((resolve,reject)=>{const tx=db.transaction('documents','readwrite'), store=tx.objectStore('documents');let next,failure;const req=store.get('state');req.onsuccess=()=>{try{next=req.result||fresh();change(next);next.revision++;store.put(next,'state');}catch(error){failure=error;tx.abort();}};tx.oncomplete=()=>{state=next;render();channel?.postMessage('updated');resolve(next);};tx.onerror=tx.onabort=()=>reject(failure||new Error('保存失败，可能是设备存储空间不足。请先导出备份。'));});}
const run=fn=>async event=>{try{await fn(event);}catch(error){toast(error.message||'操作失败，请重试。',true);}};
function render(){
  if(!state)return;
  const today=localDate(), tasks=state.data.tasks, pending=tasks.filter(x=>!x.completed), done=tasks.length-pending.length, due=pending.filter(x=>x.due&&x.due<=today).length;
  for(const [key,value] of Object.entries({all:pending.length,today:due,upcoming:pending.filter(x=>x.due&&x.due>today).length,completed:done})) $('count-'+key).textContent=value;
  $('stat-pending').textContent=pending.length;$('stat-today').textContent=due;$('stat-completed').textContent=done;
  $('completion-ring').style.setProperty('--progress',(tasks.length?done/tasks.length*360:0)+'deg');
  $('page-title').textContent=names[view];$('breadcrumb-view').textContent=names[view];$('list-title').textContent=names[view];
  document.querySelectorAll('[data-view]').forEach(el=>{el.classList.toggle('active',el.dataset.view===view);el.setAttribute('aria-current',el.dataset.view===view?'page':'false');});
  document.querySelectorAll('[data-priority]').forEach(el=>{el.classList.toggle('active',el.dataset.priority===priority);el.setAttribute('aria-pressed',String(el.dataset.priority===priority));});
  const list=filterTasks(tasks,{view,query:$('search').value.trim(),priority,today,sort:$('sort').value});
  $('result-count').textContent=list.length+' 项';
  const fragment=document.createDocumentFragment();
  for(const task of list){
    const row=document.createElement('article');row.className='task-row'+(task.completed?' completed':'');
    const check=document.createElement('button');check.className='check-task';check.textContent='✓';check.setAttribute('aria-label',(task.completed?'恢复任务：':'完成任务：')+task.title);check.setAttribute('aria-pressed',String(task.completed));check.addEventListener('click',run(()=>write(s=>{const t=s.data.tasks.find(x=>x.id===task.id);if(t){t.completed=!t.completed;t.version=uid();t.updatedAt=new Date().toISOString();}})));
    const content=document.createElement('button');content.className='task-content';content.setAttribute('aria-label','编辑任务：'+task.title);const title=document.createElement('span');title.className='task-title';title.textContent=task.title;content.append(title);
    if(task.notes){const notes=document.createElement('span');notes.className='task-notes';notes.textContent=task.notes;content.append(notes);}content.onclick=()=>openTask(task);
    const meta=document.createElement('div');meta.className='task-meta';
    if(task.due){const dueEl=document.createElement('span');dueEl.className='due'+(!task.completed&&task.due<today?' overdue':'');dueEl.textContent=task.due===today?'今天':task.due.slice(5).replace('-','月')+'日';dueEl.title=task.due;meta.append(dueEl);}
    const badge=document.createElement('span');badge.className='badge '+task.priority;badge.textContent={high:'高优先级',normal:'普通',low:'低优先级'}[task.priority];meta.append(badge);
    const remove=document.createElement('button');remove.className='delete-task';remove.textContent='×';remove.setAttribute('aria-label','删除任务：'+task.title);remove.onclick=()=>{deleting=task.id;$('confirm-dialog').showModal();};meta.append(remove);
    row.append(check,content,meta);fragment.append(row);
  }
  $('task-list').replaceChildren(fragment);$('empty-state').hidden=!!list.length;
  const filtered=$('search').value.trim()||priority!=='all';
  $('empty-title').textContent=filtered?'没有匹配的任务':view==='completed'?'暂无已完成任务':view==='today'?'今天暂无待办':view==='upcoming'?'暂无即将到来的任务':'暂无任务';
  $('empty-add').hidden=!!filtered||view==='completed';$('empty-add').textContent='新建任务';
  $('save-status').textContent='已保存在本地';
  $('sync-status').textContent=syncing?'正在同步…':state.lastSync?`上次同步 ${new Date(state.lastSync).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}${sameData(state.data,state.base)?'':' · 有待同步修改'}`:sameData(state.data,state.base)?'尚未同步':'有待同步修改';
  $('sync-button').disabled=syncing;
}
function network(){const online=navigator.onLine;$('network-status').textContent=online?'在线':'离线';$('network-status').classList.toggle('offline',!online);}
function openTask(task=null){editing=task?structuredClone(task):null;$('task-dialog-title').textContent=task?'编辑任务':'新建任务';$('task-title').value=task?.title||'';$('task-notes').value=task?.notes||'';$('task-due').value=task?.due||'';$('task-priority').value=task?.priority||'normal';$('task-dialog').showModal();$('task-title').focus();}
function openSettings(){$('repo-input').value=state.repo;$('token-input').value=token;$('settings-message').textContent='';$('settings-dialog').showModal();}
async function saveTask(values,original){
  let conflict=false;
  await write(s=>{
    const now=new Date().toISOString(), record={id:original?.id||uid(),...values,completed:original?.completed||false,updatedAt:now,version:uid()};
    if(original){const index=s.data.tasks.findIndex(x=>x.id===original.id);if(index<0||s.data.tasks[index].version!==original.version){conflict=true;record.id=uid();record.conflictOf=original.id;record.title=(record.title+'（冲突副本）').slice(0,200);s.data.tasks.push(record);}else{s.data.tasks[index]={...record,completed:s.data.tasks[index].completed};}}
    else s.data.tasks.push(record);
  });
  if(conflict)toast('其他标签页已修改此任务，已将本次编辑另存为冲突副本。');
}
const githubURL=repo=>`https://api.github.com/repos/${repo}/contents/data/tasks.json`;
async function request(repo,method='GET',body){
  const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),25000);
  try{
    return await fetch(githubURL(repo),{method,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:controller.signal,redirect:'error',credentials:'omit'});
  }catch(e){if(e.name==='AbortError')throw new Error('同步超时，本地修改已保留。');throw new Error('无法连接 GitHub，本地修改已保留，请检查网络后重试。');}
  finally{clearTimeout(timeout);}
}
function httpError(status){return new Error(status===401?'令牌无效或已过期，请重新设置。':status===403?'GitHub 拒绝访问：请检查令牌写入权限或稍后重试。':status===404?'找不到数据文件：请检查仓库名、令牌的仓库访问范围及 data/tasks.json。':`GitHub 同步失败（HTTP ${status}），本地修改已保留。`);}
function encode(data){const bytes=new TextEncoder().encode(JSON.stringify(data,null,2)+'\n');if(bytes.length>900000)throw new Error('同步文件超过首版支持的 900 KB，请先导出备份并减少备注或任务数量。');let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
async function sync(){
  if(syncing)return;if(!token){openSettings();$('settings-message').textContent='输入专用令牌后，再点击顶部“同步”。';$('token-input').focus();return;}
  if(!navigator.onLine)throw new Error('当前处于离线状态，任务会继续保存在本地。');
  syncing=true;render();
  try{
    const snapshot=structuredClone(await read()), repo=snapshot.repo;let merged,conflicts=0,success=false;
    for(let attempt=0;attempt<3;attempt++){
      const response=await request(repo);if(!response.ok)throw httpError(response.status);
      const file=await response.json();if(file.encoding!=='base64'||typeof file.content!=='string'||file.size>900000||typeof file.sha!=='string')throw new Error('远端任务文件过大或格式不受支持。');
      let remote;try{remote=validateData(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(file.content.replace(/\s/g,'')),c=>c.charCodeAt(0)))));}catch(e){throw new Error('远端数据无法读取：'+e.message);}
      const result=mergeData(snapshot.base,snapshot.data,remote);merged=result.data;conflicts=result.conflicts;
      if(sameData(merged,remote)){success=true;break;}
      const put=await request(repo,'PUT',{message:'同步个人工作台任务',content:encode(merged),sha:file.sha});
      if(put.status===409||put.status===422)continue;
      if(!put.ok)throw httpError(put.status);success=true;break;
    }
    if(!success)throw new Error('其他设备正在更新数据，请稍后再次同步，本地修改已保留。');
    await write(s=>{
      if(s.repo!==repo)throw new Error('同步期间仓库设置发生变化，请重新同步。');
      const pending=mergeData(snapshot.data,s.data,merged);s.data=pending.data;s.base=merged;s.lastSync=new Date().toISOString();conflicts+=pending.conflicts;
    });
    toast(conflicts?`同步完成，已保留 ${conflicts} 处冲突副本，请检查任务列表。`:sameData(state.data,state.base)?'同步完成':'同步完成；同步期间的新修改将在下次同步时上传。');
  }finally{syncing=false;render();}
}
async function initialize(){
  db=await openDB();state=await read();state.data=validateData(state.data);state.base=validateData(state.base);render();network();
  channel && (channel.onmessage=run(async()=>{state=await read();render();}));
  document.querySelectorAll('[data-view]').forEach(el=>el.onclick=()=>{view=el.dataset.view;render();});
  document.querySelectorAll('[data-priority]').forEach(el=>el.onclick=()=>{priority=el.dataset.priority;render();});
  document.querySelectorAll('[data-close]').forEach(el=>el.onclick=()=>$(el.dataset.close).close());
  $('new-task').onclick=$('empty-add').onclick=()=>openTask();$('settings-button').onclick=openSettings;
  $('search').oninput=$('sort').onchange=render;
  $('quick-add').onsubmit=run(async e=>{e.preventDefault();const title=$('quick-title').value.trim();if(!title)return;await saveTask({title,notes:'',due:'',priority:'normal'},null);$('quick-title').value='';if(view==='completed')view='all';render();});
  $('task-form').onsubmit=run(async e=>{e.preventDefault();const title=$('task-title').value.trim();if(!title){$('task-title').setCustomValidity('请输入任务名称');$('task-title').reportValidity();return;}await saveTask({title,notes:$('task-notes').value,due:$('task-due').value,priority:$('task-priority').value},editing);$('task-dialog').close();});
  $('task-title').oninput=()=>$('task-title').setCustomValidity('');
  $('cancel-delete').onclick=()=>$('confirm-dialog').close();
  $('confirm-delete').onclick=run(async()=>{await write(s=>{if(!s.data.tasks.some(t=>t.id===deleting))return;s.data.tasks=s.data.tasks.filter(t=>t.id!==deleting);s.data.tombstones.push({id:deleting,version:uid(),updatedAt:new Date().toISOString()});});$('confirm-dialog').close();});
  $('sync-button').onclick=run(sync);
  $('settings-form').onsubmit=run(async e=>{
    e.preventDefault();if(syncing)throw new Error('请等待当前同步结束再修改设置。');
    const repo=$('repo-input').value.trim();if(!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/.test(repo))throw new Error('仓库格式应为“用户名/仓库名”。');
    if(repo!==state.repo && !confirm('切换仓库将把当前本地任务合并到新仓库。是否继续？'))return;
    await write(s=>{if(s.repo!==repo){s.base=emptyData();s.lastSync=null;}s.repo=repo;});token=$('token-input').value.trim();$('token-input').value='';$('settings-message').textContent=token?'设置已保存，令牌仅在本次会话使用。':'仓库设置已保存，尚未输入令牌。';toast('设置已保存');
  });
  $('forget-token').onclick=()=>{if(syncing){toast('请等待同步结束。');return;}token='';$('token-input').value='';$('settings-message').textContent='当前令牌已清除。';};
  $('export-button').onclick=run(async()=>{const saved=await read(), blob=new Blob([JSON.stringify(saved.data,null,2)],{type:'application/json'}), url=URL.createObjectURL(blob), a=document.createElement('a');a.href=url;a.download=`工作台备份-${localDate()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  $('import-button').onclick=()=>$('import-file').click();
  $('import-file').onchange=run(async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>4000000)throw new Error('备份文件不能超过 4 MB。');let data;try{data=validateData(JSON.parse(await file.text()));}catch(error){throw new Error('导入失败：'+error.message);}let conflicts=0;await write(s=>{const merged=mergeData(emptyData(),s.data,data);s.data=merged.data;conflicts=merged.conflicts;});toast(conflicts?`已导入，保留 ${conflicts} 处冲突副本。`:'已导入并合并任务');}finally{e.target.value='';}});
  addEventListener('online',network);addEventListener('offline',network);
  document.addEventListener('visibilitychange',run(async()=>{if(document.visibilityState==='visible'){state=await read();render();network();}}));
  addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('install-button').hidden=false;});
  $('install-button').onclick=run(async()=>{await installPrompt?.prompt();installPrompt=null;$('install-button').hidden=true;});
  if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
  if('serviceWorker' in navigator){try{const registration=await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;const worker=registration.active;if(worker){const channel=new MessageChannel();channel.port1.onmessage=e=>{$('offline-info').textContent=e.data?.ready?'离线页面已缓存。清除网站数据会删除本地任务，请定期导出备份。':'离线页面尚未缓存完成，请联网重新打开。';};worker.postMessage('CACHE_STATUS',[channel.port2]);}}catch{$('offline-info').textContent='当前浏览器未完成离线页面缓存。任务仍在本地保存，离线重新打开页面的能力尚不可用。';}}
}
initialize().catch(error=>{toast(error.message,true);$('save-status').textContent='本地存储不可用';$('empty-title').textContent='本地存储不可用';$('empty-description').textContent=error.message;document.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);});

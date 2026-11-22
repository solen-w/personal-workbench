import {workspaceProfile,workspaceRecord} from './workspace-core.js';
import {validateReading} from './reading-core.js';
import {createModuleView} from './module-view.js';
import {validateRecord,validateAttachment,FILE_LIMIT} from './module-core.js';
import {emptyData, uid, validateData, mergeData, sameData, filterTasks} from './core.js';
import {NAV_GROUPS, CATEGORY_NAMES, DEFAULT_CATEGORY, isAuthorizedAccount} from './config.js';
const $=id=>document.getElementById(id);
const names={all:'全部任务',today:'今日待办',upcoming:'即将到来',completed:'已完成'};
let db, state, token='', view='all', priority='all', editing=null, deleting=null, syncing=false, installPrompt;
let activeCategory=DEFAULT_CATEGORY, profileDraft='', authenticated=false, workspaceModules;
let toastTimer; const channel='BroadcastChannel' in window ? new BroadcastChannel('workbench-data') : null;
const fresh=()=>({data:emptyData(),base:emptyData(),repo:'solen-w/personal-workbench-data',lastSync:null,revision:0});
const localDate=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
function toast(message,error=false){$('toast').textContent=message;$('toast').classList.toggle('error',error);$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),error?7000:4000);}
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open('personal-workbench',1);req.onupgradeneeded=()=>req.result.createObjectStore('documents');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(new Error('本地存储无法打开，请检查浏览器是否允许此网站保存数据。'));});}
function read(){return new Promise((resolve,reject)=>{const req=db.transaction('documents').objectStore('documents').get('state');req.onsuccess=()=>resolve(normalizeState(req.result||fresh()));req.onerror=()=>reject(new Error('读取本地数据失败。'));});}
// 在同一事务内读取和修改，避免多个标签页用旧数据互相覆盖。
function write(change){return new Promise((resolve,reject)=>{const tx=db.transaction('documents','readwrite'), store=tx.objectStore('documents');let next,failure;const req=store.get('state');req.onsuccess=()=>{try{next=normalizeState(req.result||fresh());change(next);next.revision++;store.put(next,'state');}catch(error){failure=error;tx.abort();}};tx.oncomplete=()=>{state=next;render();channel?.postMessage('updated');resolve(next);};tx.onerror=tx.onabort=()=>reject(failure||new Error('保存失败，可能是设备存储空间不足。请先导出备份。'));});}
function normalizeState(saved){
  saved.data=validateData(saved.data);saved.base=validateData(saved.base);
  if(saved.profile&&!workspaceRecord(saved.data)){
    const name=saved.profile.name||'我的工作台',photo=saved.profile.photo||'';
    saved.data.records.push(validateRecord({id:'workspace-profile',module:'基础情况',variant:'workspace-profile',title:name,fields:{name,photo},version:'legacy-profile',createdAt:'',updatedAt:''}));
  }
  delete saved.profile;return saved;
}
const run=fn=>async event=>{try{await fn(event);}catch(error){toast(error.message||'操作失败，请重试。',true);}};
function render(){
  if(!state)return;
  const today=localDate(), tasks=state.data.tasks.filter(x=>(x.category||DEFAULT_CATEGORY)===activeCategory), pending=tasks.filter(x=>!x.completed), done=tasks.length-pending.length, due=pending.filter(x=>x.due&&x.due<=today).length;
  for(const [key,value] of Object.entries({all:pending.length,today:due,upcoming:pending.filter(x=>x.due&&x.due>today).length,completed:done})) $('count-'+key).textContent=value;
  $('stat-pending').textContent=pending.length;$('stat-today').textContent=due;$('stat-completed').textContent=done;
  $('completion-ring').style.setProperty('--progress',(tasks.length?done/tasks.length*360:0)+'deg');
  renderProfile();
  $('page-title').textContent=activeCategory;$('breadcrumb-view').textContent=activeCategory;$('list-title').textContent=names[view];
  $('breadcrumb-group').textContent=NAV_GROUPS.find(group=>group.items.includes(activeCategory)).title;
  document.querySelectorAll('[data-category]').forEach(el=>{const active=el.dataset.category===activeCategory;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
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
  workspaceModules?.render(activeCategory,state.data);
}
function network(){const online=navigator.onLine;$('network-status').textContent=online?'在线':'离线';$('network-status').classList.toggle('offline',!online);}
function openTask(task=null){editing=task?structuredClone(task):null;$('task-dialog-title').textContent=task?'编辑任务':'新建任务';$('task-title').value=task?.title||'';$('task-notes').value=task?.notes||'';$('task-due').value=task?.due||'';$('task-priority').value=task?.priority||'normal';$('task-category').value=task?.category||activeCategory;$('task-dialog').showModal();$('task-title').focus();}
function openSettings(){$('repo-input').value=state.repo;$('token-input').value=token;$('settings-message').textContent='';$('settings-dialog').showModal();}
async function saveTask(values,original){
  let conflict=false;
  await write(s=>{
    const now=new Date().toISOString(), record={id:original?.id||uid(),category:original?.category||activeCategory,...values,completed:original?.completed||false,updatedAt:now,version:uid()};
    if(original){const index=s.data.tasks.findIndex(x=>x.id===original.id);if(index<0||s.data.tasks[index].version!==original.version){conflict=true;record.id=uid();record.conflictOf=original.id;record.title=(record.title+'（冲突副本）').slice(0,200);s.data.tasks.push(record);}else{s.data.tasks[index]={...record,completed:s.data.tasks[index].completed};}}
    else s.data.tasks.push(record);
  });
  if(conflict)toast('其他标签页已修改此任务，已将本次编辑另存为冲突副本。');
}
const githubURL=(repo,path='data/tasks.json')=>`https://api.github.com/repos/${repo}`+(path===null?'':`/contents/${path.split('/').map(encodeURIComponent).join('/')}`);
async function request(repo,method='GET',body,path='data/tasks.json',raw=false,accessToken=token){
  const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),25000);
  try{
    return await fetch(githubURL(repo,path),{method,headers:{Accept:raw?'application/vnd.github.raw+json':method==='GET'&&path!==null?'application/vnd.github.object+json':'application/vnd.github+json',Authorization:'Bearer '+accessToken,'X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:controller.signal,redirect:'error',credentials:'omit'});
  }catch(e){if(e.name==='AbortError')throw new Error('同步超时，本地修改已保留。');throw new Error('无法连接 GitHub，本地修改已保留，请检查网络后重试。');}
  finally{clearTimeout(timeout);}
}
function httpError(status){return new Error(status===401?'令牌无效或已过期，请重新设置。':status===403?'GitHub 拒绝访问：请检查令牌的 Contents 读写权限或稍后重试。':status===404?'当前令牌无法读取目标资源。请在“同步与设置”中点击“检查连接”。':`GitHub 同步失败（HTTP ${status}），本地修改已保留。`);}
function validRepo(repo){return /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/.test(repo);}
async function ensurePrivateRepo(repo,accessToken=token){
  if(!validRepo(repo))throw new Error('数据仓库格式应为“用户名/仓库名”。');
  const response=await request(repo,'GET',undefined,null,false,accessToken);
  if(response.status===404)throw new Error(`当前令牌无法访问 ${repo}。请确认仓库填写正确，并在该令牌的 Repository access 中选中此仓库。`);
  if(!response.ok)throw httpError(response.status);
  const info=await response.json();if(info.private!==true)throw new Error(`“${repo}”不是私有数据仓库。请填写 solen-w/personal-workbench-data，避免把个人内容上传到公开网页仓库。`);
  return info;
}
async function dataAccessError(repo,accessToken=token){
  const root=await request(repo,'GET',undefined,'',false,accessToken);
  if(root.status===404||root.status===403)return new Error('可以识别私有仓库，但不能读取内容。请为该令牌设置 Repository permissions → Contents → Read and write，并保存。');
  if(!root.ok)return httpError(root.status);
  return new Error(`已能读取 ${repo}，但默认分支没有 data/tasks.json。请确认使用的是 solen-w/personal-workbench-data，并检查文件路径。`);
}
async function checkConnection(){
  if(syncing)throw new Error('请等待当前同步结束。');
  const repo=$('repo-input').value.trim(),accessToken=$('token-input').value.trim()||token;
  if(!accessToken)throw new Error('请先输入专用访问令牌。');
  const button=$('check-connection');button.disabled=true;$('settings-message').textContent='正在检查…';
  try{await ensurePrivateRepo(repo,accessToken);const response=await request(repo,'GET',undefined,'data/tasks.json',false,accessToken);if(response.status===404)throw await dataAccessError(repo,accessToken);if(!response.ok)throw httpError(response.status);const file=await response.json();if(typeof file.sha!=='string')throw new Error('数据文件格式不正确。');$('settings-message').textContent='连接正常，可以读取私有数据文件。点击“保存设置”后同步；写入权限会在同步时验证。';}
  catch(error){$('settings-message').textContent=error.message;throw error;}
  finally{button.disabled=false;}
}
function encode(data){const bytes=new TextEncoder().encode(JSON.stringify(data,null,2)+'\n');if(bytes.length>8*1024*1024)throw new Error('内容数据超过 8 MB，请先导出备份并减少长篇内容。');let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
async function sync(){
  if(!authenticated)throw new Error('请先登录。');
  if(syncing)return;if(!token){openSettings();$('settings-message').textContent='输入专用令牌后，再点击顶部“同步”。';$('token-input').focus();return;}
  if(!navigator.onLine)throw new Error('当前处于离线状态，任务会继续保存在本地。');
  syncing=true;render();
  try{
    const snapshot=structuredClone(await read()), repo=snapshot.repo;let merged,conflicts=0,success=false;
    await ensurePrivateRepo(repo);
    let assetsUploaded=false;
    for(let attempt=0;attempt<3;attempt++){
      const response=await request(repo);if(response.status===404)throw await dataAccessError(repo);if(!response.ok)throw httpError(response.status);
      const file=await response.json();if(file.size>8*1024*1024||typeof file.sha!=='string')throw new Error('远端内容文件过大或格式不正确。');
      let remote;try{if(file.encoding==='base64'&&typeof file.content==='string'){remote=validateData(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(file.content.replace(/\s/g,'')),c=>c.charCodeAt(0)))));}else{const raw=await request(repo,'GET',undefined,'data/tasks.json',true);if(!raw.ok)throw httpError(raw.status);remote=validateData(await raw.json());}}catch(e){throw new Error('远端数据无法读取：'+e.message);}
      const result=mergeData(snapshot.base,snapshot.data,remote);merged=result.data;conflicts=result.conflicts;
      if(!assetsUploaded){await uploadAssets(snapshot.data,repo);assetsUploaded=true;}
      if(sameData(merged,remote)){success=true;break;}
      const put=await request(repo,'PUT',{message:'同步个人工作台内容',content:encode(merged),sha:file.sha});
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
async function refreshReading(){
  if(!authenticated)throw new Error('请先登录。');
  if(!token)throw new Error('请先在同步与设置中填写 GitHub 专用令牌。');
  if(!navigator.onLine)throw new Error('当前离线，可查看上次缓存的阅读数据。');
  const repo=state.repo;await ensurePrivateRepo(repo);
  const response=await request(repo,'GET',undefined,'data/weread.json',true);
  if(response.status===404)throw new Error('尚无阅读快照，请先在连接配置中运行微信读书同步；若已运行成功，请检查令牌的仓库访问范围与 Contents 权限。');
  if(!response.ok)throw httpError(response.status);
  const text=await response.text();if(text.length>8*1024*1024)throw new Error('阅读数据超过大小限制。');
  const report=validateReading(JSON.parse(text));
  if(!authenticated||state.repo!==repo)throw new Error('登录状态或数据仓库已变化，请重新读取。');
  await write(next=>{if(next.repo!==repo)throw new Error('数据仓库已变化，请重新读取。');next.readingReport={repo,data:report};});
}
async function initialize(){
  buildNavigation();
  db=await openDB();state=await read();state.data=validateData(state.data);state.base=validateData(state.base);render();network();
  bindAccountAndProfile();
  channel && (channel.onmessage=run(async()=>{state=await read();render();}));
  document.querySelectorAll('[data-view]').forEach(el=>el.onclick=()=>{view=el.dataset.view;render();});
  document.querySelectorAll('[data-priority]').forEach(el=>el.onclick=()=>{priority=el.dataset.priority;render();});
  document.querySelectorAll('[data-close]').forEach(el=>el.onclick=()=>$(el.dataset.close).close());
  $('new-task').onclick=$('empty-add').onclick=()=>openTask();$('settings-button').onclick=()=>{setSidebar(false);openSettings();};
  $('search').oninput=$('sort').onchange=render;
  $('quick-add').onsubmit=run(async e=>{e.preventDefault();const title=$('quick-title').value.trim();if(!title)return;await saveTask({title,notes:'',due:'',priority:'normal'},null);$('quick-title').value='';if(view==='completed')view='all';render();});
  $('task-form').onsubmit=run(async e=>{e.preventDefault();const title=$('task-title').value.trim();if(!title){$('task-title').setCustomValidity('请输入任务名称');$('task-title').reportValidity();return;}const category=$('task-category').value;await saveTask({title,notes:$('task-notes').value,due:$('task-due').value,priority:$('task-priority').value,category},editing);activeCategory=category;if(view==='completed'&&!editing?.completed)view='all';render();$('task-dialog').close();});
  $('task-title').oninput=()=>$('task-title').setCustomValidity('');
  $('cancel-delete').onclick=()=>$('confirm-dialog').close();
  $('confirm-delete').onclick=run(async()=>{await write(s=>{if(!s.data.tasks.some(t=>t.id===deleting))return;s.data.tasks=s.data.tasks.filter(t=>t.id!==deleting);s.data.tombstones.push({id:deleting,version:uid(),updatedAt:new Date().toISOString()});});$('confirm-dialog').close();});
  $('sync-button').onclick=run(sync);
  $('check-connection').onclick=run(checkConnection);
  $('settings-form').onsubmit=run(async e=>{
    e.preventDefault();if(syncing)throw new Error('请等待当前同步结束再修改设置。');
    const repo=$('repo-input').value.trim();if(!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/.test(repo))throw new Error('仓库格式应为“用户名/仓库名”。');
    if(repo!==state.repo && !confirm('切换仓库将把当前本地任务合并到新仓库。是否继续？'))return;
    await write(s=>{if(s.repo!==repo){s.base=emptyData();s.lastSync=null;}s.repo=repo;});token=$('token-input').value.trim();$('token-input').value='';$('settings-message').textContent=token?'设置已保存，令牌仅在本次会话使用。':'仓库设置已保存，尚未输入令牌。';toast('设置已保存');
  });
  $('forget-token').onclick=()=>{if(syncing){toast('请等待同步结束。');return;}token='';$('token-input').value='';$('settings-message').textContent='当前令牌已清除。';};
  $('export-button').onclick=run(exportBackup);
  $('import-button').onclick=()=>$('import-file').click();
  $('import-file').onchange=run(importBackup);
  workspaceModules=createModuleView({state:()=>state,write,toast,getAsset,saveAsset,refreshReading,syncStatus:()=>$('sync-status').textContent});render();
  addEventListener('online',network);addEventListener('offline',network);
  document.addEventListener('visibilitychange',run(async()=>{if(document.visibilityState==='visible'){state=await read();render();network();}}));
  addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('install-button').hidden=false;});
  $('install-button').onclick=run(async()=>{await installPrompt?.prompt();installPrompt=null;$('install-button').hidden=true;});
  if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
  if('serviceWorker' in navigator){try{const registration=await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;const worker=registration.active;if(worker){const channel=new MessageChannel();channel.port1.onmessage=e=>{$('offline-info').textContent=e.data?.ready?'离线页面已缓存。清除网站数据会删除本地任务，请定期导出备份。':'离线页面尚未缓存完成，请联网重新打开。';};worker.postMessage('CACHE_STATUS',[channel.port2]);}}catch{$('offline-info').textContent='当前浏览器未完成离线页面缓存。任务仍在本地保存，离线重新打开页面的能力尚不可用。';}}
}
function assetRead(id){return new Promise((resolve,reject)=>{const req=db.transaction('documents').objectStore('documents').get('asset:'+id);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(new Error('读取附件失败。'));});}
function saveAsset(asset){
  validateAttachment(asset);if(!(asset.blob instanceof Blob)||asset.blob.size!==asset.size)return Promise.reject(new Error('附件内容与信息不一致。'));
  return new Promise((resolve,reject)=>{const tx=db.transaction('documents','readwrite');tx.objectStore('documents').put(asset,'asset:'+asset.id);tx.oncomplete=()=>resolve(asset);tx.onabort=tx.onerror=()=>reject(new Error('附件保存失败，请检查设备剩余空间。'));});
}
async function getAsset(meta,localOnly=false){
  const cached=await assetRead(meta.id);if(cached)return cached;if(localOnly)return null;
  if(!token)throw new Error('此文件尚未缓存，请先在“同步与设置”中输入令牌。');if(!navigator.onLine)throw new Error('当前离线，且此设备尚未缓存该文件。');
  const repo=state.repo,response=await request(repo,'GET',undefined,meta.path,true);if(!response.ok)throw httpError(response.status);
  const blob=await response.blob();if(blob.size!==meta.size||blob.size>FILE_LIMIT)throw new Error('远端附件大小不正确，请检查私有仓库中的文件。');
  return saveAsset({...meta,blob:new Blob([blob],{type:meta.type}),uploadedRepos:{[repo]:true}});
}
function base64Bytes(bytes){let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);}
function fromBase64(text){return Uint8Array.from(atob(text),char=>char.charCodeAt(0));}
async function gitBlobSha(blob){const head=new TextEncoder().encode(`blob ${blob.size}\0`),bytes=await new Blob([head,blob]).arrayBuffer();return [...new Uint8Array(await crypto.subtle.digest('SHA-1',bytes))].map(byte=>byte.toString(16).padStart(2,'0')).join('');}
async function uploadAssets(data,repo){
  const attachments=[...new Map((data.records||[]).filter(record=>record.attachment).map(record=>[record.attachment.id,record.attachment])).values()];
  for(const meta of attachments){
    const asset=await assetRead(meta.id);if(asset?.uploadedRepos?.[repo])continue;
    if(!asset){const check=await request(repo,'GET',undefined,meta.path);if(!check.ok)throw new Error('缺少附件“'+meta.name+'”，请恢复完整备份或重新选择文件。');const info=await check.json();if(info.size!==meta.size)throw new Error('附件大小不一致，请重新选择文件。');continue;}
    const response=await request(repo,'PUT',{message:'保存工作台附件',content:base64Bytes(new Uint8Array(await asset.blob.arrayBuffer()))},meta.path);
    if(!response.ok){if(response.status===422||response.status===409){const check=await request(repo,'GET',undefined,meta.path);if(!check.ok)throw httpError(check.status);const info=await check.json();if(info.sha!==await gitBlobSha(asset.blob))throw new Error('远端附件内容冲突，请重新选择文件后同步。');}else throw httpError(response.status);}
    asset.uploadedRepos={...asset.uploadedRepos,[repo]:true};await saveAsset(asset);
  }
}
async function exportBackup(){
  const saved=await read(),metas=[...new Map(saved.data.records.filter(record=>record.attachment).map(record=>[record.attachment.id,record.attachment])).values()];
  if(metas.reduce((size,meta)=>size+meta.size,0)>44*1024*1024)throw new Error('附件总量超过完整 JSON 备份的 44 MB 上限，请分别下载文件，并保留私有仓库备份。');
  const assets=[];for(const meta of metas){const asset=await getAsset(meta);assets.push({...meta,base64:base64Bytes(new Uint8Array(await asset.blob.arrayBuffer()))});}
  const blob=new Blob([JSON.stringify({format:'workbench-backup-v2',data:saved.data,assets},null,2)],{type:'application/json'});if(blob.size>64*1024*1024)throw new Error('完整备份超过 64 MB，请分别下载附件，并保留私有仓库副本。');const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`工作台备份-${localDate()}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function importBackup(event){
  try{
    const file=event.target.files[0];if(!file)return;if(file.size>64*1024*1024)throw new Error('备份文件不能超过 64 MB。');
    let parsed,data;try{parsed=JSON.parse(await file.text());data=validateData(parsed.format==='workbench-backup-v2'?parsed.data:parsed);}catch(error){throw new Error('导入失败：'+error.message);}
    const incoming=[];if(parsed.format==='workbench-backup-v2'){
      if(!Array.isArray(parsed.assets)||parsed.assets.length>20000)throw new Error('备份附件列表不正确。');
      const seen=new Set();for(const asset of parsed.assets){const meta=validateAttachment(asset);if(!meta||seen.has(meta.id)||typeof asset.base64!=='string'||asset.base64.length>12*1024*1024)throw new Error('备份附件格式不正确。');seen.add(meta.id);let blob;try{blob=new Blob([fromBase64(asset.base64)],{type:meta.type});}catch{throw new Error('备份附件编码不正确。');}if(blob.size!==meta.size)throw new Error('备份附件大小不一致。');incoming.push({...meta,blob,uploadedRepos:{}});}
    }
    for(const asset of incoming){const cached=await assetRead(asset.id);if(cached&&await gitBlobSha(cached.blob)!==await gitBlobSha(asset.blob)){const old=asset.id;asset.id=uid();asset.path='data/assets/'+asset.id;for(const record of data.records)if(record.attachment?.id===old)record.attachment={id:asset.id,path:asset.path,name:asset.name,type:asset.type,size:asset.size};}await saveAsset(asset);}
    let conflicts=0;await write(saved=>{const result=mergeData(emptyData(),saved.data,data);saved.data=result.data;conflicts=result.conflicts;});toast(conflicts?`已导入，保留 ${conflicts} 处冲突副本。`:'已导入并合并内容');
  }finally{event.target.value='';}
}
function buildNavigation(){
  const nav=document.createDocumentFragment(), options=document.createDocumentFragment();
  for(const group of NAV_GROUPS){
    const section=document.createElement('section');section.className='nav-group';const heading=document.createElement('h2');heading.textContent=group.title;section.append(heading);
    const optionGroup=document.createElement('optgroup');optionGroup.label=group.title;
    for(const name of group.items){
      const button=document.createElement('button');button.className='nav-item';button.dataset.category=name;button.textContent=name;
      button.onclick=()=>{activeCategory=name;view='all';priority='all';$('search').value='';render();setSidebar(false);};section.append(button);
      const option=document.createElement('option');option.value=name;option.textContent=name;optionGroup.append(option);
    }
    nav.append(section);options.append(optionGroup);
  }
  $('category-nav').replaceChildren(nav);$('task-category').replaceChildren(options);
}
function renderProfile(){
  const name=workspaceProfile(state.data).name, photo=workspaceProfile(state.data).photo||'./icon.svg';
  $('brand-name').textContent=name;$('brand-name').title=name;$('brand-photo').src=photo;$('login-title').textContent=name;document.title=name;
}
function setSidebar(open){
  const mobile=matchMedia('(max-width: 640px)').matches;open=!!open&&mobile;
  const wasOpen=document.body.classList.contains('nav-open');document.body.classList.toggle('nav-open',open);
  $('sidebar-backdrop').hidden=!open;$('menu-button').setAttribute('aria-expanded',String(open));
  document.querySelector('main').inert=open;
  if(open){$('sidebar').setAttribute('role','dialog');$('sidebar').setAttribute('aria-modal','true');$('sidebar-close').focus();}
  else{$('sidebar').removeAttribute('role');$('sidebar').removeAttribute('aria-modal');if(wasOpen)$('menu-button').focus();}
}
function setAuthenticated(value){
  authenticated=value;$('app-shell').hidden=!value;$('app-shell').inert=!value;$('login-panel').hidden=value;
  if(value){$('login-account').value='';$('login-error').textContent='';$('new-task').focus();}
  else{$('login-account').value='';$('login-account').focus();}
}
function bindAccountAndProfile(){
  let remembered=false;try{remembered=sessionStorage.getItem('workbench-authorized-session-v2')==='active';}catch{}
  setAuthenticated(remembered);
  $('login-form').onsubmit=event=>{
    event.preventDefault();if(!isAuthorizedAccount($('login-account').value)){$('login-error').textContent='账号未获授权';$('login-account').setAttribute('aria-invalid','true');return;}
    try{sessionStorage.setItem('workbench-authorized-session-v2','active');}catch{}
    $('login-account').removeAttribute('aria-invalid');setAuthenticated(true);
  };
  $('login-account').oninput=()=>{$('login-error').textContent='';$('login-account').removeAttribute('aria-invalid');};
  $('logout-button').onclick=()=>{
    if(syncing){toast('请等待同步结束再退出。');return;}
    token='';$('token-input').value='';document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());setSidebar(false);
    try{sessionStorage.removeItem('workbench-authorized-session-v2');}catch{}
    setAuthenticated(false);
  };
  $('menu-button').onclick=()=>setSidebar(true);$('sidebar-close').onclick=$('sidebar-backdrop').onclick=()=>setSidebar(false);
  matchMedia('(max-width: 640px)').addEventListener('change',()=>setSidebar(false));
  document.addEventListener('keydown',event=>{
    if(!document.body.classList.contains('nav-open'))return;
    if(event.key==='Escape'){event.preventDefault();setSidebar(false);}
    if(event.key==='Tab'){
      const buttons=[...$('sidebar').querySelectorAll('button')].filter(el=>el.getClientRects().length&&!el.disabled), first=buttons[0],last=buttons.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  $('profile-button').onclick=()=>{setSidebar(false);profileDraft=workspaceProfile(state.data).photo;$('profile-preview').src=profileDraft||'./icon.svg';$('profile-name').value=workspaceProfile(state.data).name;$('profile-dialog').showModal();};
  $('choose-photo').onclick=()=>$('profile-file').click();
  $('reset-photo').onclick=()=>{profileDraft='';$('profile-preview').src='./icon.svg';};
  $('profile-file').onchange=run(async event=>{
    try{const file=event.target.files[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('请选择 JPG、PNG 或 WebP 图片。');if(file.size>8*1024*1024)throw new Error('图片不能超过 8 MB。');
      const url=URL.createObjectURL(file);try{const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const context=canvas.getContext('2d');const side=Math.min(image.naturalWidth,image.naturalHeight);if(!side||!context)throw new Error('图片无法读取。');context.fillStyle='#ffffff';context.fillRect(0,0,256,256);context.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,0,0,256,256);profileDraft=canvas.toDataURL('image/jpeg',.88);$('profile-preview').src=profileDraft;}finally{URL.revokeObjectURL(url);}
    }finally{event.target.value='';}
  });
  $('profile-form').onsubmit=run(async event=>{event.preventDefault();const name=$('profile-name').value.trim();if(!name)throw new Error('请输入工作台名称。');if(name.length>20)throw new Error('工作台名称最多 20 个字。');await write(s=>{const existing=workspaceRecord(s.data),now=new Date().toISOString(),record=validateRecord({id:existing?.id||'workspace-profile',module:'基础情况',variant:'workspace-profile',title:name,fields:{name,photo:profileDraft},version:uid(),updatedAt:now,createdAt:existing?.createdAt||now});const index=s.data.records.findIndex(item=>item.id===record.id);if(index<0)s.data.records.push(record);else s.data.records[index]=record;});$('profile-dialog').close();});
}
initialize().catch(error=>{toast(error.message,true);$('login-error').textContent=error.message;$('save-status').textContent='本地存储不可用';$('empty-title').textContent='本地存储不可用';document.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);});

import {MODULES,validateRecord,amountCents,financeTotals,money,progress,localDay,weekDays,FILE_LIMIT} from './module-core.js';
import {uid} from './core.js';
const $=id=>document.getElementById(id);
function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function button(text,action,className='button'){const node=element('button',className,text);node.type='button';node.onclick=action;return node;}
function meta(card,label,value){if(!value)return;const row=element('div','record-meta');row.append(element('span','',label),element('span','',value));card.append(row);}
function preview(text,max=160){return text.length>max?text.slice(0,max)+'…':text;}
function bytes(size){return size<1024*1024?`${Math.ceil(size/1024)} KB`:`${(size/1024/1024).toFixed(1)} MB`;}
export function createModuleView(api){
  let moduleName='',query='',filter='',month='',original=null,draftAttachment=null,epoch=0,urls=[];
  const safe=fn=>async event=>{try{await fn(event);}catch(error){api.toast(error.message||'操作失败',true);}};
  const allRecords=()=>api.state().data.records||[];
  const selected=()=>allRecords().filter(record=>record.module===moduleName);
  const definition=()=>MODULES[moduleName];
  function cleanup(){urls.forEach(URL.revokeObjectURL);urls=[];}
  async function putRecord(record,old=original){
    let conflict=false;
    await api.write(state=>{
      state.data.records??=[];state.data.recordTombstones??=[];
      const now=new Date().toISOString(),next=validateRecord({...record,version:uid(),updatedAt:now,createdAt:old?.createdAt||now});
      if(old){const index=state.data.records.findIndex(item=>item.id===old.id);
        if(index<0||state.data.records[index].version!==old.version){conflict=true;next.id=uid();next.title=(next.title+'（冲突副本）').slice(0,200);next.conflictOf=old.id;state.data.records.push(next);}
        else state.data.records[index]=next;
      }else state.data.records.push(next);
    });
    if(conflict)api.toast('另一端已修改，当前内容另存为冲突副本。');
  }
  function edit(record=null){
    original=record?structuredClone(record):null;draftAttachment=record?.attachment||null;
    const def=definition();$('module-dialog-title').textContent=record?'编辑'+def.label:def.action;$('module-record-title-label').textContent=def.titleLabel;$('module-record-title').value=record?.title||'';
    const fragment=document.createDocumentFragment();
    for(const field of def.fields){const label=element('label','module-field',field.label);let input;
      if(field.type==='textarea'){input=document.createElement('textarea');input.rows=field.key==='content'?9:4;}
      else if(field.type==='select'){input=document.createElement('select');for(const value of field.options){const option=element('option','',value);option.value=value;input.append(option);}}
      else{input=document.createElement('input');input.type=field.type==='money'?'text':field.type;input.autocomplete='off';if(field.type==='money'){input.inputMode='decimal';input.placeholder='0.00';}if(field.type==='number'){input.step='1';input.min=field.min??0;if(field.max!==undefined)input.max=field.max;}}
      input.name=field.key;input.id='record-field-'+field.key;input.required=!!field.required;input.maxLength=field.max||10000;input.value=record?.fields[field.key]??(field.options?.[0]||(['date','started'].includes(field.key)?localDay():field.key==='target'?(def.kind==='habit'?'7':'100'):field.key==='current'?'0':''));
      label.append(input);fragment.append(label);
    }
    $('module-fields').replaceChildren(fragment);$('attachment-editor').hidden=!def.attachment;$('record-file').accept=def.attachment==='image'?'image/png,image/jpeg,image/webp,image/gif':'';$('remove-record-file').hidden=!draftAttachment;showAttachment();$('module-dialog').showModal();$('module-record-title').focus();
  }
  function showAttachment(){$('record-file-name').textContent=draftAttachment?`${draftAttachment.name} · ${bytes(draftAttachment.size)}`:'未选择文件';$('remove-record-file').hidden=!draftAttachment;}
  async function toggleDay(record,date){
    await api.write(state=>{const current=state.data.records.find(item=>item.id===record.id);if(!current)return;const days=new Set(current.checkins);days.has(date)?days.delete(date):days.add(date);current.checkins=[...days].sort();current.version=uid();current.updatedAt=new Date().toISOString();});
  }
  function actions(card,record,{detail=false}={}){
    const row=element('div','record-actions');
    if(detail)row.append(button('查看',()=>showDetail(record),'button text-button'));
    if(record.attachment)row.append(button(definition().kind==='image'?'查看图片':'下载文件',safe(()=>openAttachment(record)), 'button text-button'));
    row.append(button('编辑',()=>edit(record),'button text-button'),button('删除',()=>{$('module-delete-dialog').showModal();$('module-delete-confirm').onclick=safe(async()=>{await api.write(state=>{if(!state.data.records.some(item=>item.id===record.id))return;state.data.records=state.data.records.filter(item=>item.id!==record.id);state.data.recordTombstones.push({id:record.id,version:uid(),updatedAt:new Date().toISOString()});});$('module-delete-dialog').close();});},'button text-button destructive'));
    card.append(row);
  }
  function showDetail(record){
    $('detail-title').textContent=record.title;const content=$('detail-content');content.replaceChildren();
    for(const field of MODULES[record.module].fields){const value=record.fields[field.key];if(!value)continue;const section=element('section','detail-field');section.append(element('h3','',field.label));
      if(field.type==='url'){const link=element('a','record-link',value);link.href=value;link.target='_blank';link.rel='noopener noreferrer';section.append(link);}else section.append(element('div','detail-text',value));content.append(section);
    }
    if(record.attachment)content.append(button('下载文件',safe(()=>openAttachment(record))));
    if(MODULES[record.module].kind==='text')content.append(button('复制正文',safe(async()=>{await navigator.clipboard.writeText(record.fields.content);api.toast('已复制正文');})));
    $('detail-dialog').showModal();
  }
  async function openAttachment(record){
    const asset=await api.getAsset(record.attachment);if(!asset)throw new Error('此文件尚未缓存，请配置令牌并联网下载。');
    const url=URL.createObjectURL(asset.blob);urls.push(url);
    if(MODULES[record.module].kind==='image'){$('detail-title').textContent=record.title;$('detail-content').replaceChildren();const image=document.createElement('img');image.className='detail-image';image.src=url;image.alt=record.title;$('detail-content').append(image,button('下载图片',()=>download(url,record.attachment.name)));$('detail-dialog').showModal();}
    else download(url,record.attachment.name);
  }
  function download(url,name){const link=document.createElement('a');link.href=url;link.download=name;link.click();}
  function progressBar(card,record){const percentage=progress(record),track=element('div','progress-track'),fill=element('span');fill.style.width=percentage+'%';track.setAttribute('role','progressbar');track.setAttribute('aria-label','完成进度');track.setAttribute('aria-valuenow',percentage);track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.append(fill);card.append(track,element('div','progress-label',`${record.fields.current||0} / ${record.fields.target||record.fields.total||0} ${record.fields.unit||'页'.repeat(MODULES[record.module].kind==='book'?1:0)} · ${percentage}%`));}
  function stat(label,value){const card=element('div','module-stat');card.append(element('span','',label),element('strong','',value));return card;}
  function render(name,data){
    if(name!==moduleName){moduleName=name;query='';filter='';month='';$('module-query').value='';$('module-month').value='';}
    const currentEpoch=++epoch;cleanup();const def=definition(),records=(data.records||[]).filter(record=>record.module===name);
    $('module-kind').textContent=def.label;$('new-task').textContent=def.kind==='profile'&&records.length?'编辑资料':def.action;
    const select=$('module-filter'),selectField=def.fields.find(field=>field.key==='status'||field.key==='kind');select.replaceChildren();const all=element('option','','全部');all.value='';select.append(all);
    if(selectField)for(const option of selectField.options){const node=element('option','',option);node.value=option;select.append(node);}select.value=filter;select.hidden=!selectField;
    $('module-month').hidden=def.kind!=='finance';
    let visible=records.filter(record=>JSON.stringify([record.title,Object.values(record.fields)]).toLowerCase().includes(query.toLowerCase())&&(!filter||record.fields[selectField?.key]===filter)&&(!month||record.fields.date?.startsWith(month)));
    visible.sort((a,b)=>def.kind==='experience'?(b.fields.start||'').localeCompare(a.fields.start||''):b.updatedAt.localeCompare(a.updatedAt));
    $('module-count').textContent=visible.length+' 项';
    const stats=$('module-stats');stats.replaceChildren();stats.hidden=false;
    if(def.kind==='finance'){const totals=financeTotals(visible);stats.append(stat('收入','¥ '+money(totals.income)),stat('支出','¥ '+money(totals.expense)),stat('结余','¥ '+money(totals.balance)));}
    else if(def.kind==='goal')stats.append(stat('全部目标',records.length),stat('进行中',records.filter(record=>record.fields.status==='进行中').length),stat('已完成',records.filter(record=>record.fields.status==='已完成').length));
    else if(def.kind==='habit'){const days=weekDays(),today=localDay();stats.append(stat('习惯',records.length),stat('今日已打卡',records.filter(record=>record.checkins.includes(today)).length),stat('本周打卡',records.reduce((count,record)=>count+record.checkins.filter(day=>days.includes(day)).length,0)));}
    else if(def.kind==='book')stats.append(stat('想读',records.filter(record=>record.fields.status==='想读').length),stat('在读',records.filter(record=>record.fields.status==='在读').length),stat('已读',records.filter(record=>record.fields.status==='已读').length));
    else stats.hidden=true;
    $('module-searchbar').hidden=def.kind==='profile';
    const list=$('module-records');list.className='module-records kind-'+def.kind;const fragment=document.createDocumentFragment();
    for(const record of visible){
      const card=element('article','record-card');
      if(record.conflictOf)card.append(element('span','conflict-tag','冲突副本'));
      if(def.kind==='image'){const wrapper=element('button','image-preview');wrapper.type='button';wrapper.setAttribute('aria-label','查看图片：'+record.title);wrapper.append(element('span','','图片'));wrapper.onclick=safe(()=>openAttachment(record));card.append(wrapper);
        api.getAsset(record.attachment,true).then(asset=>{if(!asset||currentEpoch!==epoch)return;const url=URL.createObjectURL(asset.blob);urls.push(url);const image=document.createElement('img');image.src=url;image.alt=record.title;image.loading='lazy';wrapper.replaceChildren(image);}).catch(()=>{});
      }
      const title=element('h3','record-title',record.title);card.append(title);
      if(def.kind==='profile'){
        const photo=element('img','personal-photo');photo.src=api.state().profile?.photo||'./icon.svg';photo.alt='个人头像';card.prepend(photo);const grid=element('div','profile-values');for(const field of def.fields)if(record.fields[field.key])meta(grid,field.label,record.fields[field.key]);card.append(grid);actions(card,record);
      }else if(def.kind==='experience'){card.append(element('span','record-tag',record.fields.kind||'经历'));meta(card,'时间',`${record.fields.start||'未填写'} — ${record.fields.end||'至今'}`);meta(card,'专业 / 职位',record.fields.role);if(record.fields.details)card.append(element('p','record-excerpt',preview(record.fields.details)));actions(card,record,{detail:true});
      }else if(def.kind==='finance'){const amount=element('strong','finance-amount '+(record.fields.kind==='收入'?'income':'expense'),(record.fields.kind==='收入'?'+':'−')+' ¥ '+money(amountCents(record.fields.amount)));card.append(amount);meta(card,'日期',record.fields.date);meta(card,'分类',record.fields.category);meta(card,'账户',record.fields.account);actions(card,record,{detail:true});
      }else if(def.kind==='goal'){card.append(element('span','record-tag',record.fields.status));progressBar(card,record);meta(card,'截止',record.fields.due);if(record.fields.plan)card.append(element('p','record-excerpt',preview(record.fields.plan)));actions(card,record,{detail:true});
      }else if(def.kind==='habit'){const today=localDay(),days=weekDays(),checked=record.checkins.includes(today);const row=element('div','habit-days');days.forEach((day,index)=>{const btn=button(['一','二','三','四','五','六','日'][index],safe(()=>toggleDay(record,day)),'day-button'+(record.checkins.includes(day)?' checked':'')+(day===today?' today':''));btn.title=day;btn.setAttribute('aria-label',day+(record.checkins.includes(day)?' 已打卡':' 未打卡'));btn.setAttribute('aria-pressed',String(record.checkins.includes(day)));btn.disabled=day>today;row.append(btn);});card.append(row);meta(card,'本周',`${record.checkins.filter(day=>days.includes(day)).length} / ${record.fields.target} 天`);card.append(button(checked?'取消今日打卡':'今日打卡',safe(()=>toggleDay(record,today)), 'button '+(checked?'':'primary')));actions(card,record);
      }else if(def.kind==='book'){card.append(element('span','record-tag',record.fields.status));meta(card,'作者',record.fields.author);if(record.fields.total)progressBar(card,record);if(record.fields.notes)card.append(element('p','record-excerpt',preview(record.fields.notes)));actions(card,record,{detail:true});
      }else if(def.kind==='text'){meta(card,'标签',record.fields.tags);card.append(element('p','record-excerpt text-excerpt',preview(record.fields.content,220)));actions(card,record,{detail:true});
      }else if(def.kind==='image'){meta(card,'标签',record.fields.tags);if(record.attachment)meta(card,'文件',bytes(record.attachment.size));actions(card,record);
      }else {if(def.kind==='policy'){card.append(element('span','record-tag',record.fields.status));meta(card,'文号',record.fields.number);meta(card,'发布机构',record.fields.issuer);meta(card,'施行日期',record.fields.effective);}else meta(card,'分类',record.fields.category);meta(card,'日期',record.fields.date);if(record.attachment)meta(card,'附件',record.attachment.name+' · '+bytes(record.attachment.size));actions(card,record,{detail:true});}
      fragment.append(card);
    }
    list.replaceChildren(fragment);$('module-empty').hidden=visible.length>0;$('module-empty-title').textContent=query||filter||month?'没有匹配的内容':'暂无'+def.label;$('module-empty-add').hidden=!!(query||filter||month);$('module-empty-add').textContent=def.action;
    $('legacy-block').hidden=!(data.tasks||[]).some(task=>(task.category||'命宫本元')===name);$('legacy-count').textContent=(data.tasks||[]).filter(task=>(task.category||'命宫本元')===name).length+' 项';
    $('module-sync-status').textContent=api.syncStatus();
  }
  $('module-query').oninput=event=>{query=event.target.value;render(moduleName,api.state().data);};$('module-filter').onchange=event=>{filter=event.target.value;render(moduleName,api.state().data);};$('module-month').onchange=event=>{month=event.target.value;render(moduleName,api.state().data);};
  $('module-empty-add').onclick=()=>edit();$('new-task').onclick=()=>edit(definition().kind==='profile'?selected()[0]||null:null);
  $('module-form').onsubmit=safe(async event=>{event.preventDefault();const fields={};for(const field of definition().fields)fields[field.key]=$('record-field-'+field.key).value.trim();
    if(definition().kind==='workfile'&&!draftAttachment&&!fields.url)throw new Error('请选择文件或填写文件链接。');
    if(definition().kind==='policy'&&!draftAttachment&&!fields.url&&!fields.content)throw new Error('请添加附件、原文链接或政策内容。');
    const record={id:original?.id||uid(),module:moduleName,title:$('module-record-title').value.trim(),fields,attachment:draftAttachment,checkins:original?.checkins||[],version:uid(),updatedAt:'',createdAt:original?.createdAt||''};await putRecord(record);$('module-dialog').close();});
  $('choose-record-file').onclick=()=>$('record-file').click();$('remove-record-file').onclick=()=>{draftAttachment=null;showAttachment();};
  $('record-file').onchange=safe(async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>FILE_LIMIT)throw new Error('单个文件不能超过 8 MB。');if(definition().attachment==='image'&&!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type))throw new Error('请选择 PNG、JPG、WebP 或 GIF 图片。');const id=uid();draftAttachment={id,path:'data/assets/'+id,name:file.name,type:file.type||'application/octet-stream',size:file.size};await api.saveAsset({...draftAttachment,blob:file,uploadedRepos:{}});if(!$('module-record-title').value.trim())$('module-record-title').value=file.name.slice(0,200);showAttachment();}finally{event.target.value='';}});
  $('legacy-download').onclick=safe(async()=>{const tasks=api.state().data.tasks.filter(task=>(task.category||'命宫本元')===moduleName);const blob=new Blob([JSON.stringify({schemaVersion:1,tasks,tombstones:[]},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);download(url,moduleName+'-原有任务.json');setTimeout(()=>URL.revokeObjectURL(url),1000);});
  return {render,edit};
}

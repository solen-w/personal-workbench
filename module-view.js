import {attachAccountSwipe} from './account-swipe.js?v=20261126-account-cards-6';
import {attachInvestmentLookup} from './investment-lookup.js?v=20261126-account-cards-6';
import {createInvestmentView} from './investment-view.js?v=20261126-account-cards-6';
import {investmentTotals,investmentEvents,investmentKind,managedInvestmentAccount,investmentCashEnabled,INVESTMENT_ACCOUNT_KINDS,investmentProfitClass} from './investment-core.js?v=20261126-account-cards-6';
import {createAccountView} from './account-view.js?v=20261126-account-cards-6';
import {createReadingView} from './reading-view.js?v=20261126-account-cards-6';
import {workspaceProfile,displayPartialDate,experienceOrder,syncDate} from './workspace-core.js?v=20261126-account-cards-6';
import {ACCOUNT_TYPES,normalizeAccountType,assetTotals,FINANCE_TABS,financeVariant,weekReport,accountBalance,accountCashBalance,investmentValue,validateFinanceChange,mondayOf,addDays} from './finance-core.js?v=20261126-account-cards-6';
import {MODULES,getDefinition,validateRecord,amountCents,financeTotals,money,progress,localDay,weekDays,FILE_LIMIT} from './module-core.js?v=20261126-account-cards-6';
import {uid} from './core.js?v=20261126-account-cards-6';
const $=id=>document.getElementById(id);
function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function button(text,action,className='button'){const node=element('button',className,text);node.type='button';node.onclick=action;return node;}
function meta(card,label,value){if(!value)return;const row=element('div','record-meta');row.append(element('span','',label),element('span','',value));card.append(row);}
function preview(text,max=160){return text.length>max?text.slice(0,max)+'…':text;}
function bytes(size){return size<1024*1024?`${Math.ceil(size/1024)} KB`:`${(size/1024/1024).toFixed(1)} MB`;}
function partialDateControl(value,key){
  const input=document.createElement('input');input.type='hidden';const controls=element('div','partial-date-control'),month=document.createElement('input'),day=document.createElement('select');month.type='month';month.id='record-month-'+key;month.setAttribute('aria-label',(key==='start'?'开始':'结束')+'年月');day.id='record-day-'+key;day.setAttribute('aria-label',(key==='start'?'开始':'结束')+'日（可不选）');month.value=value.slice(0,7);
  function fill(selected=''){day.replaceChildren();const empty=element('option','','不指定日');empty.value='';day.append(empty);if(month.value){const [year,m]=month.value.split('-').map(Number),count=new Date(Date.UTC(year,m,0)).getUTCDate();for(let n=1;n<=count;n++){const option=element('option','',n+'日');option.value=String(n).padStart(2,'0');day.append(option);}}day.value=[...day.options].some(item=>item.value===selected)?selected:'';day.disabled=!month.value;}
  const update=()=>{input.value=month.value+(day.value?'-'+day.value:'');};fill(value.slice(8,10));month.onchange=()=>{fill(day.value);update();};day.onchange=update;controls.append(month,day);return {input,controls};
}
export function createModuleView(api){
  const readingView=createReadingView(api);
  let moduleName='',activeVariant='base',financeWeek=mondayOf(localDay()),query='',filter='',month='',original=null,draftAttachment=null,epoch=0,urls=[];
  const safe=fn=>async event=>{try{await fn(event);}catch(error){api.toast(error.message||'操作失败',true);}};
  const allRecords=()=>api.state().data.records||[];
  const selected=()=>allRecords().filter(record=>record.module===moduleName&&!['reading-title','workspace-profile'].includes(record.variant));
  let formVariant='base';
  const definition=()=>getDefinition(moduleName,activeVariant);
  const editorDefinition=()=>getDefinition(moduleName,formVariant);
  const accountView=createAccountView(api,{edit,showDetail});
  const investmentView=createInvestmentView(api,{edit});
  const accountName=value=>{const record=allRecords().find(item=>item.module==='财务管理'&&financeVariant(item)==='account'&&item.id===value);return record?.title||(/^[0-9a-f-]{36}$/i.test(value||'')?'已删除账户':value);};
  function cleanup(){urls.forEach(URL.revokeObjectURL);urls=[];}
  async function putRecord(record,old=original){
    let conflict=false;
    await api.write(state=>{
      state.data.records??=[];state.data.recordTombstones??=[];
      const now=new Date().toISOString(),next=validateRecord({...record,version:uid(),updatedAt:now,createdAt:old?.createdAt||now});validateFinanceChange(next,state.data.records,old?.id);
      if(old){const index=state.data.records.findIndex(item=>item.id===old.id);
        if(index<0||state.data.records[index].version!==old.version){conflict=true;next.id=uid();next.title=(next.title+'（冲突副本）').slice(0,200);next.conflictOf=old.id;state.data.records.push(next);}
        else state.data.records[index]=next;
      }else state.data.records.push(next);
    });
    if(conflict)api.toast('另一端已修改，当前内容另存为冲突副本。');
  }
  function edit(record=null,variant=record?.variant||activeVariant){
    if(record?.variant==='account'&&record.fields.investmentKind){investmentView.settings();return;}
    formVariant=variant;
    original=record?structuredClone(record):null;draftAttachment=record?.attachment||null;
    const def=editorDefinition();$('module-dialog-title').textContent=record?'编辑'+def.label:def.action;$('module-record-title-label').textContent=def.titleLabel;$('module-record-title').value=record?.title||(variant==='annual-saving'?new Date().getFullYear()+'年度存款目标':moduleName==='身体跟踪'?'身体记录 '+localDay():moduleName==='财务管理'&&activeVariant==='budget'?'每周固定预算':moduleName==='财务管理'&&variant==='recovery'?'结余回收':'');
    const fragment=document.createDocumentFragment();
    for(const field of def.fields){if(field.internal)continue;const label=element('label','module-field',field.label);let input;
      if(field.type==='partialdate'){const control=partialDateControl(record?.fields[field.key]||'',field.key);input=control.input;label.append(control.controls);}
      else if(field.type==='textarea'){input=document.createElement('textarea');input.rows=field.key==='content'?9:4;}
      else if(field.type==='account'){input=document.createElement('select');const empty=element('option','','不关联账户');empty.value='';input.append(empty);for(const account of allRecords().filter(item=>item.module==='财务管理'&&financeVariant(item)==='account'&&(!field.accountType||item.fields.kind===field.accountType)&&(!item.fields.investmentKind||field.accountType==='投资'||investmentCashEnabled(item)))){const option=element('option','',account.title+(account.fields.status==='已停用'?'（已停用）':''));option.value=account.id;input.append(option);}const old=record?.fields[field.key];if(old&&![...input.options].some(option=>option.value===old)){const option=element('option','',old);option.value=old;input.append(option);}}
      else if(field.type==='select'){input=document.createElement('select');for(const value of field.options){const option=element('option','',value);option.value=value;input.append(option);}}
      else{input=document.createElement('input');input.type=field.type==='money'?'text':field.type==='decimal'?'number':field.type;input.autocomplete='off';if(field.type==='money'){input.inputMode='decimal';input.placeholder='0.00';}if(field.type==='number'||field.type==='decimal'){input.step=field.type==='decimal'?'0.'+'0'.repeat((field.precision||2)-1)+'1':'1';input.min=field.min??0;if(field.max!==undefined)input.max=field.max;}}
      input.name=field.key;input.id='record-field-'+field.key;input.required=!!field.required;input.maxLength=field.max||10000;input.value=record?.fields[field.key]??(field.options?.[0]||(field.key==='year'?String(new Date().getFullYear()):field.key==='weekStart'?financeWeek:['date','started'].includes(field.key)?(moduleName==='财务管理'&&activeVariant==='ledger'&&(localDay()<financeWeek||localDay()>addDays(financeWeek,6))?financeWeek:localDay()):field.key==='target'?(def.kind==='habit'?'7':'100'):field.key==='current'?'0':''));
      if(def.kind==='investment'&&record&&investmentEvents(record,allRecords()).length&&['kind','symbol','quantity','cost','account'].includes(field.key))input.disabled=true;
      label.append(input);fragment.append(label);
    }
    $('module-fields').replaceChildren(fragment);if(def.kind==='investment'){const query=button('查询行情',safe(async()=>{query.disabled=true;try{const kind=$('record-field-kind').value,code=$('record-field-symbol').value.trim()||(kind==='贵金属'?'GOLD':'');const result=await api.refreshMarket([{kind,code}]);const quote=result.quotes.find(item=>item.kind===kind&&item.code===code);if(!quote)throw new Error('未获得对应品种行情，原内容已保留。');$('record-field-symbol').value=code;$('record-field-price').value=quote.price;$('record-field-date').value=quote.date;if(!$('module-record-title').value.trim())$('module-record-title').value=quote.name;}finally{query.disabled=false;}}));$('module-fields').append(query);const labels=()=>{const kind=$('record-field-kind').value,managed=managedInvestmentAccount(kind,allRecords()),account=$('record-field-account');if(!account.disabled){const legacy=record?.fields.account&&allRecords().find(r=>r.id===record.fields.account&&!r.fields.investmentKind);account.parentElement.hidden=!!managed&&!legacy;if(managed&&!legacy)account.value=managed.id;else if(allRecords().find(r=>r.id===account.value)?.fields.investmentKind)account.value='';}const map=kind==='股票'?['股票名称','股票代码','单位成本','现价','初始份额']:kind==='基金'?['基金名称','基金代码','成本净值','最新净值','初始份额']:kind==='贵金属'?['贵金属名称','行情标识（积存金填 GOLD）','克重成本','克重现价','初始克重']:['投资名称','代码','单位成本','参考价格','初始数量'];$('module-record-title-label').textContent=map[0];for(const [index,key] of ['symbol','cost','price','quantity'].entries())$('record-field-'+key).parentElement.firstChild.textContent=map[index+1];};$('record-field-kind').onchange=labels;labels();const code=$('record-field-symbol');$('module-fields').prepend(code.parentElement);attachInvestmentLookup({dialog:$('module-dialog'),code,kind:$('record-field-kind'),title:$('module-record-title'),price:$('record-field-price'),date:$('record-field-date'),records:allRecords,refresh:api.refreshMarket,onSelect:labels});}$('attachment-editor').hidden=!def.attachment;$('record-file').accept=def.attachment==='image'?'image/png,image/jpeg,image/webp,image/gif':'';$('remove-record-file').hidden=!draftAttachment;showAttachment();$('module-dialog').showModal();(def.kind==='investment'&&!$('record-field-symbol').disabled?$('record-field-symbol'):$('module-record-title')).focus();
  }
  function showAttachment(){$('record-file-name').textContent=draftAttachment?`${draftAttachment.name} · ${bytes(draftAttachment.size)}`:'未选择文件';$('remove-record-file').hidden=!draftAttachment;}
  async function toggleDay(record,date){
    await api.write(state=>{const current=state.data.records.find(item=>item.id===record.id);if(!current)return;const days=new Set(current.checkins);days.has(date)?days.delete(date):days.add(date);current.checkins=[...days].sort();current.version=uid();current.updatedAt=new Date().toISOString();});
  }
  function actions(card,record,{detail=false}={}){
    const row=element('div','record-actions');
    if(detail)row.append(button('查看',()=>showDetail(record),'button text-button'));
    if(record.attachment)row.append(button(definition().kind==='image'?'查看图片':'下载文件',safe(()=>openAttachment(record)), 'button text-button'));
    row.append(button('编辑',()=>edit(record),'button text-button'),button('删除',()=>{$('module-delete-dialog').showModal();$('module-delete-confirm').onclick=safe(async()=>{await api.write(state=>{if(!state.data.records.some(item=>item.id===record.id))return;if(record.module==='财务管理'&&financeVariant(record)==='investment'&&investmentEvents(record,state.data.records).length)throw new Error('已有交易或基金申请的持仓不能删除，请通过交易调整。');if(record.variant==='account'&&record.fields.investmentKind)throw new Error('固定投资条目不能删除，可在账户设置中关闭资金账户。');if(record.module==='财务管理'&&financeVariant(record)==='account'&&state.data.records.some(item=>item.id!==record.id&&item.module==='财务管理'&&['account','from','to'].some(key=>[record.id,record.title].includes(item.fields[key]))))throw new Error('该账户仍有关联收支或回收记录，可先编辑为已停用。');state.data.records=state.data.records.filter(item=>item.id!==record.id);state.data.recordTombstones.push({id:record.id,version:uid(),updatedAt:new Date().toISOString()});});$('module-delete-dialog').close();});},'button text-button destructive'));
    if(record.variant==='account'&&record.fields.investmentKind)row.lastChild.remove();
    if(record.module==='财务管理'&&financeVariant(record)==='account'&&investmentCashEnabled(record))row.insertBefore(button('余额调整',()=>accountView.adjust(record),'button text-button'),record.fields.investmentKind?null:row.lastChild);
    if(record.module==='财务管理'&&financeVariant(record)==='account'){for(const action of [...row.children])if(['查看','编辑'].includes(action.textContent))action.remove();row.className='account-swipe-actions';attachAccountSwipe(card,row,()=>showDetail(record));return;}
    card.append(row);
  }
  function showDetail(record){
    if(record.module==='财务管理'&&financeVariant(record)==='investment'){investmentView.detail(record);return;}
    $('detail-title').textContent=record.title;const content=$('detail-content');content.replaceChildren();
    for(const field of getDefinition(record.module,record.variant).fields){const value=record.fields[field.key];if(!value)continue;const section=element('section','detail-field');section.append(element('h3','',field.label));
      if(field.type==='url'){const link=element('a','record-link',value);link.href=value;link.target='_blank';link.rel='noopener noreferrer';section.append(link);}else section.append(element('div','detail-text',field.type==='account'?accountName(value):field.type==='partialdate'?displayPartialDate(value):value));content.append(section);
    }
    if(record.module==='财务管理'&&financeVariant(record)==='account'){content.prepend(element('p','account-detail-balance','当前金额 ¥ '+money(accountBalance(record,allRecords()))));const history=allRecords().filter(item=>item.module==='财务管理'&&financeVariant(item)==='account-entry'&&['account','from','to'].some(key=>item.fields[key]===record.id)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));if(history.length){const section=element('section','detail-field');section.append(element('h3','','余额操作记录'));for(const item of history)meta(section,item.fields.date,item.fields.kind==='转账'?accountName(item.fields.from)+' → '+accountName(item.fields.to)+' · ¥ '+item.fields.amount:item.fields.method+' · '+item.fields.delta);content.append(section);}}
    if(record.attachment)content.append(button('下载文件',safe(()=>openAttachment(record))));
    if(getDefinition(record.module,record.variant).kind==='text')content.append(button('复制正文',safe(async()=>{await navigator.clipboard.writeText(record.fields.content);api.toast('已复制正文');})));
    if(record.module==='财务管理'&&financeVariant(record)==='account')content.append(button('编辑',()=>{$('detail-dialog').close();edit(record);},'button primary account-detail-edit'));
    $('detail-dialog').showModal();
  }
  async function openAttachment(record){
    const asset=await api.getAsset(record.attachment);if(!asset)throw new Error('此文件尚未缓存，请配置令牌并联网下载。');
    const url=URL.createObjectURL(asset.blob);urls.push(url);
    if(getDefinition(record.module,record.variant).kind==='image'){$('detail-title').textContent=record.title;$('detail-content').replaceChildren();const image=document.createElement('img');image.className='detail-image';image.src=url;image.alt=record.title;$('detail-content').append(image,button('下载图片',()=>download(url,record.attachment.name)));$('detail-dialog').showModal();}
    else download(url,record.attachment.name);
  }
  function download(url,name){const link=document.createElement('a');link.href=url;link.download=name;link.click();}
  function progressBar(card,record){const percentage=progress(record),track=element('div','progress-track'),fill=element('span');fill.style.width=percentage+'%';track.setAttribute('role','progressbar');track.setAttribute('aria-label','完成进度');track.setAttribute('aria-valuenow',percentage);track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.append(fill);card.append(track,element('div','progress-label',`${record.fields.current||0} / ${record.fields.target||record.fields.total||0} ${record.fields.unit||(getDefinition(record.module,record.variant).kind==='book'?'页':getDefinition(record.module,record.variant).kind==='saving'?'元':'')} · ${percentage}%`));}
  function stat(label,value){const card=element('div','module-stat');card.append(element('span','',label),element('strong','',value));return card;}
  function renderSubnav(){
    const nav=$('module-subnav'),tabs=moduleName==='财务管理'?FINANCE_TABS:moduleName==='素材收集'?[{id:'text',label:'文字'},{id:'image',label:'图片'},{id:'file',label:'文件'}]:[];
    nav.hidden=!tabs.length;nav.replaceChildren();
    for(const tab of tabs){const node=button(tab.label,()=>{activeVariant=tab.id;query='';filter='';month='';$('module-query').value='';render(moduleName,api.state().data);},'module-tab'+(activeVariant===tab.id?' active':''));node.setAttribute('aria-pressed',String(activeVariant===tab.id));nav.append(node);}
  }
  function renderFinanceStats(container,records){
    const report=weekReport(records,financeWeek),cash=value=>'¥ '+money(value),items=variant=>records.filter(record=>financeVariant(record)===variant);
    if(activeVariant==='account'){const totals=assetTotals(records),debt=stat('负债',cash(totals.debt));debt.append(element('div','debt-ratio','负债率 '+(totals.ratio===null?'—':totals.ratio+'%')));container.append(stat('净资产',cash(totals.net)),stat('总资产',cash(totals.assets)),debt);}
    else if(activeVariant==='investment'){const totals=investmentTotals(records),available=records.filter(record=>record.module==='财务管理'&&financeVariant(record)==='account'&&normalizeAccountType(record.fields.kind)==='投资').reduce((sum,account)=>sum+accountCashBalance(account,records),0);container.append(stat('投资总市值','¥ '+money(totals.current)),stat('可用余额',cash(available)),stat('持仓收益额',totals.change===null?'—':'¥ '+money(totals.change)),stat('持仓收益率',totals.rate===null?'—':totals.rate.toFixed(2)+'%'));for(const card of [...container.children].slice(-2))card.classList.add(investmentProfitClass(totals.change));}
    else if(activeVariant==='saving'){const goals=items('saving'),target=goals.reduce((sum,record)=>sum+amountCents(record.fields.target),0),current=goals.reduce((sum,record)=>sum+amountCents(record.fields.current),0);container.append(stat('目标金额',cash(target)),stat('已存金额',cash(current)),stat('待存金额',cash(Math.max(0,target-current))));}
    else if(activeVariant==='recovery')container.append(stat('支出后结余',report.hasBudget?cash(report.surplus):'未设置预算'),stat('已回收',cash(report.recovered)),stat('可回收结余',report.hasBudget?cash(report.available):'—'));
    else if(activeVariant==='analysis')container.append(stat('实际支出占预算',report.ratio===null?'—':report.ratio+'%'),stat('已回收',cash(report.recovered)),stat('可用结余',report.hasBudget?cash(report.available):'—'));
    else container.append(stat('本周固定预算',report.hasBudget?cash(report.budget):'未设置'),stat('本周实际支出',cash(report.spent)),stat('回收后可用结余',report.hasBudget?cash(report.available):'—'));
  }
  function renderFinanceAnalysis(records,panel=$('finance-analysis')){
    panel.replaceChildren();panel.hidden=moduleName!=='财务管理'||!(['ledger','analysis'].includes(activeVariant)||(activeVariant==='budget'&&panel.id==='budget-analysis'));if(panel.hidden)return;
    const report=weekReport(records,financeWeek);
    if(activeVariant==='ledger'){
      const summary=element('div','finance-summary');const accounts=records.filter(record=>financeVariant(record)==='account'&&record.fields.include!=='不计入总览');meta(summary,'净资产','¥ '+money(assetTotals(records).net));summary.append(element('h3','','本周收支'),element('p','',`收入 ¥ ${money(financeTotals(report.ledger).income)} · 已回收 ¥ ${money(report.recovered)}`));
      const categories=new Map();for(const record of report.ledger.filter(item=>item.fields.kind==='支出')){const key=record.fields.category||'未分类';categories.set(key,(categories.get(key)||0)+amountCents(record.fields.amount));}
      for(const [category,total] of [...categories].sort((a,b)=>b[1]-a[1]))meta(summary,category,'¥ '+money(total));panel.append(summary);return;
    }
    const formula=element('p','finance-formula','可用结余 = 周固定预算 − 实际支出 − 手动回收金额');panel.append(formula);
    const wrapper=element('div','finance-table-wrap'),table=element('table','finance-table'),head=element('thead'),header=element('tr');for(const label of ['预算周','固定预算','实际支出','支出占比','已回收','可用结余'])header.append(element('th','',label));head.append(header);table.append(head);const body=element('tbody');
    for(let offset=0;offset<8;offset++){const rowReport=weekReport(records,addDays(financeWeek,-7*offset)),row=element('tr');for(const value of [rowReport.start,rowReport.hasBudget?money(rowReport.budget):'—',money(rowReport.spent),rowReport.ratio===null?'—':rowReport.ratio+'%',money(rowReport.recovered),rowReport.hasBudget?money(rowReport.available):'—'])row.append(element('td','',value));body.append(row);}table.append(body);wrapper.append(table);panel.append(wrapper);
  }
  function renderBudgetWorkspace(records,show){
    const root=$('budget-panel');root.hidden=!show;root.replaceChildren();if(!show)return;
    const report=weekReport(records,financeWeek),budgets=records.filter(r=>financeVariant(r)==='budget'&&r.fields.weekStart<=financeWeek).sort((a,b)=>b.fields.weekStart.localeCompare(a.fields.weekStart)||b.updatedAt.localeCompare(a.updatedAt)),current=budgets[0],exact=budgets.find(r=>r.fields.weekStart===financeWeek);
    function section(title,action,label){const section=element('section','budget-section'),heading=element('div','budget-section-heading');heading.append(element('h2','',title));if(action)heading.append(button(label,action,'button text-button'));section.append(heading);root.append(section);return section;}
    function recordCard(section,record){const card=element('article','record-card');card.append(element('h3','record-title',record.title));renderFinanceCard(card,record);if(record.fields.note)card.append(element('p','record-excerpt',record.fields.note));actions(card,record,{detail:true});section.append(card);}
    const budget=section('固定预算',()=>edit(exact||null,'budget'),exact?'编辑本周预算':'设置周预算');budget.id='budget-fixed';if(current)recordCard(budget,current);else budget.append(element('p','budget-empty','未设置周预算'));
    const recovery=section('结余回收',()=>edit(null,'recovery'),'记录回收');recovery.id='budget-recovery';const recoveries=records.filter(r=>financeVariant(r)==='recovery'&&r.fields.weekStart===financeWeek).sort((a,b)=>b.fields.date.localeCompare(a.fields.date)||b.updatedAt.localeCompare(a.updatedAt));for(const record of recoveries)recordCard(recovery,record);if(!recoveries.length)recovery.append(element('p','budget-empty','本周暂无回收记录'));
    const analysis=section('克制分析');analysis.classList.add('budget-analysis-section');const stats=element('div','module-stats budget-analysis-stats');stats.append(stat('实际支出占预算',report.ratio===null?'—':report.ratio+'%'),stat('已回收','¥ '+money(report.recovered)),stat('可用结余',report.hasBudget?'¥ '+money(report.available):'—'));analysis.append(stats);const panel=element('div','finance-analysis');panel.id='budget-analysis';analysis.append(panel);renderFinanceAnalysis(records,panel);
  }
  function renderFinanceCard(card,record){
    const fields=record.fields,variant=financeVariant(record),cash=value=>'¥ '+money(value);
    if(variant==='account'){const title=card.querySelector('.record-title'),row=element('div','account-overview'),identity=element('div','account-identity');identity.append(title);if(fields.note)identity.append(element('p','account-note',fields.note));row.append(identity,element('strong','account-balance',cash(accountBalance(record,allRecords()))));card.append(row);}
    if(variant==='budget'){card.append(element('strong','finance-amount',cash(amountCents(fields.amount))+' / 周'));meta(card,'生效周',fields.weekStart);}
    if(variant==='recovery'){card.append(element('strong','finance-amount',cash(amountCents(fields.amount))));meta(card,'预算周',fields.weekStart);meta(card,'回收日期',fields.date);meta(card,'转出账户',accountName(fields.from));meta(card,'转入账户',accountName(fields.to));}
    if(variant==='investment'){const value=investmentValue(record);card.append(element('strong','finance-amount',cash(value.current)));meta(card,'代码',fields.symbol);meta(card,'成本价 / 观察价',fields.cost+' / '+fields.price);meta(card,'数量',fields.quantity);meta(card,'观察盈亏',cash(value.change));meta(card,'价格记录日期',fields.date);}
    if(variant==='saving'){progressBar(card,record);meta(card,'关联账户',accountName(fields.account));meta(card,'目标日期',fields.due);}
  }
  function exportCurrent(){
    const def=definition(),escape=value=>{let text=String(value??'');if(/^[=+@\-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
    const rows=[[def.titleLabel,...def.fields.map(field=>field.label)],...selected().map(record=>[record.title,...def.fields.map(field=>record.fields[field.key])])];const blob=new Blob(['\ufeff'+rows.map(row=>row.map(escape).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob);download(url,moduleName+'-'+localDay()+'.csv');setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function render(name,data){
    if(name!==moduleName){moduleName=name;activeVariant=name==='财务管理'?'account':name==='素材收集'?'text':'base';query='';filter='';month='';$('module-query').value='';$('module-month').value='';}
    if(activeVariant==='account'&&name==='财务管理'){query='';filter='';$('module-query').value='';}
    const currentEpoch=++epoch;cleanup();const def=definition(),moduleRecords=(data.records||[]).filter(record=>record.module===name&&!['reading-title','workspace-profile'].includes(record.variant)),records=moduleRecords.filter(record=>name==='财务管理'?financeVariant(record)===activeVariant:name==='素材收集'?(record.variant||'text')===activeVariant:true);
    readingView.render(name==='图书管理');investmentView.render(moduleRecords,name==='财务管理'&&activeVariant==='investment');document.querySelector('.module-panel').hidden=name==='财务管理'&&['investment','budget'].includes(activeVariant);renderBudgetWorkspace(moduleRecords,name==='财务管理'&&activeVariant==='budget');
    document.querySelector('.module-workspace').hidden=name==='图书管理';
    renderSubnav();$('finance-weekbar').hidden=name!=='财务管理'||!['ledger','budget','recovery','analysis'].includes(activeVariant);$('finance-week').value=financeWeek;$('finance-week-range').textContent=financeWeek+' 至 '+addDays(financeWeek,6);$('module-export').hidden=!['基础情况','学工经历'].includes(name);$('new-task').hidden=def.kind==='analysis';
    if(name==='图书管理')$('new-task').hidden=true;
    $('module-kind').textContent=name==='图书管理'?'个人书目':def.label;$('new-task').textContent=def.kind==='profile'&&records.length?'编辑资料':def.action;if(name==='财务管理'&&activeVariant==='budget')$('new-task').textContent=records.some(r=>r.fields.weekStart===financeWeek)?'编辑本周预算':'设置周预算';
    const select=$('module-filter'),selectField=def.fields.find(field=>field.key==='status'||field.key==='kind');select.replaceChildren();const all=element('option','','全部');all.value='';select.append(all);
    if(selectField)for(const option of selectField.options){const node=element('option','',option);node.value=option;select.append(node);}select.value=filter;select.hidden=!selectField;
    $('module-month').hidden=true;
    let visible=records.filter(record=>{
      if(!JSON.stringify([record.title,Object.values(record.fields)]).toLowerCase().includes(query.toLowerCase()))return false;
      if(filter&&record.fields[selectField?.key]!==filter)return false;
      if(name==='财务管理'&&activeVariant==='ledger')return record.fields.date>=financeWeek&&record.fields.date<=addDays(financeWeek,6);
      if(name==='财务管理'&&activeVariant==='recovery')return record.fields.weekStart===financeWeek;
      return true;
    });
    if(def.kind==='investment')visible=[];
    visible.sort(def.kind==='experience'?experienceOrder:def.kind==='account'?(a,b)=>{if(a.fields.investmentKind&&b.fields.investmentKind)return INVESTMENT_ACCOUNT_KINDS.indexOf(a.fields.investmentKind)-INVESTMENT_ACCOUNT_KINDS.indexOf(b.fields.investmentKind);if(a.fields.kind==='投资'&&b.fields.kind==='投资'&&!!a.fields.investmentKind!==!!b.fields.investmentKind)return a.fields.investmentKind?-1:1;return b.updatedAt.localeCompare(a.updatedAt);}:(a,b)=>b.updatedAt.localeCompare(a.updatedAt));
    $('module-count').textContent=visible.length+' 项';
    const stats=$('module-stats');stats.replaceChildren();stats.hidden=false;stats.classList.toggle('investment-assets-stats',name==='财务管理'&&activeVariant==='investment');stats.classList.toggle('account-assets-stats',name==='财务管理'&&activeVariant==='account');
    if(name==='财务管理'){if(activeVariant==='account')stats.hidden=true;else renderFinanceStats(stats,moduleRecords);}
    else if(def.kind==='body'){const byDate=[...records].sort((a,b)=>(b.fields.date||'').localeCompare(a.fields.date||''));const weight=byDate.find(record=>record.fields.weight),sleep=byDate.find(record=>record.fields.sleep);stats.append(stat('最近体重',weight?weight.fields.weight+' kg':'—'),stat('最近睡眠',sleep?sleep.fields.sleep+' 小时':'—'),stat('跟踪记录',records.length));}
    else if(def.kind==='goal'||def.kind==='theory')stats.append(stat('全部目标',records.length),stat('进行中',records.filter(record=>record.fields.status==='进行中').length),stat('已完成',records.filter(record=>record.fields.status==='已完成').length));
    else if(def.kind==='habit'){const days=weekDays(),today=localDay();stats.append(stat('习惯',records.length),stat('今日已打卡',records.filter(record=>record.checkins.includes(today)).length),stat('本周打卡',records.reduce((count,record)=>count+record.checkins.filter(day=>days.includes(day)).length,0)));}
    else if(def.kind==='book')stats.append(stat('想读',records.filter(record=>record.fields.status==='想读').length),stat('在读',records.filter(record=>record.fields.status==='在读').length),stat('已读',records.filter(record=>record.fields.status==='已读').length));
    else stats.hidden=true;
    document.querySelector('.module-panel-heading').hidden=def.kind==='profile';
    document.querySelector('.module-panel').classList.toggle('account-left-panel',def.kind==='account');$('module-searchbar').hidden=['profile','analysis','account'].includes(def.kind);
    renderFinanceAnalysis(moduleRecords);accountView.renderGoals(moduleRecords,name==='财务管理'&&activeVariant==='account');
    const list=$('module-records');list.className='module-records kind-'+def.kind;const fragment=document.createDocumentFragment();
    const accountGroups=new Map();if(def.kind==='account')for(const kind of ACCOUNT_TYPES){const section=element('section','account-group');section.append(element('h3','account-group-title',kind));const rows=element('div','account-group-rows');section.append(rows);accountGroups.set(kind,{section,rows});}
    for(const record of visible){
      const card=element('article','record-card');
      if(record.conflictOf)card.append(element('span','conflict-tag','冲突副本'));
      if(def.kind==='image'){const wrapper=element('button','image-preview');wrapper.type='button';wrapper.setAttribute('aria-label','查看图片：'+record.title);wrapper.append(element('span','','图片'));wrapper.onclick=safe(()=>openAttachment(record));card.append(wrapper);
        api.getAsset(record.attachment,true).then(asset=>{if(!asset||currentEpoch!==epoch)return;const url=URL.createObjectURL(asset.blob);urls.push(url);const image=document.createElement('img');image.src=url;image.alt=record.title;image.loading='lazy';wrapper.replaceChildren(image);}).catch(()=>{});
      }
      const title=element('h3','record-title',record.title);card.append(title);
      if(def.kind==='profile'){
        const photo=element('img','personal-photo');photo.src=workspaceProfile(api.state().data).photo||'./icon.svg';photo.alt='个人头像';const heading=element('div','personal-heading'),identity=element('div','personal-identity');identity.append(title);if(record.fields.email)identity.append(element('p','','邮箱：'+record.fields.email));if(record.fields.phone)identity.append(element('p','','联系方式：'+record.fields.phone));heading.append(photo,identity);card.append(heading);const grid=element('div','profile-values');for(const key of ['gender','birthday','occupation','politics','hometown','address','intro']){const field=def.fields.find(item=>item.key===key),cell=element('div','profile-value'+(['hometown','address','intro'].includes(key)?' full':''));cell.append(element('span','profile-label',field.label),element('div','',key==='birthday'?displayPartialDate(record.fields[key]):record.fields[key]));grid.append(cell);}card.append(grid);actions(card,record);
      }else if(def.kind==='experience'){const heading=element('div','experience-heading');heading.append(title,element('span','record-tag',record.fields.kind||'经历'));card.append(heading);const line=element('div','experience-line');if(record.fields.start||record.fields.end)line.append(element('span','experience-date',(record.fields.start?displayPartialDate(record.fields.start)+' - ':'')+(record.fields.end?displayPartialDate(record.fields.end):'至今')));if(record.fields.role)line.append(element('span','experience-role',record.fields.role));card.append(line);if(record.fields.details)card.append(element('p','record-excerpt',record.fields.details));actions(card,record,{detail:true});
      }else if(def.kind==='finance'){const amount=element('strong','finance-amount '+(record.fields.kind==='收入'?'income':'expense'),(record.fields.kind==='收入'?'+':'−')+' ¥ '+money(amountCents(record.fields.amount)));card.append(amount);meta(card,'日期',record.fields.date);meta(card,'分类',record.fields.category);meta(card,'账户',accountName(record.fields.account));actions(card,record,{detail:true});
      }else if(def.kind==='goal'||def.kind==='theory'){card.append(element('span','record-tag',record.fields.status));progressBar(card,record);meta(card,'截止',record.fields.due);if(record.fields.plan||record.fields.notes)card.append(element('p','record-excerpt',preview(record.fields.plan||record.fields.notes)));if(record.fields.source)meta(card,'学习来源',record.fields.source);if(record.fields.sport)meta(card,'运动项目',record.fields.sport);actions(card,record,{detail:true});
      }else if(def.kind==='account'||def.kind==='budget'||def.kind==='recovery'||def.kind==='investment'||def.kind==='saving'){renderFinanceCard(card,record);actions(card,record,{detail:true});
      }else if(def.kind==='body'){meta(card,'日期',record.fields.date);meta(card,'体重',record.fields.weight?record.fields.weight+' kg':'');meta(card,'身高',record.fields.height?record.fields.height+' cm':'');meta(card,'腰围',record.fields.waist?record.fields.waist+' cm':'');meta(card,'睡眠',record.fields.sleep?record.fields.sleep+' 小时':'');meta(card,'运动',record.fields.exercise?record.fields.exercise+' 分钟':'');actions(card,record,{detail:true});
      }else if(def.kind==='habit'){const today=localDay(),days=weekDays(),checked=record.checkins.includes(today);const row=element('div','habit-days');days.forEach((day,index)=>{const btn=button(['一','二','三','四','五','六','日'][index],safe(()=>toggleDay(record,day)),'day-button'+(record.checkins.includes(day)?' checked':'')+(day===today?' today':''));btn.title=day;btn.setAttribute('aria-label',day+(record.checkins.includes(day)?' 已打卡':' 未打卡'));btn.setAttribute('aria-pressed',String(record.checkins.includes(day)));btn.disabled=day>today;row.append(btn);});card.append(row);meta(card,'本周',`${record.checkins.filter(day=>days.includes(day)).length} / ${record.fields.target} 天`);card.append(button(checked?'取消今日打卡':'今日打卡',safe(()=>toggleDay(record,today)), 'button '+(checked?'':'primary')));actions(card,record);
      }else if(def.kind==='book'){card.append(element('span','record-tag',record.fields.status));meta(card,'作者',record.fields.author);if(record.fields.total)progressBar(card,record);if(record.fields.notes)card.append(element('p','record-excerpt',preview(record.fields.notes)));actions(card,record,{detail:true});
      }else if(def.kind==='text'){meta(card,'标签',record.fields.tags);card.append(element('p','record-excerpt text-excerpt',preview(record.fields.content,220)));actions(card,record,{detail:true});
      }else if(def.kind==='image'){meta(card,'标签',record.fields.tags);if(record.attachment)meta(card,'文件',bytes(record.attachment.size));actions(card,record);
      }else {if(def.kind==='policy'){card.append(element('span','record-tag',record.fields.status));meta(card,'文号',record.fields.number);meta(card,'发布机构',record.fields.issuer);meta(card,'施行日期',record.fields.effective);}else meta(card,'分类',record.fields.category);meta(card,'日期',record.fields.date);if(record.attachment)meta(card,'附件',record.attachment.name+' · '+bytes(record.attachment.size));actions(card,record,{detail:true});}
      if(def.kind==='account')accountGroups.get(normalizeAccountType(record.fields.kind)).rows.append(card);else fragment.append(card);
    }
    if(def.kind==='account')for(const group of accountGroups.values())if(group.rows.children.length)fragment.append(group.section);
    list.replaceChildren(fragment);$('module-empty').hidden=visible.length>0||def.kind==='analysis';$('module-empty-title').textContent=query||filter||month?'没有匹配的内容':'暂无'+def.label;$('module-empty-add').hidden=!!(query||filter||month);$('module-empty-add').textContent=def.action;
    $('legacy-block').hidden=!(data.tasks||[]).some(task=>(task.category||'基础情况')===name);$('legacy-count').textContent=(data.tasks||[]).filter(task=>(task.category||'基础情况')===name).length+' 项';
    $('module-sync-status').textContent=api.syncStatus();
    if(def.kind==='profile')$('module-sync-status').textContent=syncDate(api.state().lastSync);
  }
  $('module-export').onclick=()=>exportCurrent();
  $('finance-week').onchange=event=>{if(!event.target.value)return;financeWeek=mondayOf(event.target.value);render(moduleName,api.state().data);};$('finance-prev-week').onclick=()=>{financeWeek=addDays(financeWeek,-7);render(moduleName,api.state().data);};$('finance-next-week').onclick=()=>{financeWeek=addDays(financeWeek,7);render(moduleName,api.state().data);};
  $('module-query').oninput=event=>{query=event.target.value;render(moduleName,api.state().data);};$('module-filter').onchange=event=>{filter=event.target.value;render(moduleName,api.state().data);};$('module-month').onchange=event=>{month=event.target.value;render(moduleName,api.state().data);};
  $('module-empty-add').onclick=()=>edit();$('new-task').onclick=()=>edit(moduleName==='财务管理'&&activeVariant==='budget'?allRecords().find(r=>r.module==='财务管理'&&financeVariant(r)==='budget'&&r.fields.weekStart===financeWeek)||null:definition().kind==='profile'?selected()[0]||null:null);
  $('module-form').onsubmit=safe(async event=>{event.preventDefault();const fields={...original?.fields};for(const field of editorDefinition().fields)if(!field.internal)fields[field.key]=$('record-field-'+field.key).value.trim();
    if(editorDefinition().kind==='workfile'&&!draftAttachment&&!fields.url)throw new Error('请选择文件或填写文件链接。');
    if(editorDefinition().kind==='policy'&&!draftAttachment&&!fields.url&&!fields.content)throw new Error('请添加附件、原文链接或政策内容。');
    const record={id:original?.id||uid(),module:moduleName,variant:formVariant,title:$('module-record-title').value.trim(),fields,attachment:draftAttachment,checkins:original?.checkins||[],version:uid(),updatedAt:'',createdAt:original?.createdAt||''};await putRecord(record);$('module-dialog').close();});
  $('choose-record-file').onclick=()=>$('record-file').click();$('remove-record-file').onclick=()=>{draftAttachment=null;showAttachment();};
  $('record-file').onchange=safe(async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>FILE_LIMIT)throw new Error('单个文件不能超过 8 MB。');if(editorDefinition().attachment==='image'&&!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type))throw new Error('请选择 PNG、JPG、WebP 或 GIF 图片。');const id=uid();draftAttachment={id,path:'data/assets/'+id,name:file.name,type:file.type||'application/octet-stream',size:file.size};await api.saveAsset({...draftAttachment,blob:file,uploadedRepos:{}});if(!$('module-record-title').value.trim())$('module-record-title').value=file.name.slice(0,200);showAttachment();}finally{event.target.value='';}});
  $('legacy-download').onclick=safe(async()=>{const tasks=api.state().data.tasks.filter(task=>(task.category||'基础情况')===moduleName);const blob=new Blob([JSON.stringify({schemaVersion:1,tasks,tombstones:[]},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);download(url,moduleName+'-原有任务.json');setTimeout(()=>URL.revokeObjectURL(url),1000);});
  return {render,edit};
}

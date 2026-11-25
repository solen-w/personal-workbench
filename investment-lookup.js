import {searchInvestmentCatalog} from './investment-catalog.js?v=20261125-investment-7';
// 代码联想仅填充品种和报价，保留用户输入的成本、份额与资金账户。
export function attachInvestmentLookup({dialog,code,kind,title,price,date,records,refresh,onSelect,catalog=searchInvestmentCatalog,delay=150}){
  if(code.disabled)return;
  const results=document.createElement('div');results.id='investment-code-results';results.className='investment-code-results';results.hidden=true;results.setAttribute('role','listbox');results.setAttribute('aria-label','匹配的投资品种');code.parentElement.append(results);
  code.placeholder='输入六位股票或基金代码';code.inputMode='numeric';code.setAttribute('role','combobox');code.setAttribute('aria-autocomplete','list');code.setAttribute('aria-controls',results.id);code.setAttribute('aria-expanded','false');
  let timer,revision=0,closed=false,items=[],active=-1,running=false,queued=null;
  const valid=()=>!closed&&code.isConnected&&dialog.open;
  const hide=()=>{results.hidden=true;code.setAttribute('aria-expanded','false');code.removeAttribute('aria-activedescendant');active=-1;};
  const same=q=>q.code.startsWith(code.value.trim())&&['股票','基金'].includes(q.kind);
  function select(q){if(!valid()||!same(q))return;kind.value=q.kind;code.value=q.code;title.value=q.name;if(q.price){price.value=q.price;date.value=q.date;}else{price.value='';date.value='';}revision++;clearTimeout(timer);hide();onSelect();title.focus();}
  function show(quotes,message=''){
    if(!valid())return;items=[...new Map(quotes.filter(same).map(q=>[q.kind+q.code,q])).values()];active=-1;results.replaceChildren();code.removeAttribute('aria-activedescendant');
    for(const [i,q] of items.entries()){const option=document.createElement('button');option.type='button';option.id='investment-code-option-'+i;option.setAttribute('role','option');option.setAttribute('aria-selected','false');option.textContent=q.name+' · '+q.code+' · '+q.kind;option.onmousedown=e=>e.preventDefault();option.onclick=()=>select(q);results.append(option);}
    if(message){const status=document.createElement('div');status.className='investment-lookup-status';status.setAttribute('role','status');status.textContent=message;results.append(status);}results.hidden=false;code.setAttribute('aria-expanded','true');
  }
  const cached=()=>records().filter(r=>r.variant==='investment-quote').map(r=>({...r.fields,name:r.title})).filter(same);
  async function lookup(value,requestRevision){
    if(running){queued={value,requestRevision};return;}running=true;
    try{const matches=await catalog(value).catch(()=>[]);if(valid()&&revision===requestRevision&&matches.length){const saved=new Map(cached().map(q=>[q.kind+q.code,q]));show(matches.map(q=>saved.get(q.kind+q.code)||q));return;}if(value.length!==6){if(valid()&&revision===requestRevision)show(cached(),'未找到对应品种');return;}const result=await refresh([{kind:'股票',code:value},{kind:'基金',code:value}]);if(valid()&&revision===requestRevision&&code.value.trim()===value)show(result.quotes,result.quotes.some(same)?'':'未找到对应品种');}
    catch(e){if(valid()&&revision===requestRevision)show(cached(),e.message||'查询未完成，请稍后重试');}
    finally{running=false;const next=queued;queued=null;if(next&&valid()&&revision===next.requestRevision)lookup(next.value,next.requestRevision);}
  }
  code.oninput=()=>{clearTimeout(timer);const current=++revision,value=code.value.trim();if(!/^\d{2,6}$/.test(value)){hide();return;}show(cached(),'正在查询…');timer=setTimeout(()=>{if(valid()&&revision===current)lookup(value,current);},delay);};
  code.onfocus=()=>{if(/^\d{2,6}$/.test(code.value.trim())&&cached().length)show(cached());};
  code.onkeydown=e=>{if(e.key==='Escape'&&!results.hidden){e.preventDefault();e.stopPropagation();revision++;clearTimeout(timer);hide();return;}if(results.hidden||!items.length)return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();active=(active+(e.key==='ArrowDown'?1:-1)+items.length)%items.length;for(const [i,option] of [...results.querySelectorAll('[role=option]')].entries())option.setAttribute('aria-selected',String(i===active));code.setAttribute('aria-activedescendant','investment-code-option-'+active);}else if(e.key==='Enter'){e.preventDefault();select(items[active<0?0:active]);}};
  code.onblur=()=>setTimeout(()=>{if(!results.contains(document.activeElement))hide();},150);
  kind.addEventListener('change',()=>{revision++;clearTimeout(timer);hide();});
  dialog.addEventListener('close',()=>{closed=true;revision++;clearTimeout(timer);hide();},{once:true});
}

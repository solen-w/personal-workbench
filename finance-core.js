import {investmentAccountState,investmentKind,investmentEvents,investmentPosition,managedInvestmentAccount,investmentAccountId,investmentCashEnabled,INVESTMENT_ACCOUNT_KINDS} from './investment-core.js?v=20261126-calendar-1';
const f=(key,label,type='text',options={})=>({key,label,type,...options});
export const ACCOUNT_TYPES=['现金','储蓄','投资','负债','其他'];
export const normalizeAccountType=value=>({'银行卡':'储蓄','支付宝':'现金','微信':'现金','投资账户':'投资'}[value]||value||'其他');
export const FINANCE_TABS=[{id:'account',label:'账户管理'},{id:'investment',label:'投资观察'},{id:'budget',label:'预算实用'},{id:'ledger',label:'总览统计'},{id:'saving',label:'事项储蓄'}];
export const FINANCE_FORMS={
  ledger:{kind:'finance',label:'收支明细',action:'记一笔',titleLabel:'收支事项',fields:[f('kind','收支类型','select',{options:['支出','收入']}),f('amount','金额','money',{required:true}),f('category','收支分类'),f('date','日期','date',{required:true}),f('account','账户','account'),f('note','备注','textarea')]},
  account:{kind:'account',label:'账户管理',action:'新增账户',titleLabel:'账户名称',fields:[f('kind','账户类型','select',{options:ACCOUNT_TYPES}),f('opening','期初金额','money'),f('include','总览统计','select',{options:['计入总览','不计入总览']}),f('status','使用状态','select',{options:['使用中','已停用']}),f('note','备注','textarea'),f('investmentKind','投资分类','select',{options:INVESTMENT_ACCOUNT_KINDS,internal:true}),f('enabled','资金账户启用','select',{options:['是','否'],internal:true}),f('configConflicts','待核对的账户设置','textarea',{internal:true,max:10000})]},
  'account-entry':{kind:'account-entry',fields:[f('kind','操作类型','select',{options:['调整','转账'],required:true}),f('account','账户','account'),f('delta','调整差额','signedmoney'),f('amount','转账金额','money'),f('from','转出账户','account'),f('to','转入账户','account'),f('direction','转账方向','select',{options:['正常','负债转移']}),f('method','调整方式'),f('date','日期','date',{required:true}),f('note','备注','textarea')]},
  'annual-saving':{kind:'annual-saving',label:'年度存款目标',action:'新增年度目标',titleLabel:'目标名称',fields:[f('year','年度','number',{required:true,min:2000,max:2100}),f('target','目标金额','money',{required:true}),f('note','备注','textarea'),f('status','目标状态','select',{options:['进行中','已归档'],internal:true}),f('archivedCurrent','归档时存款','money',{internal:true}),f('archivedAt','归档时间','text',{internal:true})]},
  budget:{kind:'budget',label:'固定预算',action:'设置周预算',titleLabel:'预算名称',fields:[f('amount','每周固定金额','money',{required:true}),f('weekStart','生效周的周一','date',{required:true}),f('note','备注','textarea')]},
  recovery:{kind:'recovery',label:'结余回收',action:'记录回收',titleLabel:'回收事项',fields:[f('weekStart','所属周的周一','date',{required:true}),f('amount','手动回收金额','money',{required:true}),f('date','回收日期','date',{required:true}),f('from','转出账户（可选）','account'),f('to','转入账户（可选）','account'),f('note','备注','textarea')]},
  investment:{kind:'investment',label:'投资持仓',action:'新增持仓',titleLabel:'投资名称',fields:[f('kind','资产类型','select',{options:['股票','基金','贵金属','其他']}),f('symbol','代码（积存金自动行情使用 GOLD）'),f('cost','单位均价成本','decimal',{precision:4,required:true}),f('price','参考现价 / 净值','decimal',{precision:4}),f('quantity','初始份额 / 克重','decimal',{precision:6,required:true}),f('date','报价日期','date'),f('account','资金账户（可选）','account',{accountType:'投资'}),f('note','备注','textarea'),f('funded','初始化资金登记','select',{options:['是'],internal:true})]},
  'investment-event':{kind:'investment-event',fields:[f('holdingId','持仓编号','text',{required:true}),f('action','交易操作','select',{options:['trade','apply','confirm','arrive','cancel','fail','resolve','correct'],required:true}),f('orderId','基金申请编号'),f('sequence','顺序','number',{required:true,min:1}),f('data','交易内容','textarea',{required:true,max:10000})]},
  'investment-quote':{kind:'investment-quote',fields:[f('kind','行情类别','select',{options:['股票','基金','贵金属'],required:true}),f('code','代码','text',{required:true}),f('price','报价','decimal',{precision:4,required:true}),f('date','报价日期','date',{required:true}),f('asOf','供应商报价时间','text',{required:true}),f('source','来源','select',{options:['tencent','eastmoney','jdjygold'],required:true})]},
  analysis:{kind:'analysis',label:'克制分析',action:'',titleLabel:'',fields:[]},
  saving:{kind:'saving',label:'事项储蓄',action:'新增事项储蓄',titleLabel:'目标名称',fields:[f('target','目标金额','money',{required:true}),f('current','已存金额','money',{required:true}),f('account','关联账户','account'),f('due','目标日期','date'),f('plan','存款计划','textarea')]}
};
export const financeVariant=record=>record.variant||'ledger';
export function signedCents(value){const text=String(value||'0');return text.startsWith('-')?-amountCents(text.slice(1)):amountCents(text);}
export const decimalMoney=cents=>(cents/100).toFixed(2);
export function amountCents(value){const text=String(value||'0').trim();if(!/^\d{1,9}(?:\.\d{1,2})?$/.test(text))throw new Error('金额需为非负数，最多两位小数。');const [whole,decimal='']=text.split('.');return Number(whole)*100+Number(decimal.padEnd(2,'0'));}
export function money(cents){return (cents/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});}
export function financeTotals(records){let income=0,expense=0;for(const record of records){if(record.module!=='财务管理'||financeVariant(record)!=='ledger')continue;const amount=amountCents(record.fields.amount);if(record.fields.kind==='收入')income+=amount;else expense+=amount;}return {income,expense,balance:income-expense};}
export function addDays(day,offset){const date=new Date(day+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10);}
export function mondayOf(day){const date=new Date(day+'T00:00:00Z');return addDays(day,-((date.getUTCDay()+6)%7));}
export function weekReport(records,start){
  const end=addDays(start,6),items=records.filter(record=>record.module==='财务管理');
  const budgets=items.filter(record=>financeVariant(record)==='budget'&&record.fields.weekStart<=start).sort((a,b)=>b.fields.weekStart.localeCompare(a.fields.weekStart)||b.updatedAt.localeCompare(a.updatedAt));
  const budgetRecord=budgets[0],budget=budgetRecord?amountCents(budgetRecord.fields.amount):0;
  const ledger=items.filter(record=>financeVariant(record)==='ledger'&&record.fields.date>=start&&record.fields.date<=end);
  const spent=financeTotals(ledger).expense;
  const recovered=items.filter(record=>financeVariant(record)==='recovery'&&record.fields.weekStart===start).reduce((sum,record)=>sum+amountCents(record.fields.amount),0);
  return {start,end,budget,spent,recovered,surplus:budget-spent,available:budget-spent-recovered,ratio:budget>0?Math.round(spent/budget*1000)/10:null,hasBudget:!!budgetRecord,ledger};
}
export function accountCashBalance(account,records){if(!investmentCashEnabled(account))return 0;const debt=normalizeAccountType(account.fields.kind)==='负债';let balance=amountCents(account.fields.opening)*(debt?-1:1);const matches=value=>value===account.id||(!account.fields.investmentKind&&value===account.title);
  for(const record of records){if(record.module!=='财务管理')continue;const variant=financeVariant(record);
    if(variant==='ledger'&&matches(record.fields.account)){const amount=amountCents(record.fields.amount);balance+=record.fields.kind==='收入'?amount:-amount;}
    if(variant==='recovery'&&record.fields.from&&record.fields.to){const amount=amountCents(record.fields.amount);if(matches(record.fields.from))balance-=amount;if(matches(record.fields.to))balance+=amount;}
    if(variant==='account-entry'){if(record.fields.kind==='调整'&&matches(record.fields.account))balance+=signedCents(record.fields.delta);if(record.fields.kind==='转账'){const amount=amountCents(record.fields.amount)*(record.fields.direction==='负债转移'?-1:1);if(matches(record.fields.from))balance-=amount;if(matches(record.fields.to))balance+=amount;}}
  }return balance*(debt?-1:1)+(debt?0:investmentAccountState(account.id,records).cashChange);
}
export function accountBalance(account,records){const cash=accountCashBalance(account,records),investment=investmentAccountState(account.id,records);return cash+investment.market+(investmentCashEnabled(account)?investment.pending+investment.receivable:0);}
export function assetTotals(records){let assets=0,debt=0,savings=0;for(const account of records.filter(record=>record.module==='财务管理'&&financeVariant(record)==='account'&&record.fields.include!=='不计入总览')){const kind=normalizeAccountType(account.fields.kind),balance=accountBalance(account,records),position=balance*(kind==='负债'?-1:1);if(position>=0)assets+=position;else debt-=position;if(kind==='储蓄')savings+=balance;}return {assets,debt,net:assets-debt,ratio:assets>0?Math.round(debt/assets*1000)/10:null,savings};}
export function annualSavingProgress(goal,records){const current=goal.fields.status==='已归档'?amountCents(goal.fields.archivedCurrent):assetTotals(records).net,target=amountCents(goal.fields.target);return {current,target,percent:target?Math.max(0,Math.min(100,Math.round(current/target*10000)/100)):0,achieved:target>0&&current>=target};}
export function accountOperation(records,accountId,mode,value,toId='',date,note=''){
  if([accountId,toId].filter(Boolean).some(id=>{const account=records.find(r=>r.id===id);return account&&!investmentCashEnabled(account);}))throw new Error('请先在投资账户设置中启用资金账户。');
  const account=records.find(record=>record.module==='财务管理'&&financeVariant(record)==='account'&&record.id===accountId);if(!account)throw new Error('账户已变化，请重新打开。');
  const current=accountBalance(account,records),amount=amountCents(value),debt=normalizeAccountType(account.fields.kind)==='负债';
  if(mode==='transfer'){
    const to=records.find(record=>record.module==='财务管理'&&financeVariant(record)==='account'&&record.id===toId);if(!to||to.id===account.id)throw new Error('请选择不同的转入账户。');
    const targetDebt=normalizeAccountType(to.fields.kind)==='负债';if(debt&&!targetDebt)throw new Error('负债只能转移至另一负债账户；还款请从资产账户转入。');
    if(!amount||amount>Math.max(0,accountCashBalance(account,records)))throw new Error('转移金额需大于零，且不能超过当前余额。');
    if(!debt&&targetDebt&&amount>Math.max(0,accountBalance(to,records)))throw new Error('还款金额不能超过该账户尚欠金额。');
    return {kind:'转账',from:account.id,to:to.id,amount:decimalMoney(amount),direction:debt?'负债转移':'正常',date,note};
  }
  const next=mode==='set'?amount:mode==='add'?current+amount:mode==='subtract'?current-amount:NaN;
  if(!Number.isFinite(next)||next<0)throw new Error('调整后的金额不能小于零。');if(next>99999999999)throw new Error('调整后的金额过大。');
  const delta=(next-current)*(debt?-1:1);if(!debt&&accountCashBalance(account,records)+delta<0)throw new Error('不能减少或转出仍占用于持仓或基金在途中的资金。');if(!delta)throw new Error('余额没有变化。');return {kind:'调整',account:account.id,delta:decimalMoney(delta),method:{set:'直接调整',add:'增加金额',subtract:'减少金额'}[mode],date,note};
}
function scaled(value){if(!/^\d{1,9}(?:\.\d{1,4})?$/.test(String(value)))throw new Error('价格和数量最多保留四位小数。');const [whole,decimal='']=String(value).split('.');return BigInt(whole)*10000n+BigInt(decimal.padEnd(4,'0'));}
export function investmentValue(record){const quantity=scaled(record.fields.quantity),current=(scaled(record.fields.price)*quantity+500000n)/1000000n,cost=(scaled(record.fields.cost)*quantity+500000n)/1000000n;if(current>BigInt(Number.MAX_SAFE_INTEGER)||cost>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('投资记录数值过大。');return {current:Number(current),cost:Number(cost),change:Number(current-cost)};}
export function validateFinanceChange(record,records,editingId){
  if(record.module!=='财务管理')return;
  const variant=financeVariant(record);
  if(['budget','recovery'].includes(variant)&&amountCents(record.fields.amount)===0)throw new Error('预算和回收金额需大于零。');
  if(variant==='saving'&&amountCents(record.fields.target)===0)throw new Error('目标金额需大于零。');
  if(['budget','recovery'].includes(variant)&&mondayOf(record.fields.weekStart)!==record.fields.weekStart)throw new Error('所属预算周请填写周一日期。');
  if(variant==='budget'&&records.some(item=>item.id!==editingId&&item.module==='财务管理'&&financeVariant(item)==='budget'&&item.fields.weekStart===record.fields.weekStart))throw new Error('该周已设置固定预算，请编辑已有预算。');
  if(variant==='recovery'){
    const report=weekReport(records.filter(item=>item.id!==editingId),record.fields.weekStart);if(!report.hasBudget)throw new Error('请先设置该周固定预算。');if(amountCents(record.fields.amount)>Math.max(0,report.available))throw new Error('回收金额不能超过该周当前可回收结余。');
    if(!!record.fields.from!==!!record.fields.to)throw new Error('记录账户转存时，转出和转入账户需同时选择；仅记回收金额可全部留空。');if(record.fields.from&&record.fields.from===record.fields.to)throw new Error('转出和转入账户不能相同。');
  }
  if(variant==='annual-saving'){
    if(!amountCents(record.fields.target))throw new Error('目标金额需大于零。');
    if(record.fields.status!=='已归档'&&records.some(item=>item.id!==editingId&&item.module==='财务管理'&&financeVariant(item)==='annual-saving'&&item.fields.year===record.fields.year&&item.fields.status!=='已归档'))throw new Error('该年度已有进行中的存款目标，请编辑已有目标。');
    if(record.fields.status==='已归档'&&amountCents(record.fields.archivedCurrent)<amountCents(record.fields.target))throw new Error('达成目标后才可归档。');
  }
  if(variant==='account'&&record.fields.kind!=='投资'&&records.some(item=>item.module==='财务管理'&&financeVariant(item)==='investment'&&item.fields.account===record.id))throw new Error('有关联持仓的投资账户不能改为其他类型。');
  if(variant==='account'&&record.fields.investmentKind){if(record.id!==investmentAccountId(record.fields.investmentKind)||record.fields.kind!=='投资')throw new Error('分类投资账户信息不正确。');const next=[...records.filter(r=>r.id!==record.id),record];if(investmentCashEnabled(record)&&accountCashBalance(record,next)<0)throw new Error('初始金额不足以覆盖已有持仓及交易。');}
  if(variant==='investment'){
    const managed=managedInvestmentAccount(investmentKind(record.fields.kind),records);if(managed&&!record.fields.account)record.fields.account=managed.id;
    const old=records.find(item=>item.id===editingId),events=old?investmentEvents(old,records):[];
    if(events.length&&['kind','symbol','quantity','cost','account'].some(key=>record.fields[key]!==old.fields[key]))throw new Error('已有交易的持仓不能改写初始化数据，请使用交易登记。');
    if(record.fields.account){const account=records.find(item=>item.id===record.fields.account&&item.module==='财务管理'&&financeVariant(item)==='account');if(!account||account.fields.kind!=='投资'||(account.fields.investmentKind&&account.fields.investmentKind!==investmentKind(record.fields.kind)))throw new Error('请选择投资类资金账户。');record.fields.funded='是';const next=[...records.filter(item=>item.id!==editingId),record];if(accountCashBalance(account,next)<0)throw new Error('投资账户可用资金不足以登记初始持仓。');}
    else record.fields.funded='';
    if(!old||['kind','symbol','account'].some(key=>record.fields[key]!==old.fields[key])){if(record.fields.symbol&&records.some(item=>item.id!==editingId&&item.module==='财务管理'&&financeVariant(item)==='investment'&&investmentKind(item.fields.kind)===investmentKind(record.fields.kind)&&item.fields.symbol===record.fields.symbol&&item.fields.account===record.fields.account))throw new Error('该账户已有此代码的持仓，请通过交易增减。');}
  }
}

// 分类账户与未关联持仓一次保存，初始金额表示登记持仓之前的资金。
export function configureInvestmentAccounts(records,settings,{version,now}){
  let next=records.map(r=>structuredClone(r));
  for(const kind of INVESTMENT_ACCOUNT_KINDS){const config=settings[kind];if(!config||typeof config.enabled!=='boolean')throw new Error('请设置三个分类账户。');const id=investmentAccountId(kind),old=next.find(r=>r.id===id);if(old&&(old.variant!=='account'||old.fields.investmentKind!==kind))throw new Error('账户编号冲突，请先核对数据。');const opening=config.enabled?config.opening:'';if(config.enabled)amountCents(opening);if(config.enabled&&!String(opening).trim())throw new Error('请填写'+kind+'账户初始金额。');const account={id,module:'财务管理',variant:'account',title:kind,fields:{...old?.fields,kind:'投资',opening,investmentKind:kind,enabled:config.enabled?'是':'否',include:old?.fields.include||'计入总览',status:'使用中',note:old?.fields.note||'',configConflicts:''},version,createdAt:old?.createdAt||now,updatedAt:now};next=next.filter(r=>r.id!==id);next.push(old&&Object.entries(account.fields).every(([k,v])=>(old.fields[k]||'')===v)?old:account);}
  next=next.map(r=>{if(r.module!=='财务管理'||r.variant!=='investment'||r.fields.account)return r;const account=managedInvestmentAccount(investmentKind(r.fields.kind),next);return account?{...r,fields:{...r.fields,account:account.id,funded:'是'},version,updatedAt:now}:r;});
  for(const kind of INVESTMENT_ACCOUNT_KINDS){const account=managedInvestmentAccount(kind,next);if(investmentCashEnabled(account)&&accountCashBalance(account,next)<0)throw new Error(kind+'账户初始金额不足以覆盖持仓和已登记交易。');}
  return next;
}

export function ensureInvestmentAccounts(records){
  let next=[...records];for(const kind of INVESTMENT_ACCOUNT_KINDS){if(managedInvestmentAccount(kind,next))continue;const id=investmentAccountId(kind);if(next.some(r=>r.id===id))throw new Error('分类投资账户编号冲突。');next.push({id,module:'财务管理',variant:'account',title:kind,fields:{kind:'投资',opening:'',investmentKind:kind,enabled:'否',include:'计入总览',status:'使用中',note:''},version:'investment-account-default-v1',createdAt:'2026-11-25T00:00:00.000Z',updatedAt:'2026-11-25T00:00:00.000Z'});}
  const moved=next.filter(r=>r.module==='财务管理'&&r.variant==='investment'&&INVESTMENT_ACCOUNT_KINDS.includes(investmentKind(r.fields.kind))&&r.fields.account!==investmentAccountId(investmentKind(r.fields.kind))),sources=[...new Set(moved.map(r=>r.fields.account).filter(Boolean))],cashBefore=new Map(sources.map(id=>{const a=next.find(r=>r.id===id&&r.variant==='account');return [id,a?accountCashBalance(a,next):null];}));
  if(!moved.length)return next;
  const hash=text=>{let h=14695981039346656037n;for(const ch of text){h^=BigInt(ch.codePointAt(0));h=BigInt.asUintN(64,h*1099511628211n);}return h.toString(16);},key=hash(JSON.stringify(moved.map(r=>[r.id,r.version,r.fields.account]).sort())),version='investment-account-link-v1:'+key,now=[...moved.map(r=>r.updatedAt),'2026-11-25T00:00:00.000Z'].sort().at(-1),day=now.slice(0,10),ids=new Set(moved.map(r=>r.id));
  next=next.map(r=>ids.has(r.id)?{...r,fields:{...r.fields,account:investmentAccountId(investmentKind(r.fields.kind)),funded:'是'},version,updatedAt:now}:r);
  // 保留原资金账户迁移前的可用余额；市值只在分类账户计入一次。
  for(const id of sources){const account=next.find(r=>r.id===id&&r.variant==='account'),before=cashBefore.get(id);if(!account||before===null)continue;const delta=before-accountCashBalance(account,next);if(!delta)continue;next.push({id:'investment-account-migration:'+key+':'+hash(id),module:'财务管理',variant:'account-entry',title:'持仓分类迁移',fields:{kind:'调整',account:id,delta:decimalMoney(delta),method:'持仓分类迁移',date:day,note:'保留原账户可用余额'},version,createdAt:now,updatedAt:now});}
  return next;
}

export function accountDistribution(records){const kinds=['现金','储蓄','投资','其他'],values=kinds.map(kind=>({kind,amount:records.filter(r=>r.module==='财务管理'&&financeVariant(r)==='account'&&r.fields.include!=='不计入总览'&&normalizeAccountType(r.fields.kind)===kind).reduce((sum,r)=>sum+Math.max(0,accountBalance(r,records)),0)})),total=values.reduce((sum,r)=>sum+r.amount,0);return values.map(r=>({...r,percent:total?Math.round(r.amount/total*1000)/10:0}));}
export function assetDebtDisplay(totals){const ratio=totals.assets>0?totals.debt/totals.assets:null,debtPercent=ratio===null?null:Math.round(ratio*1000)/10,netPercent=ratio===null?null:Math.round((1-ratio)*1000)/10;let label='无负债',level='none';if(totals.debt>totals.assets){label='资不抵债';level='critical';}else if(totals.debt>0){if(ratio>=0.5){label='负债偏高';level='high';}else if(ratio>=0.3){label='负债适中';level='medium';}else{label='负债较低';level='low';}}return {debtPercent,netPercent,netWidth:totals.assets>0?Math.max(0,Math.min(100,(1-ratio)*100)):0,debtWidth:totals.debt>0?totals.assets>0?Math.max(0,Math.min(100,ratio*100)):100:0,label,level};}

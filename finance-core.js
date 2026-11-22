const f=(key,label,type='text',options={})=>({key,label,type,...options});
export const FINANCE_TABS=[{id:'account',label:'账户管理'},{id:'budget',label:'固定预算'},{id:'recovery',label:'结余回收'},{id:'investment',label:'投资观察'},{id:'analysis',label:'克制分析'},{id:'saving',label:'存款目标'},{id:'ledger',label:'表盘总览分析'}];
export const FINANCE_FORMS={
  ledger:{kind:'finance',label:'收支明细',action:'记一笔',titleLabel:'收支事项',fields:[f('kind','收支类型','select',{options:['支出','收入']}),f('amount','金额','money',{required:true}),f('category','收支分类'),f('date','日期','date',{required:true}),f('account','账户','account'),f('note','备注','textarea')]},
  account:{kind:'account',label:'账户管理',action:'新增账户',titleLabel:'账户名称',fields:[f('kind','账户类型','select',{options:['银行卡','现金','支付宝','微信','投资账户','其他']}),f('opening','期初余额','money',{required:true}),f('include','总览统计','select',{options:['计入总览','不计入总览']}),f('status','使用状态','select',{options:['使用中','已停用']}),f('note','备注','textarea')]},
  budget:{kind:'budget',label:'固定预算',action:'设置周预算',titleLabel:'预算名称',fields:[f('amount','每周固定金额','money',{required:true}),f('weekStart','生效周的周一','date',{required:true}),f('note','备注','textarea')]},
  recovery:{kind:'recovery',label:'结余回收',action:'记录回收',titleLabel:'回收事项',fields:[f('weekStart','所属周的周一','date',{required:true}),f('amount','手动回收金额','money',{required:true}),f('date','回收日期','date',{required:true}),f('from','转出账户（可选）','account'),f('to','转入账户（可选）','account'),f('note','备注','textarea')]},
  investment:{kind:'investment',label:'投资观察',action:'新增观察',titleLabel:'投资名称',fields:[f('symbol','代码'),f('kind','资产类型','select',{options:['基金','股票','债券','其他']}),f('cost','参考成本价','decimal',{precision:4,required:true}),f('price','观察价格','decimal',{precision:4,required:true}),f('quantity','观察数量','decimal',{precision:4,required:true}),f('date','价格记录日期','date',{required:true}),f('note','观察笔记','textarea')]},
  analysis:{kind:'analysis',label:'克制分析',action:'',titleLabel:'',fields:[]},
  saving:{kind:'saving',label:'存款目标',action:'新增存款目标',titleLabel:'目标名称',fields:[f('target','目标金额','money',{required:true}),f('current','已存金额','money',{required:true}),f('account','关联账户','account'),f('due','目标日期','date'),f('plan','存款计划','textarea')]}
};
export const financeVariant=record=>record.variant||'ledger';
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
export function accountBalance(account,records){let balance=amountCents(account.fields.opening);const matches=value=>value===account.id||value===account.title;
  for(const record of records){if(record.module!=='财务管理')continue;const variant=financeVariant(record);
    if(variant==='ledger'&&matches(record.fields.account)){const amount=amountCents(record.fields.amount);balance+=record.fields.kind==='收入'?amount:-amount;}
    if(variant==='recovery'&&record.fields.from&&record.fields.to){const amount=amountCents(record.fields.amount);if(matches(record.fields.from))balance-=amount;if(matches(record.fields.to))balance+=amount;}
  }return balance;
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
  if(variant==='investment')investmentValue(record);
}

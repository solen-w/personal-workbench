import {emptyData,mergeData,sameData} from './core.js?v=20261126-calendar-2';
// 自动同步处理投资及其资金依赖、年度存款目标；其他本地内容继续沿用原手动同步。
function scopeInfo(...datasets){const ids=new Set(),accounts=new Set(),all=datasets.flatMap(d=>d?.records||[]);for(const r of all)if(r.module==='财务管理'&&r.variant==='account'&&(r.fields.kind==='投资'||r.fields.investmentKind)){accounts.add(r.id);if(!r.fields.investmentKind)accounts.add(r.title);}for(const r of all)if(r.module==='财务管理'&&(['investment','investment-event','investment-quote','annual-saving'].includes(r.variant)||(r.variant==='account'&&(r.fields.kind==='投资'||r.fields.investmentKind))||(['account-entry','ledger','recovery'].includes(r.variant)&&['account','from','to'].some(k=>accounts.has(r.fields[k])))))ids.add(r.id);return ids;}
const project=(data,ids)=>({...emptyData(),records:(data.records||[]).filter(r=>ids.has(r.id)),recordTombstones:(data.recordTombstones||[]).filter(r=>ids.has(r.id))});
const combine=(keep,part,ids)=>({...keep,records:[...(keep.records||[]).filter(r=>!ids.has(r.id)),...part.records],recordTombstones:[...(keep.recordTombstones||[]).filter(r=>!ids.has(r.id)),...part.recordTombstones]});
export function investmentSyncData(data){return project(data,scopeInfo(data));}
export function sameInvestmentData(a,b){const ids=scopeInfo(a,b);return sameData(project(a,ids),project(b,ids));}
export function mergeInvestmentData(base,local,remote,{keep=remote}={}){const ids=scopeInfo(base,local,remote,keep),result=mergeData(project(base,ids),project(local,ids),project(remote,ids));return {data:combine(keep,result.data,ids),conflicts:result.conflicts};}
export function replaceInvestmentData(target,source){const ids=scopeInfo(target,source);return combine(target,project(source,ids),ids);}

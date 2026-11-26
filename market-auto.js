import {investmentKind,investmentPosition,quoteKey} from './investment-core.js?v=20261126-calendar-4';
// 与鸿蒙 AutoQuoteRules 一致：北京时间、工作日交易窗口，不额外推定节假日。
export const MARKET_CHECK_MS=60000;
const day=now=>new Date(now+8*3600000).toISOString().slice(0,10);
export function stockTrading(now){const date=new Date(now+8*3600000),weekday=date.getUTCDay(),minute=date.getUTCHours()*60+date.getUTCMinutes();return weekday!==0&&weekday!==6&&((minute>=570&&minute<=690)||(minute>=780&&minute<=900));}
export function quoteDue(kind,last,now){kind=investmentKind(kind);if(kind==='股票')return stockTrading(now)&&(last<=0||now<last||now-last>=900000);if(kind==='贵金属')return last<=0||now<last||now-last>=60000;if(kind==='基金')return last<=0||day(last)!==day(now);return false;}
export const autoStampKey=(repo,kind,code)=>repo+'|'+quoteKey(kind,code);
export function dueMarketSymbols(records,repo,stamps,now){const result=new Map();for(const holding of records.filter(r=>r.module==='财务管理'&&r.variant==='investment')){const kind=investmentKind(holding.fields.kind),code=holding.fields.symbol;try{const key=quoteKey(kind,code);if(Number(investmentPosition(holding,records).quantity)<=0)continue;const stamp=stamps?.[autoStampKey(repo,kind,code)],last=Number.isFinite(stamp)&&stamp>0?stamp:0;if(quoteDue(kind,last,now))result.set(key,{kind,code});}catch{/* 手动报价品种不发起自动请求。 */}}return [...result.values()];}
export function createMarketAutoRefresh({isActive,snapshot,refresh,clock=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}){
 let active=false,busy=false,timer=null,epoch=0;
 const clear=()=>{if(timer!==null){clearTimer(timer);timer=null;}};
 async function tick(){if(!active||!isActive()||busy)return;clear();busy=true;const current=epoch;try{const s=snapshot(),symbols=dueMarketSymbols(s.records,s.repo,s.stamps,clock());if(symbols.length)await refresh(symbols,()=>active&&current===epoch&&isActive());}catch{/* 失败不修改成功时间，由下一分钟检查重试。 */}finally{busy=false;if(active&&isActive())timer=setTimer(()=>{timer=null;tick();},current===epoch?MARKET_CHECK_MS:0);}}
 function update(){const next=!!isActive();if(next===active)return;active=next;epoch++;clear();if(active)tick();}
 function stop(){active=false;epoch++;clear();}
 return {update,stop};
}

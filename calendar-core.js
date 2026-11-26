import {investmentTotals,positionValue,baseInvestmentCost} from './investment-core.js?v=20261126-calendar-1';
export const CALENDAR_FORMAT='workbench-investment-calendar-v1';
export const beijingDay=(now=Date.now())=>new Date(now+8*3600000).toISOString().slice(0,10);
export const addCalendarDays=(day,n)=>new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const validDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const amount=n=>Number.isSafeInteger(n)&&Math.abs(n)<=1e14;
export function validateCalendar(value){
  if(value?.format!==CALENDAR_FORMAT||!Array.isArray(value.days)||value.days.length>12000)throw Error('投资日历格式不正确。');
  const seen=new Set();const days=value.days.map(d=>{if(!validDay(d.date)||seen.has(d.date)||!amount(d.market)||d.market<0||!Array.isArray(d.holdings)||d.holdings.length>2000||!(d.profit===null||amount(d.profit))||!(d.capital===null||amount(d.capital)&&d.capital>=0)||!(d.rate===null||Number.isFinite(d.rate)&&Math.abs(d.rate)<=1e9))throw Error('投资日历数据不正确。');seen.add(d.date);const ids=new Set();const holdings=d.holdings.map(h=>{if(typeof h.id!=='string'||!h.id||h.id.length>200||ids.has(h.id)||!['value','cost','gain','initialValue','initialGain'].every(k=>amount(h[k]))||h.value<0||h.cost<0||h.initialValue<0)throw Error('投资日历持仓数据不正确。');ids.add(h.id);return {id:h.id,value:h.value,cost:h.cost,gain:h.gain,initialValue:h.initialValue,initialGain:h.initialGain};});return {date:d.date,market:d.market,profit:d.profit,capital:d.capital,rate:d.rate,holdings};}).sort((a,b)=>a.date.localeCompare(b.date));
  return {format:CALENDAR_FORMAT,updatedAt:typeof value.updatedAt==='string'?value.updatedAt:'',days};
}
// 只记录当天收盘观察值，不用今天的价格补造缺失的历史。
export function appendCalendarSnapshot(history,records,now=Date.now()){
  const day=beijingDay(now),hour=new Date(now+8*3600000).getUTCHours(),previous=validateCalendar(history);
  if(hour<22||previous.days.some(d=>d.date===day))return previous;
  const totals=investmentTotals(records);if(totals.missing||totals.positions.some(p=>p.errors.length||p.conflicts.length))throw Error('持仓报价或交易不完整，跳过当日快照。');
  const holdings=totals.positions.map(p=>{const initialValue=p.holding.fields.price?positionValue(p.holding.fields.quantity,p.holding.fields.price):baseInvestmentCost(p.holding);return {id:p.holding.id,value:p.current||0,cost:p.cost,gain:(p.current||0)-p.cost+p.realized,initialValue,initialGain:initialValue-baseInvestmentCost(p.holding)};});
  const before=previous.days.find(d=>d.date===addCalendarDays(day,-1));let profit=null,capital=null,rate=null;
  if(before){profit=0;capital=0;for(const h of holdings){const old=before.holdings.find(p=>p.id===h.id);profit+=h.gain-(old?old.gain:h.initialGain);capital+=old?old.value+Math.max(0,h.cost-old.cost):h.initialValue+Math.max(0,h.cost-baseInvestmentCost(records.find(r=>r.id===h.id)));}rate=capital?profit/capital*100:profit===0?0:null;}
  return validateCalendar({format:CALENDAR_FORMAT,updatedAt:new Date(now).toISOString(),days:[...previous.days,{date:day,market:totals.current,holdings,profit,capital,rate}]});
}
export function calendarTotal(days){const available=days.filter(d=>d.profit!==null);return {count:available.length,profit:available.length?available.reduce((sum,d)=>sum+d.profit,0):null,rate:available.length&&available.every(d=>d.rate!==null)?(available.reduce((factor,d)=>factor*(1+d.rate/100),1)-1)*100:null};}
export function calendarCells(history,mode,anchor){
  const [year,month]=anchor.split('-').map(Number),map=new Map(history.days.map(d=>[d.date,d]));
  const cell=(label,start,end,outside=false)=>({label,start,end,outside,...calendarTotal(history.days.filter(d=>d.date>=start&&d.date<=end))});
  if(mode==='日'){const first=anchor.slice(0,7)+'-01',weekday=new Date(first+'T00:00:00Z').getUTCDay(),last=new Date(Date.UTC(year,month,0)).getUTCDate(),count=Math.ceil((weekday+last)/7)*7;return Array.from({length:count},(_,i)=>{const date=addCalendarDays(first,i-weekday),d=map.get(date);return {label:String(Number(date.slice(8))),start:date,end:date,outside:date.slice(0,7)!==first.slice(0,7),profit:d?.profit??null,rate:d?.rate??null,count:d?.profit!==null&&d?.profit!==undefined?1:0};});}
  if(mode==='周'){const first=anchor.slice(0,7)+'-01',start=addCalendarDays(first,-new Date(first+'T00:00:00Z').getUTCDay());return Array.from({length:6},(_,i)=>{const a=addCalendarDays(start,i*7),b=addCalendarDays(a,6);return cell(a.slice(5).replace('-','.')+'–'+b.slice(5).replace('-','.'),a,b);}).filter(c=>c.start.slice(0,7)===first.slice(0,7)||c.end.slice(0,7)===first.slice(0,7));}
  if(mode==='月')return Array.from({length:12},(_,i)=>{const start=year+'-'+String(i+1).padStart(2,'0')+'-01',end=new Date(Date.UTC(year,i+1,0)).toISOString().slice(0,10);return cell((i+1)+'月',start,end);});
  const startYear=Math.floor(year/12)*12;return Array.from({length:12},(_,i)=>cell(String(startYear+i),(startYear+i)+'-01-01',(startYear+i)+'-12-31'));
}

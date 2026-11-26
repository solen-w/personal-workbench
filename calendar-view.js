import {CALENDAR_FORMAT,beijingDay,calendarCells} from './calendar-core.js?v=20261126-calendar-2';
const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const button=(text,fn,cls='')=>{const n=el('button',cls,text);n.type='button';n.onclick=fn;return n;};
export function createCalendarView(api){
  let mode='日',metric='收益额',anchor=beijingDay();
  function render(show){const root=document.getElementById('investment-calendar');root.hidden=!show;if(!show)return;root.replaceChildren();const cached=api.state().investmentCalendar,history=cached?.repo===api.state().repo?cached.data:{format:CALENDAR_FORMAT,days:[]};
    const heading=el('div','calendar-heading');heading.append(el('h2','','投资收益'));const segments=(values,current,choose,label)=>{const group=el('div','calendar-segments');group.setAttribute('role','group');group.setAttribute('aria-label',label);for(const value of values){const b=button(value,()=>{choose(value);render(true);});b.setAttribute('aria-pressed',String(value===current));group.append(b);}return group;};const controls=el('div','calendar-controls');controls.append(segments(['日','周','月','年'],mode,v=>mode=v,'收益周期'),segments(['收益额','收益率'],metric,v=>metric=v,'收益显示方式'));root.append(heading,controls);
    const cells=calendarCells(history,mode,anchor),nav=el('div','calendar-navigation'),year=Number(anchor.slice(0,4)),month=Number(anchor.slice(5,7));const shift=direction=>{const date=new Date(Date.UTC(year,month-1,1));if(['日','周'].includes(mode))date.setUTCMonth(date.getUTCMonth()+direction);else date.setUTCFullYear(year+direction*(mode==='年'?12:1));anchor=date.toISOString().slice(0,10);render(true);};
    const previous=button('‹',()=>shift(-1)),next=button('›',()=>shift(1));previous.setAttribute('aria-label','上一周期');next.setAttribute('aria-label','下一周期');nav.append(previous,el('strong','',mode==='年'?cells[0].label+'–'+cells.at(-1).label:mode==='月'?year+'年':year+'年'+String(month).padStart(2,'0')+'月'),next);root.append(nav);
    const display=value=>value===null||value===0?'0.00':(value>0?'+':'')+(metric==='收益率'?value:value/100).toFixed(2)+(metric==='收益率'?'%':'');const tone=value=>value===null||value===0?'neutral':value>0?'positive':'negative';
    const grid=el('div','calendar-grid calendar-mode-'+mode);for(const c of cells){const value=metric==='收益额'?c.profit:c.rate,cell=el('div','calendar-cell '+tone(c.profit)+(c.outside?' outside':'')+(c.start===beijingDay()?' today':''));cell.append(el('span','calendar-day',c.label),el('strong','calendar-return',display(value)));cell.title=c.start+(c.end!==c.start?' 至 '+c.end:'')+' · '+(c.count?'已记录 '+c.count+' 天':'暂无记录');grid.append(cell);}root.append(grid);
  }
  return {render};
}

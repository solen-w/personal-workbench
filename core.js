import {CATEGORY_NAMES, DEFAULT_CATEGORY, MODULE_ALIASES} from './config.js';
import {validateRecord} from './module-core.js';
export const emptyData = () => ({schemaVersion:4,tasks:[],tombstones:[],records:[],recordTombstones:[]});
export const uid=()=>crypto.randomUUID();
const str=(value,max)=>typeof value==='string'&&value.length<=max;
export function validateData(data){
  if(!data||![1,2,3,4].includes(data.schemaVersion)||!Array.isArray(data.tasks)||!Array.isArray(data.tombstones))throw new Error('数据格式不受支持。');
  if(data.schemaVersion>=2&&(!Array.isArray(data.records)||!Array.isArray(data.recordTombstones)))throw new Error('内容数据不完整。');
  if(data.tasks.length+data.tombstones.length+(data.records?.length||0)+(data.recordTombstones?.length||0)>20000)throw new Error('记录数量超过 20,000 条。');
  const ids=new Set();
  const id=(value,prefix)=>{const key=prefix+value?.id;if(!str(value?.id,200)||!value.id||ids.has(key))throw new Error('存在无效或重复的内容编号。');ids.add(key);};
  const tasks=data.tasks.map(x=>{
    if(!x||!str(x.title,200)||!x.title.trim()||(x.notes!==undefined&&!str(x.notes,10000))||(x.due&&(!/^\d{4}-\d{2}-\d{2}$/.test(x.due)||!Number.isFinite(Date.parse(x.due)))))throw new Error('任务格式不正确。');
    id(x,'task:');return {category:CATEGORY_NAMES.includes(MODULE_ALIASES[x.category]||x.category)?(MODULE_ALIASES[x.category]||x.category):DEFAULT_CATEGORY,id:x.id,title:x.title.trim(),notes:x.notes||'',due:x.due||'',priority:['high','normal','low'].includes(x.priority)?x.priority:'normal',completed:x.completed===true,updatedAt:str(x.updatedAt,100)?x.updatedAt:'',version:str(x.version,200)?x.version:'legacy-'+x.id,...(str(x.conflictOf,200)?{conflictOf:x.conflictOf}:{})};
  });
  const tombstone=(x,prefix)=>{id(x,prefix);return {id:x.id,version:str(x.version,200)?x.version:'deleted-'+x.id,updatedAt:str(x.updatedAt,100)?x.updatedAt:''};};
  const tombstones=data.tombstones.map(x=>tombstone(x,'task:'));
  const records=(data.records||[]).map(x=>{id(x,'record:');return validateRecord(x);});
  const recordTombstones=(data.recordTombstones||[]).map(x=>tombstone(x,'record:'));
  return {schemaVersion:4,tasks,tombstones,records,recordTombstones};
}
export const stable=value=>value===undefined?'undefined':value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(stable).join(',')+']':'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stable(value[key])).join(',')+'}';
const same=(a,b)=>(!a&&!b)||(!!a&&!!b&&a.kind===b.kind&&stable(a.value)===stable(b.value));
const mapData=data=>new Map([...(data.tasks||[]).map(value=>['task:'+value.id,{kind:'tasks',value}]),...(data.tombstones||[]).map(value=>['task:'+value.id,{kind:'tombstones',value}]),...(data.records||[]).map(value=>['record:'+value.id,{kind:'records',value}]),...(data.recordTombstones||[]).map(value=>['record:'+value.id,{kind:'recordTombstones',value}])]);
const alive=record=>record&&['tasks','records'].includes(record.kind);
function mergeHabit(B,L,R){
  if(![B,L,R].every(record=>record?.kind==='records'&&record.value.module==='习惯养成'))return null;
  const withoutDays=record=>{const {checkins,version,updatedAt,...rest}=record.value;return rest;};
  if(stable(withoutDays(B))!==stable(withoutDays(L))||stable(withoutDays(B))!==stable(withoutDays(R)))return null;
  const base=new Set(B.value.checkins),local=new Set(L.value.checkins),remote=new Set(R.value.checkins);
  const checkins=[...new Set([...base,...local,...remote])].filter(day=>local.has(day)===remote.has(day)?local.has(day):local.has(day)===base.has(day)?remote.has(day):local.has(day)).sort();
  const hash=[...checkins.join(',')].reduce((value,char)=>Math.imul(value^char.charCodeAt(0),16777619)>>>0,2166136261);
  return {kind:'records',value:{...L.value,checkins,version:'days-'+hash.toString(16),updatedAt:[L.value.updatedAt,R.value.updatedAt].sort().at(-1)}};
}
export function mergeData(base,local,remote,makeId=uid){
  const b=mapData(base),l=mapData(local),r=mapData(remote),result=emptyData();let conflicts=0;
  const add=record=>{if(record)result[record.kind].push(structuredClone(record.value));};
  const copy=record=>{const value={...structuredClone(record.value),id:makeId(),version:makeId(),title:(record.value.title+'（冲突副本）').slice(0,200),conflictOf:record.value.id};result[record.kind].push(value);};
  for(const key of new Set([...b.keys(),...l.keys(),...r.keys()])){
    const B=b.get(key),L=l.get(key),R=r.get(key);
    if(same(L,R))add(L);else if(same(L,B))add(R);else if(same(R,B))add(L);
    else {const habit=mergeHabit(B,L,R);if(habit){add(habit);continue;}conflicts++;
      if(alive(L)&&alive(R)){add(R);copy(L);}else{const living=alive(L)?L:alive(R)?R:null,deleted=L&&!alive(L)?L:R&&!alive(R)?R:null;add(deleted);if(living)copy(living);}
    }
  }
  return {data:result,conflicts};
}
export function sameData(a,b){const A=mapData(a),B=mapData(b);return A.size===B.size&&[...A].every(([id,record])=>same(record,B.get(id)));}
export function filterTasks(tasks,{view='all',query='',priority='all',today,sort='smart'}={}) {
  let list=tasks.filter(t=> {
    if(view==='completed' ? !t.completed : t.completed) return false;
    if(view==='today' && (!t.due || t.due>today)) return false;
    if(view==='upcoming' && (!t.due || t.due<=today)) return false;
    if(priority!=='all' && t.priority!==priority) return false;
    return (t.title+' '+t.notes).toLowerCase().includes(query.toLowerCase());
  });
  const rank={high:0,normal:1,low:2};
  return list.sort((a,b)=> sort==='newest' ? b.updatedAt.localeCompare(a.updatedAt) : (a.due||'9999').localeCompare(b.due||'9999') || rank[a.priority]-rank[b.priority] || b.updatedAt.localeCompare(a.updatedAt));
}

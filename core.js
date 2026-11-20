export const emptyData = () => ({ schemaVersion: 1, tasks: [], tombstones: [] });
export const uid = () => crypto.randomUUID();
const str = (v, max) => typeof v === 'string' && v.length <= max;
export function validateData(data) {
  if (!data || data.schemaVersion !== 1 || !Array.isArray(data.tasks) || !Array.isArray(data.tombstones) || data.tasks.length + data.tombstones.length > 20000) throw new Error('数据格式不受支持，或记录数量超过 20,000 条。');
  const ids = new Set();
  const id = x => { if (!str(x.id, 200) || !x.id || ids.has(x.id)) throw new Error('数据中存在无效或重复的任务编号。'); ids.add(x.id); };
  const tasks = data.tasks.map(x => {
    if (!x || !str(x.title, 200) || !x.title.trim() || (x.notes !== undefined && !str(x.notes, 10000)) || (x.due && (!/^\d{4}-\d{2}-\d{2}$/.test(x.due) || !Number.isFinite(Date.parse(x.due))))) throw new Error('任务标题、备注或日期格式不正确。');
    id(x);
    return { id:x.id, title:x.title.trim(), notes:x.notes || '', due:x.due || '', priority:['high','normal','low'].includes(x.priority)?x.priority:'normal', completed:x.completed === true, updatedAt:str(x.updatedAt,100)?x.updatedAt:'', version:str(x.version,200)?x.version:'legacy-'+x.id, ...(str(x.conflictOf,200)?{conflictOf:x.conflictOf}:{}) };
  });
  const tombstones = data.tombstones.map(x => { if (!x) throw new Error('删除记录不正确。'); id(x); return {id:x.id,version:str(x.version,200)?x.version:'deleted-'+x.id,updatedAt:str(x.updatedAt,100)?x.updatedAt:''}; });
  return {schemaVersion:1,tasks,tombstones};
}
const stable = v => v === undefined ? 'undefined' : JSON.stringify(v, Object.keys(v).sort());
const same = (a,b) => (!a && !b) || (!!a && !!b && a.kind===b.kind && stable(a.value)===stable(b.value));
const mapData = d => new Map([...d.tasks.map(value=>[value.id,{kind:'task',value}]),...d.tombstones.map(value=>[value.id,{kind:'delete',value}])]);
export function mergeData(base, local, remote, makeId=uid) {
  const b=mapData(base), l=mapData(local), r=mapData(remote), result=emptyData(); let conflicts=0;
  const add = record => { if(record) result[record.kind==='task'?'tasks':'tombstones'].push({...record.value}); };
  for(const id of new Set([...b.keys(),...l.keys(),...r.keys()])) {
    const B=b.get(id), L=l.get(id), R=r.get(id);
    if(same(L,R)) add(L);
    else if(same(L,B)) add(R);
    else if(same(R,B)) add(L);
    else {
      // 两端同时修改时保留两个版本，不依赖设备时钟覆盖。
      conflicts++;
      if(L?.kind==='task' && R?.kind==='task') {
        add(R); result.tasks.push({...L.value,id:makeId(),version:makeId(),title:(L.value.title+'（冲突副本）').slice(0,200),conflictOf:id});
      } else {
        const alive=L?.kind==='task'?L:R?.kind==='task'?R:null;
        const deleted=L?.kind==='delete'?L:R?.kind==='delete'?R:null;
        add(deleted);
        if(alive) result.tasks.push({...alive.value,id:makeId(),version:makeId(),title:(alive.value.title+'（冲突副本）').slice(0,200),conflictOf:id});
      }
    }
  }
  return {data:result, conflicts};
}
export function sameData(a,b) {
  const A=mapData(a), B=mapData(b); return A.size===B.size && [...A].every(([id,v])=>same(v,B.get(id)));
}
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

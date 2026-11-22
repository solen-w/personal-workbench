const DAY=86400000;
export function readingTitleRecord(records,bookId){return records.filter(record=>record.module==='图书管理'&&record.variant==='reading-title'&&record.fields.bookId===bookId).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||b.version.localeCompare(a.version)||b.id.localeCompare(a.id))[0]||null;}
export function displayReadingBook(book,records){const custom=readingTitleRecord(records,book.id)?.fields.customTitle;return {...book,sourceTitle:book.title,title:custom||book.title};}
export async function readingTitleId(bookId){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(bookId));return 'reading-title:'+Array.from(new Uint8Array(bytes),value=>value.toString(16).padStart(2,'0')).join('');}
export function readingCounts(books){return [{label:'全部阅读',count:books.length},...['在读','已读','未读','在听'].map(label=>({label,count:books.filter(book=>book.status===label).length}))];}
export const chinaDay=(date=new Date())=>new Date(date.getTime()+8*3600000).toISOString().slice(0,10);
export function duration(seconds){if(seconds===null||seconds===undefined)return '—';return Math.floor(seconds/3600)+'小时'+Math.floor(seconds%3600/60)+'分钟';}
export function safeReadingURL(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch{return '';}}
export function validateReading(value){
  const number=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1e12;
  if(value?.format!=='workbench-weread-v1'||!number(value.totalReadSeconds)||!value.years||typeof value.years!=='object'||Array.isArray(value.years)||!Array.isArray(value.books)||value.books.length>20000||typeof value.updatedAt!=='string'||!Number.isFinite(Date.parse(value.updatedAt)))throw new Error('阅读数据格式不正确，已有缓存已保留。');
  if(!Object.keys(value.years).length||Object.keys(value.years).length>100)throw new Error('缺少年度阅读数据。');
  const years={};for(const [year,entry] of Object.entries(value.years)){
    if(!/^20\d\d$/.test(year)||!number(entry.totalReadSeconds)||!entry.days||typeof entry.days!=='object'||Array.isArray(entry.days))throw new Error('年度阅读数据不正确。');
    const days={};for(const [date,seconds] of Object.entries(entry.days)){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!date.startsWith(year+'-')||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||!number(seconds))throw new Error('每日阅读数据不正确。');days[date]=seconds;}years[year]={totalReadSeconds:entry.totalReadSeconds,days,...(typeof entry.readCountLabel==='string'&&entry.readCountLabel.trim()&&entry.readCountLabel.length<=50?{readCountLabel:entry.readCountLabel.trim()}:{})};
  }
  const ids=new Set();const books=value.books.map(book=>{if(!book||typeof book.id!=='string'||book.id.length>200||ids.has(book.id)||typeof book.title!=='string'||!book.title||book.title.length>500||!['电子书','有声书'].includes(book.kind)||!['已读','在读','在听','未读'].includes(book.status))throw new Error('书籍数据不正确。');ids.add(book.id);return {id:book.id,title:book.title,author:String(book.author||'').slice(0,500),cover:safeReadingURL(book.cover),link:safeReadingURL(book.link),kind:book.kind,status:book.status,readDate:/^\d{4}-\d{2}-\d{2}$/.test(book.readDate)?book.readDate:''};});
  return {format:value.format,updatedAt:value.updatedAt,totalReadSeconds:value.totalReadSeconds,years,books,articleCollection:value.articleCollection===true};
}
export function heatmapDays(year,days,today=chinaDay()){
  const start=Date.UTC(year,0,1),end=Date.UTC(year+1,0,1),padding=(new Date(start).getUTCDay()+6)%7,cells=Array(padding).fill(null);
  for(let time=start;time<end;time+=DAY){const date=new Date(time).toISOString().slice(0,10),future=date>today,seconds=future?null:days[date]??null;cells.push({date,future,seconds,level:seconds===null?'unknown':seconds===0?'zero':seconds<1800?'one':seconds<3600?'two':seconds<7200?'three':'four'});}return cells;
}

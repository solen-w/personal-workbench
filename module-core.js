const field=(key,label,type='text',options={})=>({key,label,type,...options});
export const MODULES={
  '命宫本元':{kind:'profile',label:'个人资料',action:'编辑资料',titleLabel:'姓名',fields:[field('gender','性别','select',{options:['未填写','男','女','其他']}),field('birthday','出生日期','date'),field('phone','电话'),field('email','邮箱','email'),field('location','所在地'),field('occupation','职业'),field('intro','个人简介','textarea')]},
  '履迹平生':{kind:'experience',label:'学习和工作经历',action:'新增经历',titleLabel:'学校或单位',fields:[field('kind','经历类型','select',{options:['学习经历','工作经历']}),field('role','专业或职位'),field('start','开始日期','date'),field('end','结束日期','date'),field('details','经历与收获','textarea')]},
  '财帛大有':{kind:'finance',label:'财务管理',action:'记一笔',titleLabel:'收支事项',fields:[field('kind','收支类型','select',{options:['支出','收入']}),field('amount','金额','money',{required:true}),field('category','收支分类'),field('date','日期','date',{required:true}),field('account','账户'),field('note','备注','textarea')]},
  '乾元矢志':{kind:'goal',label:'专项目标',action:'新增目标',titleLabel:'目标名称',fields:[field('status','状态','select',{options:['进行中','已完成','已暂停']}),field('target','目标数值','number',{required:true,min:1}),field('current','当前进度','number',{min:0}),field('unit','单位'),field('due','截止日期','date'),field('plan','行动计划','textarea')]},
  '恒久不已':{kind:'habit',label:'习惯养成',action:'新增习惯',titleLabel:'习惯名称',fields:[field('target','每周目标天数','number',{min:1,max:7,required:true}),field('note','习惯说明','textarea')]},
  '文曲含章':{kind:'text',label:'文字素材库',action:'新增文字',titleLabel:'素材标题',fields:[field('tags','标签'),field('source','来源'),field('content','正文','textarea',{required:true,max:100000})]},
  '万象包罗':{kind:'image',label:'图片素材库',action:'添加图片',titleLabel:'图片名称',attachment:'image',fields:[field('tags','标签'),field('source','来源'),field('note','说明','textarea')]},
  '继明开卷':{kind:'book',label:'阅读书籍',action:'添加书籍',titleLabel:'书名',fields:[field('author','作者'),field('status','阅读状态','select',{options:['想读','在读','已读']}),field('total','总页数','number',{min:1}),field('current','已读页数','number',{min:0}),field('started','开始阅读','date'),field('finished','读完日期','date'),field('notes','阅读笔记','textarea',{max:100000})]},
  '申命行事':{kind:'workfile',label:'工作文件',action:'添加文件',titleLabel:'文件名称',attachment:'file',fields:[field('category','文件分类'),field('date','文件日期','date'),field('url','文件链接','url'),field('note','备注','textarea')]},
  '节以制度':{kind:'policy',label:'政策文件',action:'添加政策',titleLabel:'政策名称',attachment:'file',fields:[field('number','文号'),field('issuer','发布机构'),field('date','发布日期','date'),field('effective','施行日期','date'),field('status','效力状态','select',{options:['现行有效','尚未施行','已废止','待核实']}),field('url','原文链接','url'),field('content','原文或摘要','textarea',{max:100000})]}
};
export const FILE_LIMIT=8*1024*1024;
export function amountCents(value){const text=String(value||'0').trim();if(!/^\d{1,9}(?:\.\d{1,2})?$/.test(text))throw new Error('金额需为非负数，最多两位小数。');const [whole,decimal='']=text.split('.');return Number(whole)*100+Number(decimal.padEnd(2,'0'));}
export function money(cents){return (cents/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});}
export function financeTotals(records){let income=0,expense=0;for(const record of records){const amount=amountCents(record.fields.amount);if(record.fields.kind==='收入')income+=amount;else expense+=amount;}return {income,expense,balance:income-expense};}
export function progress(record){const target=Number(record.fields.target||record.fields.total||0),current=Number(record.fields.current||0);return target>0?Math.max(0,Math.min(100,Math.round(current/target*100))):0;}
export function localDay(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function weekDays(date=new Date()){const monday=new Date(date.getFullYear(),date.getMonth(),date.getDate());monday.setDate(monday.getDate()-((monday.getDay()+6)%7));return Array.from({length:7},(_,i)=>{const day=new Date(monday);day.setDate(day.getDate()+i);return localDay(day);});}
export function validateAttachment(value){
  if(!value)return null;
  if(typeof value.id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(value.id)||value.path!==`data/assets/${value.id}`||typeof value.name!=='string'||value.name.length>250||typeof value.type!=='string'||value.type.length>150||!Number.isInteger(value.size)||value.size<0||value.size>FILE_LIMIT)throw new Error('附件信息不正确。');
  return {id:value.id,path:value.path,name:value.name,type:value.type,size:value.size};
}
export function validateRecord(value){
  const module=MODULES[value?.module];
  if(!module||typeof value.title!=='string'||!value.title.trim()||value.title.length>200||typeof value.id!=='string'||!value.id||value.id.length>200||typeof value.version!=='string'||!value.version||value.version.length>200)throw new Error('内容记录格式不正确。');
  const fields={};for(const field of module.fields){const v=value.fields?.[field.key]??'';if(typeof v!=='string'||v.length>(field.max||10000))throw new Error(`${field.label}格式不正确。`);if(field.required&&!v.trim())throw new Error(`请填写${field.label}。`);
    if(v&&field.type==='select'&&!field.options.includes(v))throw new Error(`${field.label}选项不正确。`);
    if(v&&field.type==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))))throw new Error(`${field.label}日期不正确。`);
    if(v&&field.type==='number'&&(!Number.isFinite(Number(v))||Number(v)<(field.min??0)||Number(v)>(field.max??1e12)||!Number.isInteger(Number(v))))throw new Error(`${field.label}需为有效整数。`);
    if(v&&field.type==='money')amountCents(v);
    if(v&&field.type==='url'){let url;try{url=new URL(v);}catch{throw new Error('请输入完整的网页链接。');}if(!['https:','http:'].includes(url.protocol))throw new Error('链接仅支持 HTTP 或 HTTPS。');}
    fields[field.key]=v;
  }
  if(module.kind==='experience'&&fields.start&&fields.end&&fields.end<fields.start)throw new Error('结束日期不能早于开始日期。');
  if(module.kind==='book'&&fields.total&&Number(fields.current||0)>Number(fields.total))throw new Error('已读页数不能超过总页数。');
  const attachment=validateAttachment(value.attachment);if(module.kind==='image'&&(!attachment||!attachment.type.startsWith('image/')))throw new Error('请选择一张图片。');
  const checkins=[...new Set(value.checkins||[])];if(checkins.length>30000||checkins.some(date=>typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)))throw new Error('打卡记录格式不正确。');
  return {id:value.id,module:value.module,title:value.title.trim(),fields,attachment,checkins,version:value.version,updatedAt:typeof value.updatedAt==='string'?value.updatedAt:'',createdAt:typeof value.createdAt==='string'?value.createdAt:'',...(typeof value.conflictOf==='string'?{conflictOf:value.conflictOf}:{})};
}

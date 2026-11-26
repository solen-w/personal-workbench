import {investmentAccountId,investmentKind,validateInvestmentEvent,validateInvestmentQuote,positionValue} from './investment-core.js?v=20261126-account-cards-1';
import {validPartialDate} from './workspace-core.js?v=20261126-account-cards-1';
import {MODULE_ALIASES} from './config.js?v=20261126-account-cards-1';
import {FINANCE_FORMS,normalizeAccountType,signedCents,amountCents,money,financeTotals,investmentValue,mondayOf} from './finance-core.js?v=20261126-account-cards-1';
export {amountCents,money,financeTotals} from './finance-core.js?v=20261126-account-cards-1';
const field=(key,label,type='text',options={})=>({key,label,type,...options});
export const MODULES={
  '基础情况':{kind:'profile',label:'个人资料',action:'编辑资料',titleLabel:'姓名',fields:[field('gender','性别','select',{options:['未填写','男','女','其他']}),field('birthday','出生日期','date'),field('phone','联系方式'),field('email','邮箱','email'),field('occupation','职业'),field('politics','政治面貌'),field('hometown','户籍地'),field('address','住址'),field('intro','个人简介','textarea')]},
  '学工经历':{kind:'experience',label:'学习和工作经历',action:'新增经历',titleLabel:'学校或单位',fields:[field('kind','经历类型','select',{options:['学习经历','工作经历']}),field('role','专业或职位'),field('start','开始日期','partialdate'),field('end','结束日期','partialdate'),field('details','经历与收获','textarea')]},
  '财务管理':FINANCE_FORMS.ledger,
  '专项攻克':{kind:'goal',label:'专项目标',action:'新增目标',titleLabel:'目标名称',fields:[field('status','状态','select',{options:['进行中','已完成','已暂停']}),field('target','目标数值','number',{required:true,min:1}),field('current','当前进度','number',{min:0}),field('unit','单位'),field('due','截止日期','date'),field('plan','行动计划','textarea')]},
  '习惯养成':{kind:'habit',label:'习惯养成',action:'新增习惯',titleLabel:'习惯名称',fields:[field('target','每周目标天数','number',{min:1,max:7,required:true}),field('note','习惯说明','textarea')]},
  '素材收集':{kind:'text',label:'文字素材',action:'新增文字',titleLabel:'素材标题',fields:[field('tags','标签'),field('source','来源'),field('content','正文','textarea',{required:true,max:100000})]},
  '图书管理':{kind:'book',label:'阅读书籍',action:'添加书籍',titleLabel:'书名',fields:[field('author','作者'),field('status','阅读状态','select',{options:['想读','在读','已读']}),field('total','总页数','number',{min:1}),field('current','已读页数','number',{min:0}),field('started','开始阅读','date'),field('finished','读完日期','date'),field('notes','阅读笔记','textarea',{max:100000})]},
  '工作要求':{kind:'workfile',label:'工作文件',action:'添加文件',titleLabel:'文件名称',attachment:'file',fields:[field('category','文件分类'),field('date','文件日期','date'),field('url','文件链接','url'),field('note','备注','textarea')]},
  '政策法规':{kind:'policy',label:'政策文件',action:'添加政策',titleLabel:'政策名称',attachment:'file',fields:[field('number','文号'),field('issuer','发布机构'),field('date','发布日期','date'),field('effective','施行日期','date'),field('status','效力状态','select',{options:['现行有效','尚未施行','已废止','待核实']}),field('url','原文链接','url'),field('content','原文或摘要','textarea',{max:100000})]},
  '身体跟踪':{kind:'body',label:'身体跟踪',action:'新增记录',titleLabel:'记录名称',fields:[field('date','记录日期','date',{required:true}),field('weight','体重（kg）','decimal',{min:1,max:500}),field('height','身高（cm）','decimal',{min:1,max:300}),field('waist','腰围（cm）','decimal',{min:1,max:300}),field('sleep','睡眠（小时）','decimal',{min:0,max:24}),field('exercise','运动（分钟）','number',{min:0,max:1440}),field('note','备注','textarea')]},
  '运动挑战':{kind:'goal',label:'运动挑战',action:'新增挑战',titleLabel:'挑战名称',fields:[field('sport','运动项目'),field('status','状态','select',{options:['进行中','已完成','已暂停']}),field('target','目标数值','decimal',{min:0.01,required:true}),field('current','当前数值','decimal',{min:0}),field('unit','单位'),field('due','截止日期','date'),field('plan','挑战计划','textarea')]},
  '理论学习':{kind:'theory',label:'理论学习',action:'新增学习',titleLabel:'学习主题',fields:[field('source','教材或课程'),field('url','学习链接','url'),field('status','状态','select',{options:['进行中','已完成','已暂停']}),field('target','学习总量','number',{min:1,required:true}),field('current','已完成数量','number',{min:0}),field('unit','单位'),field('due','计划完成日期','date'),field('notes','学习笔记','textarea',{max:100000})]}
};
export const MATERIAL_FORMS={text:MODULES['素材收集'],image:{kind:'image',label:'图片素材',action:'添加图片',titleLabel:'图片名称',attachment:'image',fields:[field('tags','标签'),field('source','来源'),field('note','说明','textarea')]},file:{kind:'workfile',label:'文件素材',action:'添加素材文件',titleLabel:'素材名称',attachment:'file',fields:[field('category','分类'),field('date','日期','date'),field('url','素材链接','url'),field('note','备注','textarea')]}};
const WORKSPACE_PROFILE={kind:'workspace-profile',fields:[field('name','工作台名称','text',{required:true,max:20}),field('photo','头像','textarea',{max:400000})]};
const READING_TITLE={kind:'reading-title',fields:[field('bookId','书籍编号','text',{required:true,max:200}),field('customTitle','自定义书名','text',{max:200})]};
export function getDefinition(name,variant){return name==='基础情况'&&variant==='workspace-profile'?WORKSPACE_PROFILE:name==='图书管理'&&variant==='reading-title'?READING_TITLE:name==='财务管理'?FINANCE_FORMS[variant||'ledger']:name==='素材收集'?MATERIAL_FORMS[variant||'text']:MODULES[name];}
export function normalizeModule(value){const old=value.module,module=MODULE_ALIASES[old]||old;return {...value,module,variant:value.variant||(module==='财务管理'?'ledger':module==='素材收集'?(old==='万象包罗'?'image':'text'):'base')};}
export const FILE_LIMIT=8*1024*1024;
export function progress(record){const target=Number(record.fields.target||record.fields.total||0),current=Number(record.fields.current||0);return target>0?Math.max(0,Math.min(100,Math.round(current/target*100))):0;}
export function localDay(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function weekDays(date=new Date()){const monday=new Date(date.getFullYear(),date.getMonth(),date.getDate());monday.setDate(monday.getDate()-((monday.getDay()+6)%7));return Array.from({length:7},(_,i)=>{const day=new Date(monday);day.setDate(day.getDate()+i);return localDay(day);});}
export function validateAttachment(value){
  if(!value)return null;
  if(typeof value.id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(value.id)||value.path!==`data/assets/${value.id}`||typeof value.name!=='string'||value.name.length>250||typeof value.type!=='string'||value.type.length>150||!Number.isInteger(value.size)||value.size<0||value.size>FILE_LIMIT)throw new Error('附件信息不正确。');
  return {id:value.id,path:value.path,name:value.name,type:value.type,size:value.size};
}
export function validateRecord(value){
  value=normalizeModule(value||{});if(value.module==='财务管理'&&value.variant==='investment')value={...value,fields:{...value.fields,kind:investmentKind(value.fields?.kind)}};if(value.module==='财务管理'&&value.variant==='account')value={...value,fields:{...value.fields,kind:normalizeAccountType(value.fields?.kind)}};if(value.module==='基础情况'&&value.variant==='base'&&value.fields?.location&&!value.fields.hometown)value={...value,fields:{...value.fields,hometown:value.fields.location}};const module=getDefinition(value.module,value.variant);
  if(!module||typeof value.title!=='string'||!value.title.trim()||value.title.length>200||typeof value.id!=='string'||!value.id||value.id.length>200||typeof value.version!=='string'||!value.version||value.version.length>200)throw new Error('内容记录格式不正确。');
  const fields={};for(const field of module.fields){const v=value.fields?.[field.key]??'';if(typeof v!=='string'||v.length>(field.max||10000))throw new Error(`${field.label}格式不正确。`);if(field.required&&!v.trim())throw new Error(`请填写${field.label}。`);
    if(v&&field.type==='select'&&!field.options.includes(v))throw new Error(`${field.label}选项不正确。`);
    if(v&&field.type==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v))throw new Error(`${field.label}日期不正确。`);
    if(v&&field.type==='number'&&(!Number.isFinite(Number(v))||Number(v)<(field.min??0)||Number(v)>(field.max??1e12)||!Number.isInteger(Number(v))))throw new Error(`${field.label}需为有效整数。`);
    if(v&&field.type==='money')amountCents(v);
    if(v&&field.type==='signedmoney')signedCents(v);
    if(v&&field.type==='decimal'&&(!new RegExp('^\\d{1,9}(?:\\.\\d{1,'+(field.precision||2)+'})?$').test(v)||!Number.isFinite(Number(v))||Number(v)<(field.min??0)||Number(v)>(field.max??1e9)))throw new Error(field.label+'数值不正确。');
    if(v&&field.type==='partialdate'&&!validPartialDate(v))throw new Error(field.label+'需为有效年月或日期。');
    if(v&&field.type==='month'&&!/^\d{4}-\d{2}$/.test(v))throw new Error(field.label+'月份不正确。');
    if(v&&field.type==='url'){let url;try{url=new URL(v);}catch{throw new Error('请输入完整的网页链接。');}if(!['https:','http:'].includes(url.protocol))throw new Error('链接仅支持 HTTP 或 HTTPS。');}
    fields[field.key]=v;
  }
  if(module.kind==='experience'&&fields.start&&fields.end&&(fields.end.length===7?fields.end+'-31':fields.end)<(fields.start.length===7?fields.start+'-01':fields.start))throw new Error('结束日期不能早于开始日期。');
  if(module.kind==='book'&&fields.total&&Number(fields.current||0)>Number(fields.total))throw new Error('已读页数不能超过总页数。');
  if(value.module==='财务管理'&&value.variant==='account-entry'){if(fields.kind==='调整'&&(!fields.account||!fields.delta))throw new Error('余额调整记录不完整。');if(fields.kind==='转账'&&(!fields.from||!fields.to||fields.from===fields.to||!amountCents(fields.amount)))throw new Error('转账记录不完整。');}
  if(value.module==='财务管理'&&value.variant==='annual-saving'){if(!amountCents(fields.target))throw new Error('目标金额需大于零。');if(fields.status==='已归档'&&(!fields.archivedAt||!Number.isFinite(Date.parse(fields.archivedAt))||amountCents(fields.archivedCurrent)<amountCents(fields.target)))throw new Error('归档目标数据不完整或尚未达成。');}
  if(value.module==='财务管理'&&['budget','recovery'].includes(value.variant)&&mondayOf(fields.weekStart)!==fields.weekStart)throw new Error('所属预算周请填写周一日期。');
  if(value.module==='财务管理'&&value.variant==='account'){if(fields.investmentKind){if(value.id!==investmentAccountId(fields.investmentKind)||fields.kind!=='投资'||!['是','否'].includes(fields.enabled)||fields.enabled==='是'&&!fields.opening||fields.enabled==='否'&&fields.opening)throw new Error('分类投资账户设置不正确。');}else if(!fields.opening)throw new Error('请填写期初金额。');}
  if(value.module==='财务管理'&&value.variant==='investment'){positionValue(fields.quantity,fields.cost);if(fields.price)positionValue(fields.quantity,fields.price);}
  if(value.module==='财务管理'&&value.variant==='investment-event')validateInvestmentEvent(fields);
  if(value.module==='财务管理'&&value.variant==='investment-quote')validateInvestmentQuote(fields);
  if(module.kind==='workspace-profile'&&fields.photo&&!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(fields.photo))throw new Error('头像格式不正确。');
  const attachment=validateAttachment(value.attachment);if(module.kind==='image'&&(!attachment||!attachment.type.startsWith('image/')))throw new Error('请选择一张图片。');
  const checkins=[...new Set(value.checkins||[])];if(checkins.length>30000||checkins.some(date=>typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)))throw new Error('打卡记录格式不正确。');
  return {id:value.id,module:value.module,variant:value.variant,title:value.title.trim(),fields,attachment,checkins,version:value.version,updatedAt:typeof value.updatedAt==='string'?value.updatedAt:'',createdAt:typeof value.createdAt==='string'?value.createdAt:'',...(typeof value.conflictOf==='string'?{conflictOf:value.conflictOf}:{})};
}

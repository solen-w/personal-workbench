import {test} from 'node:test';
import assert from 'node:assert/strict';
import {weekReport,accountBalance,investmentValue,validateFinanceChange,mondayOf} from '../finance-core.js';
import {validateRecord} from '../module-core.js';
import {validateData} from '../core.js';
const record=(id,variant,fields)=>validateRecord({id,module:'财务管理',variant,title:id,fields,version:'v1',updatedAt:'2026-11-22',createdAt:'2026-11-22'});
const budget=record('budget','budget',{amount:'1000',weekStart:'2026-11-16'});
const spending=record('spending','ledger',{amount:'250.25',kind:'支出',date:'2026-11-18',account:'cash'});
const recovered=record('recovered','recovery',{amount:'200',weekStart:'2026-11-16',date:'2026-11-22',from:'cash',to:'bank'});
test('周预算减实际支出再减手动回收，比例仅使用实际支出',()=>{
  const income=record('income','ledger',{amount:'100',kind:'收入',date:'2026-11-20'}),outside=record('outside','ledger',{amount:'500',kind:'支出',date:'2026-11-23'});
  const report=weekReport([budget,spending,recovered,income,outside],'2026-11-16');
  assert.equal(report.budget,100000);assert.equal(report.spent,25025);assert.equal(report.recovered,20000);assert.equal(report.available,54975);assert.equal(report.ratio,25);
});
test('固定周预算持续生效，下一次设置从对应周开始',()=>{
  const next=record('next','budget',{amount:'800',weekStart:'2026-11-30'});
  assert.equal(weekReport([budget,next],'2026-11-23').budget,100000);assert.equal(weekReport([budget,next],'2026-11-30').budget,80000);assert.equal(weekReport([budget],'2026-11-09').ratio,null);assert.equal(mondayOf('2026-11-22'),'2026-11-16');
});
test('回收需预算，不能超出结余，编辑时剔除自身',()=>{
  assert.throws(()=>validateFinanceChange(recovered,[]),/先设置/);assert.throws(()=>validateFinanceChange(record('large','recovery',{amount:'800',weekStart:'2026-11-16',date:'2026-11-20'}),[budget,spending]),/不能超过/);
  assert.doesNotThrow(()=>validateFinanceChange(recovered,[budget,spending,recovered],recovered.id));
  assert.throws(()=>validateFinanceChange({...recovered,fields:{...recovered.fields,to:''}},[budget]),/同时选择/);
});
test('预算周必须为周一，同一周不能重复设置或设置零金额',()=>{
  assert.throws(()=>validateFinanceChange({...budget,fields:{...budget.fields,weekStart:'2026-11-17'}},[]),/周一/);assert.throws(()=>validateFinanceChange({...budget,id:'another'},[budget]),/已设置/);assert.doesNotThrow(()=>validateFinanceChange(budget,[budget],budget.id));assert.throws(()=>validateFinanceChange({...budget,fields:{...budget.fields,amount:'0'}},[]),/大于零/);
});
test('账户支出与回收转存分别记账，转存不重复减少总资产',()=>{
  const cash=record('cash','account',{opening:'2000'}),bank=record('bank','account',{opening:'1000'}),records=[cash,bank,spending,recovered];
  assert.equal(accountBalance(cash,records),154975);assert.equal(accountBalance(bank,records),120000);assert.equal(accountBalance(cash,records)+accountBalance(bank,records),274975);
});
test('投资观察支持四位小数，乘积按分四舍五入并拒绝溢出',()=>{
  assert.deepEqual(investmentValue(record('fund','investment',{cost:'1.1234',price:'1.2345',quantity:'100.1234',date:'2026-11-22'})),{current:12360,cost:11248,change:1112});
  assert.throws(()=>investmentValue({fields:{cost:'999999999',price:'999999999',quantity:'999999999'}}),/过大/);
});
test('旧版文字和图片迁移为素材分类，保留附件和删除标记',()=>{
  const common={title:'旧内容',version:'v1',updatedAt:'',createdAt:''},attachment={id:'image',path:'data/assets/image',name:'photo.png',type:'image/png',size:4};
  const migrated=validateData({schemaVersion:2,tasks:[],tombstones:[],records:[{...common,id:'text',module:'文曲含章',fields:{content:'正文'}},{...common,id:'image',module:'万象包罗',fields:{tags:'照片'},attachment}],recordTombstones:[{id:'removed',version:'d',updatedAt:''}]});
  assert.equal(migrated.schemaVersion,7);assert.deepEqual(migrated.records.map(item=>[item.module,item.variant]),[['素材收集','text'],['素材收集','image']]);assert.deepEqual(migrated.records[1].attachment,attachment);assert.equal(migrated.recordTombstones.length,1);
});
test('新增运动、学习与身体记录支持数值校验',()=>{
  const base={id:'r',title:'记录',version:'v1'};
  assert.doesNotThrow(()=>validateRecord({...base,module:'运动挑战',fields:{target:'10.5',current:'3.5'}}));assert.doesNotThrow(()=>validateRecord({...base,module:'理论学习',fields:{target:'20',current:'5'}}));assert.throws(()=>validateRecord({...base,module:'身体跟踪',fields:{date:'2026-11-22',sleep:'25'}}),/睡眠/);
});

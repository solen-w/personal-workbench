import {test} from 'node:test';
import assert from 'node:assert/strict';
import {workspaceProfile,validPartialDate,displayPartialDate,experienceOrder} from '../workspace-core.js';
import {validateRecord} from '../module-core.js';
import {emptyData,validateData,mergeData} from '../core.js';
import {readingCounts,validateReading} from '../reading-core.js';
const record=(id,module,fields,variant='base',updatedAt='2026-11-22T10:00:00Z')=>validateRecord({id,module,fields,variant,title:'示例',version:id,updatedAt});
test('头像与名称参与三端数据合并和备份校验',()=>{
  const appearance=record('workspace-profile','基础情况',{name:'我的名称',photo:'data:image/jpeg;base64,/9j/2Q=='},'workspace-profile');const local={...emptyData(),records:[appearance]};const downloaded=mergeData(emptyData(),emptyData(),local).data;assert.deepEqual(workspaceProfile(validateData(JSON.parse(JSON.stringify(downloaded)))),{name:'我的名称',photo:'data:image/jpeg;base64,/9j/2Q=='});assert.equal(downloaded.schemaVersion,5);assert.throws(()=>record('bad','基础情况',{name:'名称',photo:'javascript:alert(1)'},'workspace-profile'));
});
test('工作台外观并发修改保留副本，最新记录在各设备显示一致',()=>{const first=record('a','基础情况',{name:'早期',photo:''},'workspace-profile'),second=record('b','基础情况',{name:'新名',photo:''},'workspace-profile','2026-11-22T11:00:00Z');assert.equal(workspaceProfile({...emptyData(),records:[first,second]}).name,'新名');assert.equal(workspaceProfile({...emptyData(),records:[second,first]}).name,'新名');});
test('经历支持只填写年月，真实日期格式化并按起始日期升序排列',()=>{
  assert.equal(validPartialDate('2024-08'),true);assert.equal(validPartialDate('2024-02-29'),true);assert.equal(validPartialDate('2025-02-29'),false);assert.equal(validPartialDate('2024-13'),false);assert.equal(displayPartialDate('2024-08'),'2024.08');assert.equal(displayPartialDate('2024-08-13'),'2024.08.13');
  const a=record('a','学工经历',{start:'2024-08-13',end:'2024-08'}),b=record('b','学工经历',{start:'2020-09',end:'2023-06'}),c=record('c','学工经历',{});assert.deepEqual([c,a,b].sort(experienceOrder).map(item=>item.id),['b','a','c']);assert.throws(()=>record('d','学工经历',{start:'2025-01',end:'2024-12'}));
});
test('原有所在地迁移为户籍地，保留已有个人资料字段',()=>{const saved=record('p','基础情况',{location:'原所在地',phone:'123',email:'a@example.com',occupation:'职业'});assert.equal(saved.fields.hometown,'原所在地');assert.equal(saved.fields.occupation,'职业');assert.equal(saved.fields.phone,'123');});
test('五种阅读统计覆盖电子书和有声书，未知年度数量不编造',()=>{
  assert.deepEqual(readingCounts([{status:'在读'},{status:'已读'},{status:'未读'},{status:'在听'}]),[{label:'全部阅读',count:4},{label:'在读',count:1},{label:'已读',count:1},{label:'未读',count:1},{label:'在听',count:1}]);
  const base={format:'workbench-weread-v1',totalReadSeconds:1,updatedAt:'2026-11-22T10:00:00Z',books:[],years:{2026:{totalReadSeconds:1,days:{}}}};assert.equal(validateReading(base).years[2026].readCountLabel,undefined);base.years[2026].readCountLabel='12本';assert.equal(validateReading(base).years[2026].readCountLabel,'12本');
});

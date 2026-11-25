import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateReading,duration,chinaDay,heatmapDays} from '../reading-core.js';
import {displayReadingBook,readingTitleId} from '../reading-core.js';
import {validateRecord} from '../module-core.js';
import {emptyData,validateData,mergeData} from '../core.js';
const sample=()=>({format:'workbench-weread-v1',updatedAt:'2026-11-22T18:00:00+08:00',totalReadSeconds:7200,years:{2026:{totalReadSeconds:3600,days:{'2026-11-20':0,'2026-11-21':1800}}},books:[{id:'book:1',title:'示例书',author:'作者',kind:'电子书',status:'在读',cover:'https://example.com/cover.png',link:'javascript:alert(1)',readDate:'2026-11-21'}],articleCollection:true});
test('时长按秒计算并使用北京时间日期',()=>{assert.equal(duration(7260),'2小时1分钟');assert.equal(duration(null),'—');assert.equal(chinaDay(new Date('2026-11-21T17:00:00Z')),'2026-11-22');});
test('热力表区分未知、零阅读、未来日期，按周一排列并支持闰年',()=>{const days=heatmapDays(2026,sample().years[2026].days,'2026-11-22');assert.equal(days.filter(Boolean).length,365);assert.equal(days.slice(0,3).every(day=>day===null),true);assert.equal(days.find(day=>day?.date==='2026-11-20').level,'zero');assert.equal(days.find(day=>day?.date==='2026-11-22').level,'unknown');assert.equal(days.find(day=>day?.date==='2026-11-23').future,true);assert.equal(heatmapDays(2024,{}).filter(Boolean).length,366);});
test('阅读快照净化链接与多余字段，不接受未知结构或空年份',()=>{const value=sample();value.apiKey='should-not-survive';const result=validateReading(value);assert.equal(result.books[0].link,'');assert.equal(result.apiKey,undefined);assert.equal(result.totalReadSeconds,7200);assert.throws(()=>validateReading({...value,years:{}}));assert.throws(()=>validateReading({...value,totalReadSeconds:'7200'}));assert.throws(()=>validateReading({...value,books:[value.books[0],value.books[0]]}));});
test('拒绝非法日期、负时长，书架只保留显示所需字段',()=>{const value=sample();value.years[2026].days['2026-02-30']=10;assert.throws(()=>validateReading(value));const other=sample();other.years[2026].days['2026-11-22']=-1;assert.throws(()=>validateReading(other));const safe=sample();safe.books[0].privateNote='不保存';assert.equal(validateReading(safe).books[0].privateNote,undefined);});
test('书名按稳定书籍编号保存，刷新来源和备份迁移后仍保留，并可恢复原名',async()=>{
  const id=await readingTitleId('book:1');assert.equal(id,await readingTitleId('book:1'));assert.notEqual(id,await readingTitleId('album:1'));
  const rename=validateRecord({id,module:'图书管理',variant:'reading-title',title:'自定义名',fields:{bookId:'book:1',customTitle:'自定义名'},version:'1',updatedAt:'2026-11-22T10:00:00Z'});
  const saved=validateData({...emptyData(),records:[rename]});assert.equal(saved.schemaVersion,6);const source={...sample().books[0],title:'来源更新后的原名'};
  assert.equal(displayReadingBook(source,saved.records).title,'自定义名');assert.equal(source.title,'来源更新后的原名');
  const restored={...rename,version:'2',updatedAt:'2026-11-22T11:00:00Z',fields:{...rename.fields,customTitle:''}};
  assert.equal(displayReadingBook(source,[restored,rename]).title,'来源更新后的原名');
});
test('两端并发改书名保留冲突副本，显示选择在各端一致',async()=>{
  const base=validateRecord({id:await readingTitleId('book:1'),module:'图书管理',variant:'reading-title',title:'原名',fields:{bookId:'book:1',customTitle:'旧名'},version:'base',updatedAt:'2026-11-22T08:00:00Z'}),local={...base,title:'本地',version:'local',fields:{...base.fields,customTitle:'本地'},updatedAt:'2026-11-22T10:00:00Z'},remote={...base,title:'远端',version:'remote',fields:{...base.fields,customTitle:'远端'},updatedAt:'2026-11-22T09:00:00Z'};
  const data=record=>({...emptyData(),records:[record]});let index=0;const merged=mergeData(data(base),data(local),data(remote),()=>String(++index));assert.equal(merged.conflicts,1);assert.equal(merged.data.records.length,2);assert.doesNotThrow(()=>validateData(merged.data));assert.equal(displayReadingBook(sample().books[0],merged.data.records).title,'本地');assert.equal(displayReadingBook(sample().books[0],[...merged.data.records].reverse()).title,'本地');
});

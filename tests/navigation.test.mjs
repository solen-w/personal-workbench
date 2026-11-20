import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NAV_GROUPS,CATEGORY_NAMES,DEFAULT_CATEGORY,AUTHORIZED_ACCOUNTS,isAuthorizedAccount} from '../config.js';
import {validateData,mergeData,emptyData} from '../core.js';
test('分组和条目保持用户文件的文字与顺序',()=>{
  assert.deepEqual(NAV_GROUPS,[{title:'命宫定盘',items:['命宫本元','履迹平生','财帛大有']},{title:'天行乾元',items:['乾元矢志','恒久不已']},{title:'坤厚载物',items:['文曲含章','万象包罗']},{title:'果行育德',items:['继明开卷']},{title:'归藏止静',items:['申命行事','节以制度']}]);
  assert.equal(CATEGORY_NAMES.length,10);
});
test('仅接受固定十进制授权账号，拒绝其他输入',()=>{
  assert.equal(AUTHORIZED_ACCOUNTS.length,1);
  assert.match(AUTHORIZED_ACCOUNTS[0],/^\d+$/);
  assert.equal(isAuthorizedAccount(AUTHORIZED_ACCOUNTS[0]),true);
  assert.equal(isAuthorizedAccount(' '+AUTHORIZED_ACCOUNTS[0]+' '),true);
  assert.equal(isAuthorizedAccount('1234567890'),false);
  assert.equal(isAuthorizedAccount(''),false);
  assert.equal(isAuthorizedAccount('<script>'),false);
});
test('旧任务保留并归入第一条目，现有分类在校验和合并后保留',()=>{
  const data=validateData({schemaVersion:1,tasks:[{id:'legacy',title:'原有任务'},{id:'categorized',title:'分类任务',category:'节以制度'}],tombstones:[]});
  assert.equal(data.tasks[0].category,DEFAULT_CATEGORY);
  assert.equal(data.tasks[1].category,'节以制度');
  const merged=mergeData(emptyData(),data,emptyData()).data;
  assert.deepEqual(merged,data);
});

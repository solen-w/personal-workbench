import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NAV_GROUPS,CATEGORY_NAMES,DEFAULT_CATEGORY,AUTHORIZED_ACCOUNTS,isAuthorizedAccount} from '../config.js';
import {validateData,mergeData,emptyData} from '../core.js';
test('分组和条目保持用户文件的文字与顺序',()=>{
  assert.deepEqual(NAV_GROUPS,[{title:'个人系统',items:['基础情况','学工经历','财务管理']},{title:'生活系统',items:['身体跟踪','习惯养成','图书管理']},{title:'目标系统',items:['运动挑战','专项攻克','理论学习']},{title:'文件系统',items:['工作要求','政策法规','素材收集']}]);
  assert.equal(CATEGORY_NAMES.length,12);
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
  assert.equal(data.tasks[1].category,'政策法规');
  const merged=mergeData(emptyData(),data,emptyData()).data;
  assert.deepEqual(merged,data);
});

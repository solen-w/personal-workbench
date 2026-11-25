import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {searchInvestmentCatalog} from '../investment-catalog.js';
import {investmentProfitClass} from '../investment-core.js';
test('本地目录可返回同代码的股票及基金，重复检索不重复下载',async()=>{let calls=0;const request=async()=>{calls++;return {ok:true,json:async()=>JSON.parse(await readFile(new URL('../investment-catalog.json',import.meta.url),'utf8'))};};const rows=await searchInvestmentCatalog('000001',{request});assert.ok(rows.some(r=>r.kind==='股票'&&r.name==='平安银行'));assert.ok(rows.some(r=>r.kind==='基金'&&r.name==='华夏成长混合'));assert.equal(calls,1);assert.ok((await searchInvestmentCatalog('600000',{request})).some(r=>r.name==='浦发银行'));assert.equal(calls,1);assert.ok((await searchInvestmentCatalog('0000',{request})).length<=20);});
test('收益按正红负绿零灰分类',()=>{assert.equal(investmentProfitClass(1),'investment-profit-positive');assert.equal(investmentProfitClass(-1),'investment-profit-negative');assert.equal(investmentProfitClass(0),'investment-profit-neutral');assert.equal(investmentProfitClass(null),'investment-profit-neutral');});

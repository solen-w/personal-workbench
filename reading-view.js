import {validateReading,duration,heatmapDays,chinaDay,displayReadingBook,readingTitleRecord,readingTitleId,readingCounts} from './reading-core.js?v=20261125-investment-2';
import {validateRecord} from './module-core.js?v=20261125-investment-2';
import {uid} from './core.js?v=20261125-investment-2';
const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
const button=(text,action)=>{const el=node('button','button',text);el.type='button';el.onclick=action;return el;};
const link=(text,url)=>{const el=node('a','button',text);el.href=url;el.target='_blank';el.rel='noopener noreferrer';return el;};
export function createReadingView(api){
  const root=document.getElementById('weread-panel');let year=Number(chinaDay().slice(0,4)),query='',filter='阅读中与已读',mode='board',busy=false,visible=false;
  let editing=null,saving=false,phase='';
  const titleDialog=document.getElementById('reading-title-dialog'),titleInput=document.getElementById('reading-title-input'),titleError=document.getElementById('reading-title-error');
  function editTitle(book){editing={book,repo:api.state().repo,original:readingTitleRecord(api.state().data.records,book.id)};titleInput.value=displayReadingBook(book,api.state().data.records).title;titleError.textContent='';titleDialog.showModal();titleInput.focus();titleInput.select();}
  async function saveTitle(restore=false){
    if(!editing||saving)return;const pending=editing,title=restore?'':titleInput.value.trim();
    if(!restore&&(!title||title.length>200)){titleError.textContent='请输入 1–200 字的书名。';return;}
    saving=true;document.getElementById('reading-title-save').disabled=true;document.getElementById('reading-title-reset').disabled=true;
    try{const id=await readingTitleId(pending.book.id);await api.write(state=>{
      if(state.repo!==pending.repo)throw new Error('数据仓库已变化，请重新打开修改书名。');
      const current=readingTitleRecord(state.data.records,pending.book.id);
      if(current?.version!==pending.original?.version)throw new Error('书名已在另一处修改，请重新打开后编辑。');
      const now=new Date().toISOString(),record=validateRecord({id:current?.id||id,module:'图书管理',variant:'reading-title',title:(title||pending.book.title).slice(0,200),fields:{bookId:pending.book.id,customTitle:title},version:uid(),updatedAt:now,createdAt:current?.createdAt||now});
      const index=state.data.records.findIndex(item=>item.id===record.id);if(index<0)state.data.records.push(record);else state.data.records[index]=record;
    });titleDialog.close();editing=null;api.toast(restore?'已恢复原书名':'书名已保存');}catch(error){titleError.textContent=error.message;}finally{saving=false;document.getElementById('reading-title-save').disabled=false;document.getElementById('reading-title-reset').disabled=false;}
  }
  document.getElementById('reading-title-form').onsubmit=event=>{event.preventDefault();return saveTitle();};
  document.getElementById('reading-title-reset').onclick=()=>saveTitle(true);
  function configure(){
    const dialog=document.getElementById('weread-dialog'),body=document.getElementById('weread-setup');body.replaceChildren();
    const base='https://github.com/'+api.state().repo;
    body.append(node('p','','在私有仓库中配置一次，密钥不会进入网页代码。'));
    const list=node('ol','weread-steps');
    const a=node('li','','新建仓库 Secret，名称填 WEREAD_API_KEY，值填你的微信读书密钥。');a.append(link('填写密钥',base+'/settings/secrets/actions/new'));
    const b=node('li','','回到图书管理点击“更新阅读”即可。之后进入此页会自动检查和更新。');list.append(a,b);body.append(list);dialog.showModal();
  }
  async function refresh(force=true){if(busy)return;busy=true;phase='正在检查…';render(visible);try{const result=await api.refreshReading({force,year,onProgress:text=>{phase=text;const status=root.querySelector('.reading-progress');if(status)status.textContent=text;}});if(force&&result?.updated)api.toast('阅读数据已更新');}catch(error){api.toast(error.message,true);}finally{busy=false;phase='';render(visible);}}
  function render(show){
    const entering=show&&!visible;visible=show;root.hidden=!show;if(!show)return;if(entering&&!busy&&api.canRefreshReading?.())queueMicrotask(()=>{if(visible&&!busy)refresh(false);});root.replaceChildren();
    let report=null;try{if(api.state().readingReport?.repo===api.state().repo)report=validateReading(api.state().readingReport.data);}catch{}
    const heading=node('div','reading-heading'),titles=node('div');titles.append(node('h2','','微信读书'));if(report)titles.append(node('span','reading-updated','更新于 '+new Date(report.updatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})));
    const actions=node('div','reading-actions'),refreshButton=button(busy?'正在更新…':'更新阅读',()=>refresh(true));refreshButton.disabled=busy;actions.append(button('连接配置',configure),refreshButton);heading.append(titles,actions);root.append(heading);if(busy){const status=node('p','reading-progress',phase);status.setAttribute('role','status');root.append(status);}
    if(!report){root.append(node('p','reading-empty','连接微信读书后，在这里查看阅读时长、热力表和书籍画板。'));return;}
    const years=Object.keys(report.years).sort().reverse();if(!report.years[year])year=Number(years[0]);const entry=report.years[year];
    const stats=node('div','module-stats reading-stats');for(const [label,value] of [['累计阅读 / 收听',duration(report.totalReadSeconds)],[year+'年阅读 / 收听',duration(entry?.totalReadSeconds)],['读过的书籍 / 有声书',report.books.filter(book=>book.status!=='未读').length]]){const card=node('div','module-stat');card.append(node('span','',label),node('strong','',value));stats.append(card);}root.append(stats);
    const heat=node('section','reading-heat'),heatHeading=node('div','reading-heading'),select=node('select');select.setAttribute('aria-label','热力表年份');for(const y of years){const option=node('option','',y+'年');option.value=y;select.append(option);}select.value=String(year);select.onchange=()=>{year=Number(select.value);render(true);};heatHeading.append(node('h3','','阅读热力表'),select);heat.append(heatHeading);
    const scroll=node('div','heat-scroll'),grid=node('div','heat-grid');grid.setAttribute('aria-label',year+'年每日阅读时长');
    for(const day of heatmapDays(year,entry?.days||{})){if(!day){grid.append(node('span','heat-cell padding'));continue;}const cell=node('button','heat-cell '+(day.future?'future':day.level));cell.type='button';const label=day.date+' · '+(day.future?'未来日期':day.seconds===null?'暂无数据':day.seconds<60?Math.round(day.seconds)+'秒':duration(day.seconds));cell.title=label;cell.setAttribute('aria-label',label);cell.onclick=()=>{document.getElementById('heat-selected').textContent=label;};grid.append(cell);}scroll.append(grid);heat.append(scroll);
    const legend=node('div','heat-legend');for(const [level,label] of [['unknown','未返回'],['zero','0分钟'],['one','不足30分钟'],['two','30–59分钟'],['three','1–2小时'],['four','2小时以上']]){const item=node('span');item.append(node('i','heat-cell '+level),document.createTextNode(label));legend.append(item);}heat.append(legend);const selected=node('p','heat-selected','点击日期查看时长');selected.id='heat-selected';heat.append(selected);root.append(heat);
    if(entry?.readCountLabel){const annual=node('div','module-stat reading-annual');annual.append(node('span','',year+'年度阅读数量'),node('strong','',entry.readCountLabel));root.append(annual);}
    const modes=node('div','reading-modes');modes.setAttribute('aria-label','书籍展示模式');for(const [value,label] of [['stats','统计模式'],['board','画板模式']]){const toggle=button(label,()=>{mode=value;render(true);});toggle.classList.toggle('active',mode===value);toggle.setAttribute('aria-pressed',String(mode===value));modes.append(toggle);}root.append(modes);
    if(mode==='stats'){const statistics=node('section','reading-category-stats');statistics.setAttribute('aria-label','书籍分类统计');for(const item of readingCounts(report.books)){const card=node('div','module-stat');card.append(node('span','',item.label),node('strong','',item.count+' 本'));statistics.append(card);}root.append(statistics);return;}
    const wall=node('section','reading-wall'),tools=node('div','reading-heading'),title=node('h3','','书籍画板'),controls=node('div','reading-controls'),search=node('input');search.type='search';search.placeholder='搜索书名或作者';search.setAttribute('aria-label','搜索微信读书书籍');search.value=query;
    const status=node('select');status.setAttribute('aria-label','筛选书籍');for(const value of ['阅读中与已读','全部书架','在读','已读','在听','未读']){const option=node('option','',value);option.value=value;status.append(option);}status.value=filter;controls.append(search,status);tools.append(title,controls);wall.append(tools);const board=node('div','book-board');
    function drawBooks(){board.replaceChildren();const books=report.books.map(book=>displayReadingBook(book,api.state().data.records)).filter(book=>(filter==='全部书架'||filter==='阅读中与已读'?filter==='全部书架'||book.status!=='未读':book.status===filter)&&(book.title+' '+book.sourceTitle+' '+book.author).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b.readDate.localeCompare(a.readDate));title.textContent='书籍画板 · '+books.length;
      for(const book of books){const card=node('article','book-tile'),cover=node('div','book-cover');if(book.cover){const img=node('img');img.src=book.cover;img.alt=book.title;img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>cover.replaceChildren(node('span','',book.title));cover.append(img);}else cover.append(node('span','',book.title));card.append(cover,node('h4','',book.title),node('p','book-author',book.author),node('span','record-tag',book.kind+' · '+book.status));const actions=node('div','book-tile-actions');actions.append(button('修改书名',()=>editTitle(report.books.find(item=>item.id===book.id))));if(book.link)actions.append(link('打开阅读',book.link));card.append(actions);board.append(card);}if(!books.length)board.append(node('p','reading-empty','暂无匹配书籍'));}
    search.oninput=()=>{query=search.value;drawBooks();};status.onchange=()=>{filter=status.value;drawBooks();};drawBooks();wall.append(board);root.append(wall);
  }
  return {render,configure};
}

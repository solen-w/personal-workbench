import {validateReading,duration,heatmapDays,chinaDay} from './reading-core.js';
const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
const button=(text,action)=>{const el=node('button','button',text);el.type='button';el.onclick=action;return el;};
const link=(text,url)=>{const el=node('a','button',text);el.href=url;el.target='_blank';el.rel='noopener noreferrer';return el;};
export function createReadingView(api){
  const root=document.getElementById('weread-panel');let year=Number(chinaDay().slice(0,4)),query='',filter='阅读中与已读',busy=false,visible=false;
  function configure(){
    const dialog=document.getElementById('weread-dialog'),body=document.getElementById('weread-setup');body.replaceChildren();
    const base='https://github.com/'+api.state().repo;
    body.append(node('p','','在私有仓库中配置一次，密钥不会进入网页代码。'));
    const list=node('ol','weread-steps');
    const a=node('li','','新建仓库 Secret，名称填 WEREAD_API_KEY，值填你的微信读书密钥。');a.append(link('填写密钥',base+'/settings/secrets/actions/new'));
    const b=node('li','','打开“微信读书同步”，点击 Run workflow，再确认运行。热力表年份可留空。');b.append(link('运行同步',base+'/actions/workflows/weread.yml'));
    const c=node('li','','运行成功后，回到这里点击“读取阅读数据”。');list.append(a,b,c);body.append(list);dialog.showModal();
  }
  async function refresh(){if(busy)return;busy=true;render(visible);try{await api.refreshReading();api.toast('阅读数据已读取');}catch(error){api.toast(error.message,true);}finally{busy=false;render(visible);}}
  function render(show){
    visible=show;root.hidden=!show;if(!show)return;root.replaceChildren();
    let report=null;try{if(api.state().readingReport?.repo===api.state().repo)report=validateReading(api.state().readingReport.data);}catch{}
    const heading=node('div','reading-heading'),titles=node('div');titles.append(node('h2','','微信读书'));if(report)titles.append(node('span','reading-updated','更新于 '+new Date(report.updatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})));
    const actions=node('div','reading-actions'),refreshButton=button(busy?'正在读取…':'读取阅读数据',refresh);refreshButton.disabled=busy;actions.append(button('连接配置',configure),refreshButton);heading.append(titles,actions);root.append(heading);
    if(!report){root.append(node('p','reading-empty','连接微信读书后，在这里查看阅读时长、热力表和书籍画板。'));return;}
    const years=Object.keys(report.years).sort().reverse();if(!report.years[year])year=Number(years[0]);const entry=report.years[year];
    const stats=node('div','module-stats reading-stats');for(const [label,value] of [['累计阅读 / 收听',duration(report.totalReadSeconds)],[year+'年阅读 / 收听',duration(entry?.totalReadSeconds)],['读过的书籍 / 有声书',report.books.filter(book=>book.status!=='未读').length]]){const card=node('div','module-stat');card.append(node('span','',label),node('strong','',value));stats.append(card);}root.append(stats);
    const heat=node('section','reading-heat'),heatHeading=node('div','reading-heading'),select=node('select');select.setAttribute('aria-label','热力表年份');for(const y of years){const option=node('option','',y+'年');option.value=y;select.append(option);}select.value=String(year);select.onchange=()=>{year=Number(select.value);render(true);};heatHeading.append(node('h3','','阅读热力表'),select);heat.append(heatHeading);
    const scroll=node('div','heat-scroll'),grid=node('div','heat-grid');grid.setAttribute('aria-label',year+'年每日阅读时长');
    for(const day of heatmapDays(year,entry?.days||{})){if(!day){grid.append(node('span','heat-cell padding'));continue;}const cell=node('button','heat-cell '+(day.future?'future':day.level));cell.type='button';const label=day.date+' · '+(day.future?'未来日期':day.seconds===null?'暂无数据':day.seconds<60?Math.round(day.seconds)+'秒':duration(day.seconds));cell.title=label;cell.setAttribute('aria-label',label);cell.onclick=()=>{document.getElementById('heat-selected').textContent=label;};grid.append(cell);}scroll.append(grid);heat.append(scroll);
    const legend=node('div','heat-legend');for(const [level,label] of [['unknown','未返回'],['zero','0分钟'],['one','不足30分钟'],['two','30–59分钟'],['three','1–2小时'],['four','2小时以上']]){const item=node('span');item.append(node('i','heat-cell '+level),document.createTextNode(label));legend.append(item);}heat.append(legend);const selected=node('p','heat-selected','点击日期查看时长');selected.id='heat-selected';heat.append(selected);root.append(heat);
    const wall=node('section','reading-wall'),tools=node('div','reading-heading'),title=node('h3','','书籍画板'),controls=node('div','reading-controls'),search=node('input');search.type='search';search.placeholder='搜索书名或作者';search.setAttribute('aria-label','搜索微信读书书籍');search.value=query;
    const status=node('select');status.setAttribute('aria-label','筛选书籍');for(const value of ['阅读中与已读','全部书架','在读','已读','在听','未读']){const option=node('option','',value);option.value=value;status.append(option);}status.value=filter;controls.append(search,status);tools.append(title,controls);wall.append(tools);const board=node('div','book-board');
    function drawBooks(){board.replaceChildren();const books=report.books.filter(book=>(filter==='全部书架'||filter==='阅读中与已读'?filter==='全部书架'||book.status!=='未读':book.status===filter)&&(book.title+' '+book.author).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b.readDate.localeCompare(a.readDate));title.textContent='书籍画板 · '+books.length;
      for(const book of books){const card=node('article','book-tile'),cover=node('div','book-cover');if(book.cover){const img=node('img');img.src=book.cover;img.alt=book.title;img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>cover.replaceChildren(node('span','',book.title));cover.append(img);}else cover.append(node('span','',book.title));card.append(cover,node('h4','',book.title),node('p','book-author',book.author),node('span','record-tag',book.kind+' · '+book.status));if(book.link)card.append(link('打开阅读',book.link));board.append(card);}if(!books.length)board.append(node('p','reading-empty','暂无匹配书籍'));}
    search.oninput=()=>{query=search.value;drawBooks();};status.onchange=()=>{filter=status.value;drawBooks();};drawBooks();wall.append(board);root.append(wall);
  }
  return {render,configure};
}

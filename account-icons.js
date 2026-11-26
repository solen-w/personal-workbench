import {ACCOUNT_ICONS} from './account-icon-catalog.js?v=20261126-icons-1';
export {ACCOUNT_ICONS};
export const accountIcon=id=>ACCOUNT_ICONS.find(icon=>icon.id===id);
export function accountIconElement(id){
  const icon=accountIcon(id),wrap=document.createElement('span');wrap.className='account-entry-icon';wrap.setAttribute('aria-hidden','true');
  const fallback=()=>{wrap.replaceChildren();wrap.textContent='¥';wrap.classList.add('account-entry-icon-default');};
  if(icon){const image=document.createElement('img');image.src=icon.src;image.alt='';image.draggable=false;image.loading='lazy';image.decoding='async';image.onerror=fallback;wrap.append(image);}else fallback();return wrap;
}
export function createAccountIconPicker(value=''){
  const input=document.createElement('input');input.type='hidden';input.value=value;
  const control=document.createElement('div');control.className='account-icon-control';const choose=document.createElement('button');choose.type='button';choose.className='button account-icon-choose';
  function preview(){choose.replaceChildren(accountIconElement(input.value),document.createTextNode(accountIcon(input.value)?.name||'选择图标'));}
  choose.onclick=()=>{
    const dialog=document.createElement('dialog');dialog.className='account-icon-dialog';dialog.setAttribute('aria-label','账户图标库');const heading=document.createElement('div');heading.className='dialog-heading';const title=document.createElement('h2');title.textContent='选择图标';const close=document.createElement('button');close.type='button';close.className='button text-button';close.textContent='关闭';close.onclick=()=>dialog.close();heading.append(title,close);
    const search=document.createElement('input');search.className='account-icon-search';search.type='search';search.placeholder='搜索图标名称、分类或简称';search.setAttribute('aria-label',search.placeholder);
    const toolbar=document.createElement('div');toolbar.className='account-icon-tools';const count=document.createElement('span'),reset=document.createElement('button');reset.type='button';reset.className='button text-button';reset.textContent='使用默认图标';toolbar.append(count,reset);
    const groups=document.createElement('div');groups.className='account-icon-groups';
    const pick=id=>{input.value=id;preview();input.dispatchEvent(new document.defaultView.Event('change',{bubbles:true}));dialog.close();};reset.onclick=()=>pick('');
    function render(){groups.replaceChildren();const words=search.value.trim().toLowerCase().split(/\s+/).filter(Boolean),items=ACCOUNT_ICONS.filter(icon=>words.every(word=>(icon.name+' '+icon.group+' '+icon.keywords).toLowerCase().includes(word)));count.textContent=items.length+'个图标';
      for(const category of ['银行','证券','生活','社交娱乐','网络服务']){const entries=items.filter(i=>i.group===category);if(!entries.length)continue;const section=document.createElement('section');section.className='account-icon-group';const title=document.createElement('h3');title.textContent=category;const grid=document.createElement('div');grid.className='account-icon-grid';for(const icon of entries){const item=document.createElement('button');item.type='button';item.className='account-icon-option';item.setAttribute('aria-label','选择图标'+icon.name);item.setAttribute('aria-pressed',String(input.value===icon.id));const label=document.createElement('span');label.textContent=icon.name;item.append(accountIconElement(icon.id),label);item.onclick=()=>pick(icon.id);grid.append(item);}section.append(title,grid);groups.append(section);}
      if(!items.length){const empty=document.createElement('p');empty.className='account-icon-empty';empty.textContent='没有匹配的图标';groups.append(empty);}
    }
    search.oninput=render;dialog.append(heading,search,toolbar,groups);document.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();choose.focus();});render();dialog.showModal();search.focus();
  };
  preview();control.append(choose);return {input,control};
}

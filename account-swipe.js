let closeActive=null;
// 纵向手势保留页面滚动，横向手势仅移动当前账户行。
export function attachAccountSwipe(card,actions,open){
  const content=document.createElement('div');content.className='account-swipe-content';content.append(...card.childNodes);card.classList.add('account-swipe-row');content.tabIndex=0;content.setAttribute('role','button');content.setAttribute('aria-label',content.querySelector('.record-title')?.textContent+'，查看及编辑详情');card.append(actions,content);
  const width=actions.children.length*82;card.style.setProperty('--swipe-width',width+'px');let expanded=false,gesture=null,suppressUntil=0;
  function setOpen(value){if(value&&closeActive)closeActive();expanded=value;card.classList.toggle('swipe-open',value);card.classList.remove('swipe-dragging');content.style.transform='';actions.inert=!value;actions.setAttribute('aria-hidden',String(!value));content.setAttribute('aria-expanded',String(value));closeActive=value?()=>setOpen(false):null;}
  setOpen(false);
  content.onclick=()=>{if(Date.now()<suppressUntil)return;if(expanded)setOpen(false);else open();};
  content.onkeydown=event=>{if(['Enter',' ','ArrowLeft','ArrowRight','Escape'].includes(event.key)){event.preventDefault();if(event.key==='Enter'||event.key===' ')open();else setOpen(event.key==='ArrowLeft'&&width>0);}};
  if(!width)return;
  content.onpointerdown=event=>{if(event.isPrimary===false||event.button>0)return;gesture={id:event.pointerId,x:event.clientX,y:event.clientY,start:expanded?-width:0,position:expanded?-width:0,horizontal:false};};
  content.onpointermove=event=>{if(!gesture||gesture.id!==event.pointerId)return;const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;if(!gesture.horizontal){if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>8){gesture=null;return;}if(Math.abs(dx)<8)return;gesture.horizontal=true;card.classList.add('swipe-dragging');content.setPointerCapture?.(event.pointerId);actions.inert=false;actions.setAttribute('aria-hidden','false');}event.preventDefault();gesture.position=Math.max(-width,Math.min(0,gesture.start+dx));content.style.transform='translateX('+gesture.position+'px)';};
  const finish=event=>{if(!gesture||gesture.id!==event.pointerId)return;const current=gesture;gesture=null;if(current.horizontal){suppressUntil=Date.now()+350;setOpen(event.type==='pointercancel'?expanded:current.position<-Math.min(45,width/2));if(content.hasPointerCapture?.(event.pointerId))content.releasePointerCapture(event.pointerId);}};
  content.onpointerup=finish;content.onpointercancel=finish;content.onlostpointercapture=finish;
  for(const action of actions.children){const run=action.onclick;action.onclick=event=>{event.stopPropagation();setOpen(false);run?.(event);};}
}

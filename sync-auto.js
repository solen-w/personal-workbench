// 保存后延迟合并上传，前台周期拉取；失败时保留本地数据。
export const DATA_SYNC_POLL_MS=30000;
export function createDataAutoSync({isActive,isBusy=()=>false,isDirty,sync,onError=()=>{},setTimer=setTimeout,clearTimer=clearTimeout}){
 let active=false,running=false,timer=null,rerun=false;
 function clear(){if(timer!==null){clearTimer(timer);timer=null;}}
 function schedule(ms){clear();if(active)timer=setTimer(()=>{timer=null;execute();},ms);}
 async function execute(){if(!active||!isActive())return;if(running){rerun=true;return;}if(isBusy()){schedule(1000);return;}running=true;rerun=false;try{await sync();onError(null);}catch(e){onError(e);}finally{running=false;if(active&&isActive())schedule(rerun?1000:DATA_SYNC_POLL_MS);}}
 function update(){const next=!!isActive();if(next===active)return;active=next;clear();if(active)schedule(250);}
 function changed(){if(!isDirty())return;rerun=true;if(active&&!running)schedule(1000);}
 function stop(){active=false;clear();}
 return {update,changed,stop};
}

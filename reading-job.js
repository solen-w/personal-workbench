export const validReadingJob=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
function decodeRequest(file){try{if(file?.encoding!=='base64'||typeof file.content!=='string')return null;return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(file.content.replace(/\s/g,'')),char=>char.charCodeAt(0))));}catch{return null;}}
export async function requestReadingUpdate({repo,year,pending,request,onPending,onProgress=()=>{},check=()=>{},clock=Date.now,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),makeId=()=>crypto.randomUUID(),timeout=360000}){
  let job=pending?.repo===repo&&validReadingJob(pending.id)?pending:null;
  if(!job){
    onProgress('正在提交更新…');let submitted=false;
    const id=makeId(),body={format:'workbench-weread-request-v1',id,year:String(year),requestedAt:new Date(clock()).toISOString()};if(!validReadingJob(id))throw new Error('更新编号格式不正确。');
    const utf8=new TextEncoder().encode(JSON.stringify(body)),content=btoa(String.fromCharCode(...utf8));
    for(let attempt=0;attempt<3;attempt++){check();const current=await request('GET',undefined,'data/weread-request.json');if(current.status!==404&&!current.ok)throw new Error('无法读取阅读更新请求，请检查 GitHub Contents 读写权限。');const file=current.status===404?null:await current.json(),existing=decodeRequest(file);check();
      if(existing?.format==='workbench-weread-request-v1'&&validReadingJob(existing.id)&&String(existing.year)===String(year)&&clock()-Date.parse(existing.requestedAt)>=0&&clock()-Date.parse(existing.requestedAt)<360000){const status=await request('GET',undefined,'data/weread-jobs/'+existing.id+'.json',true);if(status.status===404){job={repo,id:existing.id,year:String(year),requestedAt:existing.requestedAt};submitted=true;break;}}
      const put=await request('PUT',{message:'请求更新微信读书',content,...(file?.sha?{sha:file.sha}:{})},'data/weread-request.json');if(put.status===409||put.status===422)continue;if(!put.ok)throw new Error('无法提交更新，请检查 GitHub Contents 读写权限。');submitted=true;break;}
    if(!submitted)throw new Error('其他设备正在提交更新，请稍后重试。');job??={repo,id,year:String(year),requestedAt:body.requestedAt};await onPending(job);
  }
  const deadline=clock()+timeout;onProgress('后台正在更新，请稍候…');
  while(clock()<deadline){
    check();const response=await request('GET',undefined,'data/weread-jobs/'+job.id+'.json',true);
    if(response.status!==404){if(!response.ok)throw new Error('无法读取更新状态，原有阅读数据已保留。');const result=await response.json();if(result.format!=='workbench-weread-status-v1'||result.requestId!==job.id||!['success','failed'].includes(result.state))throw new Error('阅读更新状态不正确。');if(result.state==='failed'){await onPending(null);throw new Error(typeof result.error==='string'?result.error.slice(0,200):'微信读书更新失败，原有数据已保留。');}return result;}
    await wait(Math.min(5000,Math.max(0,deadline-clock())));
  }
  throw new Error('后台仍在排队，请稍后点击“更新阅读”继续查看；原有数据已保留。');
}

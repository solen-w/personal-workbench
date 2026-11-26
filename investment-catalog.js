let pending,index;
export async function searchInvestmentCatalog(code,{request=fetch}={}){
 if(!/^\d{2,6}$/.test(code))return [];
 if(!index){pending??=(async()=>{const response=await request('./investment-catalog.json?v=20261126-account-cards-2');if(!response.ok)throw new Error('代码目录暂不可用');const data=await response.json();if(data.format!=='workbench-investment-catalog-v1'||!Array.isArray(data.items))throw new Error('代码目录格式不正确');return data.items.filter(r=>Array.isArray(r)&&/^\d{6}$/.test(r[0])&&typeof r[1]==='string'&&['股票','基金'].includes(r[2])).map(([code,name,kind])=>({code,name,kind}));})();try{index=await pending;}catch(e){pending=null;throw e;}}
 return index.filter(row=>row.code.startsWith(code)).slice(0,20);
}

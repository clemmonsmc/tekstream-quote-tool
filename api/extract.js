const xlsx = require('xlsx');
function addDays(d,n){if(!d)return '';const dt=new Date(d+'T00:00:00Z');dt.setUTCDate(dt.getUTCDate()+n);return dt.toISOString().split('T')[0];}
function fmtDate(v){if(!v)return '';const s=String(v);const m=s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(m)return m[3]+'-'+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0');if(typeof v==='number')return new Date(Math.round((v-25569)*864e5)).toISOString().split('T')[0];if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;return '';}
function applyDates(items,hs,he,exp){return items.map(function(it){let s=it.start_date||'',e=it.end_date||'';if(!s)s=hs||'';if(!e)e=he||'';if((!s||!e)&&exp){if(!s)s=addDays(exp,1);if(!e)e=addDays(exp,365);}return Object.assign({},it,{start_date:s,end_date:e});});}
module.exports = async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(200).end();
  if(req.method!=='POST')return res.status(405).json({error:'Method Not Allowed'});
  const body=req.body||{};const data=body.fileBase64||body.pdfBase64;const type=body.fileType||'';const name=(body.fileName||'').toLowerCase();
  if(!data)return res.status(400).json({error:'Missing file data'});
  const isExcel=type.includes('spreadsheet')||type.includes('excel')||name.endsWith('.xlsx')||name.endsWith('.xls');
  if(isExcel){
    const buf=Buffer.from(data,'base64');const wb=xlsx.read(buf,{type:'buffer',sheetStubs:true});const ws=wb.Sheets[wb.SheetNames[0]];
    const orig=xlsx.utils.decode_range(ws['!ref']||'A1:A1');ws['!ref']=xlsx.utils.encode_range({s:orig.s,e:{r:orig.e.r+50,c:orig.e.c}});
    const rows=xlsx.utils.sheet_to_json(ws,{header:1,defval:null,blankrows:true});
    const allText=rows.map(r=>r.join(' ')).join(' ').toUpperCase();
    let vad='Unknown';
    if(allText.includes('TD SYNNEX')||allText.includes('VRF HEADER LEVEL')||allText.includes('EU NAME:'))vad='TD Synnex';
    else if(allText.includes('ARROW'))vad='Arrow';else if(allText.includes('CARAHSOFT'))vad='Carahsoft';
    if(vad==='TD Synnex'){
      let toCompany='TekStream Solutions',forCompany='',quoteExpireDate='',headerStart='',headerEnd='';
      for(const row of rows){
        const flat=row.join('|');
        if(flat.includes('EU name:')&&row[1])forCompany=String(row[1]).trim();
        if(flat.includes('Bill To:')&&row[1])toCompany=String(row[1]).replace(/\(.*?\)/g,'').trim()||toCompany;
        if(flat.includes('Ship To:')&&!forCompany&&row[3])forCompany=String(row[3]).replace(/\(.*?\)/g,'').trim();
        const m=String(row[0]||'').match(/Quote Expire Date:([\d\/]+)/i);if(m)quoteExpireDate=fmtDate(m[1].trim());
      }
      let headerRow=-1;
      for(let i=0;i<rows.length;i++){if(rows[i].join('|').toUpperCase().includes('QUOTE LINE')&&rows[i].join('|').toUpperCase().includes('SKU')){headerRow=i;break;}}
      let qtyCol=16,priceCol=18,startCol=14,endCol=15;
      if(headerRow>=0){rows[headerRow].forEach((c,i)=>{const u=String(c||'').toUpperCase().trim();if(u==='QTY')qtyCol=i;if(u==='RESELLER PRICE')priceCol=i;if(u==='START DATE')startCol=i;if(u==='END DATE')endCol=i;});}
      const rawItems=[];const ds=headerRow>=0?headerRow+1:24;
      for(let i=ds;i<rows.length;i++){
        const row=rows[i];if(!row||row.every(v=>v===null))continue;
        const first=String(row[0]||'').toLowerCase();
        if(first.includes('estimated')||first.includes('total')||first.includes('vendor term')||first.includes('all purchases'))break;
        const sku=String(row[2]||'').trim();if(!sku)continue;
        const qty=parseFloat(String(row[qtyCol]||'').replace(/,/g,''));const price=parseFloat(String(row[priceCol]||'').replace(/[$,]/g,''));
        if(isNaN(qty)&&isNaN(price))continue;
        rawItems.push({sku,description:String(row[9]||row[7]||'').trim(),qty:isNaN(qty)?1:qty,unit_price:isNaN(price)?0:price,start_date:fmtDate(row[startCol]),end_date:fmtDate(row[endCol])});
      }
      return res.status(200).json({vad,quote_expire_date:quoteExpireDate,to:{company:toCompany,name:'',email:''},for:{company:forCompany,name:'',email:''},lineItems:applyDates(rawItems,headerStart,headerEnd,quoteExpireDate)});
    }
    const txt=rows.slice(0,60).map(r=>r.join('\t')).join('\n');
    return extractViaAI(res,null,txt,vad);
  }
  return extractViaAI(res,data,null,'');
}
async function extractViaAI(res,pdf,txt,vad){
  const key=process.env.ANTHROPIC_API_KEY;if(!key)return res.status(500).json({error:'No API key'});
  const instr='Return ONLY this JSON (no commentary):\n{"quote_expire_date":"","to":{"company":"","name":"","email":""},"for":{"company":"","name":"","email":""},"header_start_date":"","header_end_date":"","lineItems":[{"sku":"","description":"","qty":1,"unit_price":0,"start_date":"","end_date":""}]}\nRules:\n- to=reseller/TekStream, for=end customer\n- unit_price=distributor price (not list)\n- All dates YYYY-MM-DD\n- quote_expire_date=quote validity/expiry from header if present else \"\"\n- header_start_date/header_end_date=document-level start/end dates else \"\"\n- Line item dates: use line-level if present, else header dates, else leave \"\" (server derives from quote_expire_date)';
  const content=pdf?[{type:'document',source:{type:'base64',media_type:'application/pdf',data:pdf}},{type:'text',text:instr}]:[{type:'text',text:instr+'\n\n'+txt}];
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:'claude-opus-4-6',max_tokens:2000,system:'Extract VAD distributor quote data. Return ONLY valid JSON, no commentary.',messages:[{role:'user',content}]})});
  const d=await r.json();if(d.error)return res.status(500).json({error:d.error.message});
  const t=(d.content||[]).map(c=>c.text||'').join('');const s=t.indexOf('{'),e=t.lastIndexOf('}');
  if(s===-1)return res.status(500).json({error:'No JSON in response'});
  const result=JSON.parse(t.slice(s,e+1));if(vad)result.vad=vad;
  if(result.lineItems)result.lineItems=applyDates(result.lineItems,result.header_start_date||'',result.header_end_date||'',result.quote_expire_date||'');
  return res.status(200).json(result);
}
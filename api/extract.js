const xlsx = require('xlsx');

function addDays(d,n){if(!d)return '';const dt=new Date(d+'T00:00:00Z');dt.setUTCDate(dt.getUTCDate()+n);return dt.toISOString().split('T')[0];}
function fmtDate(v){
  if(!v)return '';
  const s=String(v).trim();
  // M/D/YYYY or M-D-YYYY
  let m=s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if(m)return m[3]+'-'+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0');
  // YYYY-MM-DD already
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  if(typeof v==='number')return new Date(Math.round((v-25569)*864e5)).toISOString().split('T')[0];
  return '';
}
function applyDates(items,hs,he,exp){
  return items.map(function(it){
    let s=it.start_date||'',e=it.end_date||'';
    if(!s)s=hs||'';if(!e)e=he||'';
    if((!s||!e)&&exp){if(!s)s=addDays(exp,1);if(!e)e=addDays(exp,365);}
    return Object.assign({},it,{start_date:s,end_date:e});
  });
}

// ── Qualys PDF parser ────────────────────────────────────────────────────────
function parseQualys(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  // Header fields
  let quoteExpireDate = '', headerStart = '', headerEnd = '';
  let forCompany = '', quoteNumber = '';

  for(let i=0;i<lines.length;i++){
    const l=lines[i];
    if(l.startsWith('Quote #:'))quoteNumber=l.replace('Quote #:','').trim();
    if(l.startsWith('Valid Until:'))quoteExpireDate=fmtDate(l.replace('Valid Until:','').trim());
    if(l.startsWith('Anticipated Start Date:'))headerStart=fmtDate(l.replace('Anticipated Start Date:','').trim());
    if(l.startsWith('Anticipated End Date:'))headerEnd=fmtDate(l.replace('Anticipated End Date:','').trim());
    // Ship To = customer (line after "Ship To")
    if(l==='Ship To'&&lines[i+1])forCompany=lines[i+1].trim();
  }

  // Detect format: A has "Net Price" column header, B has "NET TOTAL" only
  const hasNetPrice = /Net Price/i.test(text);
  const hasNetTotal = /NET TOTAL/i.test(text) || /Net Total/i.test(text);
  const isFormatA = hasNetPrice;
  const isFormatB = !hasNetPrice && hasNetTotal;

  // Parse year/group section headers for date ranges
  // "Year 1; 2026-2027,6-21-2026/6-20-2027" or "Group1,4-28-2026/4-27-2027"
  function parseSectionDates(header) {
    const m = header.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})[\/\-\s]+(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/);
    if(m) return { start: fmtDate(m[1]), end: fmtDate(m[2]) };
    return null;
  }

  // Line item patterns
  const rawItems = [];

  if(isFormatA) {
    // Format A: Qty | Part# | Description | Customer Price | Partner Disc | Net Price
    // Section headers like "Year 1; 2026-2027,6-21-2026/6-20-2027"
    let currentStart = headerStart, currentEnd = headerEnd;

    // Find all section headers and line items
    // Pattern: line starts with a number (qty) followed by Q- part number
    const lineRe = /^(\d+)\s+(Q-\S+|Discount)\s+(.+?)\s+USD\s+([\d,]+\.?\d*)\s+USD\s+([\d,]+\.?\d*)\s+USD\s+([\-\d,]+\.?\d*)/;

    for(let i=0;i<lines.length;i++){
      const l=lines[i];
      // Section header detection
      if(/^Year\s+\d+[;\s]/.test(l)||/^Group\d+[,\s]/.test(l)){
        const dates=parseSectionDates(l);
        if(dates){currentStart=dates.start;currentEnd=dates.end;}
        continue;
      }
      const m=l.match(lineRe);
      if(m){
        const qty=parseFloat(m[1]);
        const partNum=m[2];
        const desc=m[3].trim();
        // m[4]=customer price, m[5]=partner disc, m[6]=net price (total)
        const netTotal=parseFloat(m[6].replace(/,/g,''));
        if(partNum==='Discount'||desc.toLowerCase().includes('discount'))continue;
        if(isNaN(qty)||qty<=0)continue;
        const unitPrice=Math.abs(netTotal)/qty;
        rawItems.push({sku:partNum,description:desc,qty,unit_price:unitPrice,start_date:currentStart,end_date:currentEnd,margin:null});
      }
    }
  }

  if(isFormatB || rawItems.length===0) {
    // Format B: QTY | PART# | DESCRIPTION | NET TOTAL
    // Need to calculate per-line unit price via proportional allocation
    // Grand Net Total = bottom-most "Net Total:" value
    // Customer Total = "Customer Total:" value

    // Find grand net total (last occurrence)
    let grandNetTotal = 0, customerTotal = 0;
    const netTotalMatches = [...text.matchAll(/(?:Grand Total\s+)?Net Total[:\s]+USD\s*([\d,]+\.?\d*)/gi)];
    if(netTotalMatches.length>0){
      grandNetTotal=parseFloat(netTotalMatches[netTotalMatches.length-1][1].replace(/,/g,''));
    }
    const custMatch=text.match(/(?:Grand Total\s+)?Customer Total[:\s]+USD\s*([\d,]+\.?\d*)/i);
    if(custMatch)customerTotal=parseFloat(custMatch[1].replace(/,/g,''));

    // If no Customer Total found, use total amount due
    if(!customerTotal){
      const amtMatch=text.match(/Total Amount Due[:\s]+USD\s*([\d,]+\.?\d*)/i);
      if(amtMatch)customerTotal=parseFloat(amtMatch[1].replace(/,/g,''));
    }

    // Per-group/section parsing
    let currentStart = headerStart, currentEnd = headerEnd;
    let groupItems = []; // {sku, desc, qty, listPrice, start, end}

    // Line item pattern for format B: number, part#, description, USD amount
    // Try to match: qty  partnum  description  USD X
    const lineRe2=/^(\d+)\s+(Q-\S+|Discount)\s+(.+?)\s+USD\s+([\-\d,]+\.?\d*)/;

    for(let i=0;i<lines.length;i++){
      const l=lines[i];
      if(/^Year\s+\d+[;\s]/.test(l)||/^Group\d+[,\s]/.test(l)){
        const dates=parseSectionDates(l);
        if(dates){currentStart=dates.start;currentEnd=dates.end;}
        continue;
      }
      const m=l.match(lineRe2);
      if(m){
        const qty=parseFloat(m[1]);
        const partNum=m[2];
        const desc=m[3].trim();
        const listTotal=parseFloat(m[4].replace(/,/g,''));
        if(partNum==='Discount'||desc.toLowerCase().includes('discount'))continue;
        if(isNaN(qty)||qty<=0)continue;
        groupItems.push({sku:partNum,description:desc,qty,listPrice:Math.abs(listTotal),start_date:currentStart,end_date:currentEnd,margin:null});
      }
    }

    // Calculate total list price (excluding discounts)
    const totalListPrice=groupItems.reduce((s,it)=>s+it.listPrice,0);

    // Proportional allocation: unit_price = (listPrice / totalListPrice) * grandNetTotal / qty
    const netBasis = grandNetTotal>0 ? grandNetTotal : customerTotal;
    groupItems.forEach(it=>{
      const proportion = totalListPrice>0 ? it.listPrice/totalListPrice : 1/groupItems.length;
      const lineNet = proportion * netBasis;
      it.unit_price = it.qty>0 ? lineNet/it.qty : 0;
      rawItems.push({sku:it.sku,description:it.description,qty:it.qty,unit_price:it.unit_price,start_date:it.start_date,end_date:it.end_date,margin:null});
    });
  }

  const lineItems = applyDates(rawItems, headerStart, headerEnd, quoteExpireDate);

  return {
    vad: 'Qualys',
    quote_number: quoteNumber,
    quote_expire_date: quoteExpireDate,
    to: { company: 'TekStream', name: '', email: '' },
    for: { company: forCompany, name: '', email: '' },
    lineItems
  };
}

// ── Main handler ─────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method==='OPTIONS')return res.status(200).end();
  if(req.method!=='POST')return res.status(405).json({error:'Method Not Allowed'});

  const body=req.body||{};
  const data=body.fileBase64||body.pdfBase64;
  const type=body.fileType||'';
  const name=(body.fileName||'').toLowerCase();
  if(!data)return res.status(400).json({error:'Missing file data'});

  const isExcel=type.includes('spreadsheet')||type.includes('excel')||name.endsWith('.xlsx')||name.endsWith('.xls');

  if(isExcel){
    const buf=Buffer.from(data,'base64');
    const wb=xlsx.read(buf,{type:'buffer',sheetStubs:true});
    const ws=wb.Sheets[wb.SheetNames[0]];
    const orig=xlsx.utils.decode_range(ws['!ref']||'A1:A1');
    ws['!ref']=xlsx.utils.encode_range({s:orig.s,e:{r:orig.e.r+50,c:orig.e.c}});
    const rows=xlsx.utils.sheet_to_json(ws,{header:1,defval:null,blankrows:true});
    const allText=rows.map(r=>r.join(' ')).join(' ').toUpperCase();
    let vad='Unknown';
    if(allText.includes('TD SYNNEX')||allText.includes('VRF HEADER LEVEL')||allText.includes('EU NAME:'))vad='TD Synnex';
    else if(allText.includes('ARROW'))vad='Arrow';
    else if(allText.includes('CARAHSOFT'))vad='Carahsoft';
    if(vad==='TD Synnex'){
      let toCompany='TekStream',forCompany='',quoteExpireDate='',headerStart='',headerEnd='';
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
        rawItems.push({sku,description:String(row[9]||row[7]||'').trim(),qty:isNaN(qty)?1:qty,unit_price:isNaN(price)?0:price,start_date:fmtDate(row[startCol]),end_date:fmtDate(row[endCol]),margin:null});
      }
      return res.status(200).json({vad,quote_expire_date:quoteExpireDate,to:{company:toCompany,name:'',email:''},for:{company:forCompany,name:'',email:''},lineItems:applyDates(rawItems,headerStart,headerEnd,quoteExpireDate)});
    }
    const txt=rows.slice(0,60).map(r=>r.join('\t')).join('\n');
    return extractViaAI(res,null,txt,vad);
  }

  // PDF path — check for Qualys before sending to AI
  return extractViaAI(res,data,null,'',true);
}

async function extractViaAI(res,pdf,txt,vad,checkQualys=false){
  const key=process.env.ANTHROPIC_API_KEY;
  if(!key)return res.status(500).json({error:'No API key'});

  // For Qualys PDFs, extract text first and route to structured parser
  if(checkQualys&&pdf){
    // Use AI to extract raw text, detect Qualys, then parse structurally
    const detectRes=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},
      body:JSON.stringify({
        model:'claude-opus-4-6',max_tokens:100,
        system:'Detect if this is a Qualys quote. Reply with only "QUALYS" or "OTHER".',
        messages:[{role:'user',content:[
          {type:'document',source:{type:'base64',media_type:'application/pdf',data:pdf}},
          {type:'text',text:'Is this a Qualys Inc quotation? Reply QUALYS or OTHER only.'}
        ]}]
      })
    });
    const detectData=await detectRes.json();
    const detectText=(detectData.content||[]).map(c=>c.text||'').join('').trim().toUpperCase();

    if(detectText.includes('QUALYS')){
      // Extract full text then parse structurally
      const textRes=await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},
        body:JSON.stringify({
          model:'claude-opus-4-6',max_tokens:4000,
          system:'Extract all text from this PDF exactly as it appears, preserving line breaks and structure. Include all numbers, labels, and values.',
          messages:[{role:'user',content:[
            {type:'document',source:{type:'base64',media_type:'application/pdf',data:pdf}},
            {type:'text',text:'Extract all text content preserving structure and line breaks.'}
          ]}]
        })
      });
      const textData=await textRes.json();
      const extractedText=(textData.content||[]).map(c=>c.text||'').join('');
      const result=parseQualys(extractedText);
      if(result.lineItems&&result.lineItems.length>0){
        return res.status(200).json(result);
      }
      // Fall through to AI if structural parse got nothing
    }
  }

  const instr='Return ONLY this JSON (no commentary):\n{"quote_expire_date":"","to":{"company":"","name":"","email":""},"for":{"company":"","name":"","email":""},"header_start_date":"","header_end_date":"","lineItems":[{"sku":"","description":"","qty":1,"unit_price":0,"start_date":"","end_date":""}]}\nRules:\n- to=reseller/TekStream, for=end customer\n- unit_price=distributor/net price per UNIT (divide total by qty)\n- All dates YYYY-MM-DD\n- quote_expire_date=quote validity/expiry from header if present else ""\n- header_start_date/header_end_date=document-level start/end dates else ""\n- Exclude discount lines\n- Line item dates: use line-level if present, else header dates, else leave ""';
  const content=pdf
    ?[{type:'document',source:{type:'base64',media_type:'application/pdf',data:pdf}},{type:'text',text:instr}]
    :[{type:'text',text:instr+'\n\n'+txt}];
  const r=await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},
    body:JSON.stringify({model:'claude-opus-4-6',max_tokens:2000,system:'Extract VAD distributor quote data. Return ONLY valid JSON, no commentary.',messages:[{role:'user',content}]})
  });
  const d=await r.json();
  if(d.error)return res.status(500).json({error:d.error.message});
  const t=(d.content||[]).map(c=>c.text||'').join('');
  const s=t.indexOf('{'),e=t.lastIndexOf('}');
  if(s===-1)return res.status(500).json({error:'No JSON in response'});
  const result=JSON.parse(t.slice(s,e+1));
  if(vad)result.vad=vad;
  if(result.lineItems)result.lineItems=applyDates(result.lineItems,result.header_start_date||'',result.header_end_date||'',result.quote_expire_date||'');
  return res.status(200).json(result);
}

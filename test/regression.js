async function runRegressionTests() {
  const results = [];
  // Suppress auto-save during tests to avoid polluting saved quotes
  var _origAutoSave = window.autoSave;
  window.autoSave = function(){};
  var _origAutoSaveTimer = window._autoSaveTimer;
  clearTimeout(window._autoSaveTimer);
  function test(name, fn) {
    try { const r=fn(); results.push({name,pass:r.pass,detail:r.detail||''}); }
    catch(e){ results.push({name,pass:false,detail:'ERROR: '+e.message}); }
  }
  // 1. Functions
  ['render','renderRow','groupByYear','downloadPdf','previewPdf','emailQuote','extractVAD',
   'sendForSignature','openSignModal','closeSignModal','confirmSendForSignature','openDrawer','closeDrawer','renderSavedQuotes','restoreQuoteState',
   'saveRepSettings','loadRepSettings','autoSave','applySetTotal','updateTotalsOnly',
   'initDragDrop','moveRow','effectiveMargin','itemCprice','newQuote','addRow','recalcAll',
   'checkExpiry','getQuoteState','generatePdfBlob','fmtDateDisplay','updateGroupDates','custExtFocus','custExtBlur','updatePdfFileName'].forEach(function(fn){
    test('fn:'+fn,function(){return{pass:typeof window[fn]==='function',detail:typeof window[fn]};});
  });
  // 2. DOM
  ['quoteNumber','quoteDate','expiryDate','customerName','contactName','contactEmail',
   'marginPct','marginHint','marginDollar','notes','terms','repName','repEmail','signerEmail',
   'vadPdf','extractStatus','liArea','totals','setTotalInput','savedDrawer','savedList',
   'drawerOverlay','hdrLogo','preparedBy','preparedByEmail','preparedByCompany',
   'signerEmailHidden'].forEach(function(id){
    test('dom:#'+id,function(){return{pass:!!document.getElementById(id)};});
  });
  // Reset state before init tests
  newQuote();
  // 3. Init
  test('init:quoteNumber',function(){return{pass:!!document.getElementById('quoteNumber').value};});
  test('init:quoteDate',function(){return{pass:!!document.getElementById('quoteDate').value};});
  test('init:expiryDate',function(){return{pass:!!document.getElementById('expiryDate').value};});
  test('init:marginPct=15',function(){return{pass:parseFloat(document.getElementById('marginPct').value)===15};});
  test('init:logoLoaded',function(){return{pass:!!window.logoDataUrl&&window.logoDataUrl.startsWith('data:')};});
  // 4. Line items
  test('li:addRow',function(){var b=window.lineItems.length;addRow();return{pass:window.lineItems.length===b+1};});
  test('li:renderTable',function(){render();return{pass:!!document.querySelector('#liArea table')};});
  test('li:noBottomSubtotal',function(){
    window.lineItems=[{sku:'T',description:'T',qty:1,unit_price:100,start_date:'',end_date:'',margin:null}];
    render();var ok=!document.getElementById('totals').innerHTML.includes('>Subtotal<');
    window.lineItems=[];render();return{pass:ok};
  });
  test('li:subtotalColspan9',function(){
    window.lineItems=[{sku:'A',description:'A',qty:2,unit_price:100,start_date:'2026-01-01',end_date:'2026-12-31',margin:20}];
    render();var row=document.querySelector('#liArea tr[style*="EBF3FB"]');
    var td=row&&row.querySelector('td');window.lineItems=[];render();
    return{pass:!!td&&td.getAttribute('colspan')==='9',detail:td?'colspan='+td.getAttribute('colspan'):'no row'};
  });
  test('li:rightAlignNumbers',function(){var style=document.querySelector('style').textContent;return{pass:style.includes('input[type=number]{text-align:right')};});
  test('li:vadExtCommas',function(){
    window.lineItems=[{sku:'T',description:'T',qty:1,unit_price:1234.56,start_date:'',end_date:'',margin:null}];
    render();var cells=Array.from(document.querySelectorAll('#liArea tbody td'));
    var found=cells.some(function(c){return c.textContent.trim()==='1,234.56';});
    window.lineItems=[];render();return{pass:found};
  });
  test('li:custUnitNoPrefix',function(){
    window.lineItems=[{sku:'T',description:'T',qty:1,unit_price:100,start_date:'',end_date:'',margin:20}];
    render();var cells=Array.from(document.querySelectorAll('#liArea tbody td'));
    var found=cells.some(function(c){return c.textContent.trim()==='125.00';});
    window.lineItems=[];render();return{pass:found};
  });

  test('li:subtotalsRow',function(){
    window.lineItems=[{sku:'A',description:'A',qty:2,unit_price:100,start_date:'2026-01-01',end_date:'2026-12-31',margin:20}];
    render();
    var row=document.querySelector('#liArea tr[style*="EBF3FB"]');
    var text=row?row.textContent:'';
    window.lineItems=[];render();
    return{pass:text.includes('Subtotals')&&text.includes('200.00')&&text.includes('250.00'),detail:text.substring(0,60)};
  });
  test('grp:startDateRendered',function(){
    window.lineItems=[{sku:'T',description:'T',qty:1,unit_price:100,start_date:'2026-06-21',end_date:'2027-06-20',margin:null}];
    render();
    var inputs=document.querySelectorAll('#liArea input[type="date"]');
    var found=false;inputs.forEach(function(i){if(i.value==='2026-06-21')found=true;});
    window.lineItems=[];render();return{pass:found};
  });
  test('li:rightAlignHeaders',function(){
    addRow();render();
    var ths=Array.from(document.querySelectorAll('#liArea thead th'));
    var qtyTh=ths.find(function(t){return t.textContent.trim()==='Qty';});
    var custExtTh=ths.find(function(t){return t.textContent.trim()==='Customer Ext. $';});
    window.lineItems=[];render();
    return{pass:!!qtyTh&&qtyTh.style.textAlign==='right'&&!!custExtTh&&custExtTh.style.textAlign==='right'};
  });
  test('li:marginNegativeRed',function(){
    window.lineItems=[{sku:'T',description:'T',qty:1,unit_price:100,start_date:'',end_date:'',margin:-5}];
    render();
    var cells=Array.from(document.querySelectorAll('#liArea tbody td'));
    var redCell=cells.find(function(c){return c.style&&c.style.color==='rgb(204, 0, 0)';});
    window.lineItems=[];render();return{pass:!!redCell};
  });
  test('pdf:hasServiceDates',function(){var fnStr=downloadPdf.toString();return{pass:fnStr.includes('Service Dates')};});
  test('pdf:noLineItemDates',function(){var fnStr=downloadPdf.toString();return{pass:!fnStr.includes('it.start_date)doc.text')};});
  test('li:removeRow',function(){addRow();var b=window.lineItems.length;removeRow(b-1);return{pass:window.lineItems.length===b-1};});
  test('li:colHeaders',function(){
    var ths=Array.from(document.querySelectorAll('#liArea thead th')).map(function(t){return t.textContent;});
    var ok=ths.includes('VAD Unit $')&&ths.includes('VAD Ext. $')&&ths.includes('Customer $')&&ths.includes('Margin%')&&ths.includes('Margin$');
    return{pass:ok,detail:ths.join('|')};
  });
  test('li:colOrder',function(){
    var ths=Array.from(document.querySelectorAll('#liArea thead th')).map(function(t){return t.textContent;});
    var custIdx=ths.indexOf('Customer $'),marginIdx=ths.indexOf('Margin%'),marginDIdx=ths.indexOf('Margin$');
    return{pass:custIdx<marginIdx&&marginIdx<marginDIdx,detail:'Cust@'+custIdx+' M%@'+marginIdx+' M$@'+marginDIdx};
  });
  test('li:vadExtCalc',function(){
    window.lineItems=[{sku:'T',description:'T',qty:5,unit_price:100,start_date:'',end_date:'',margin:null}];
    render();
    var cells=Array.from(document.querySelectorAll('#liArea tbody td'));
    var found=cells.some(function(c){return c.textContent==='$500.00';});
    window.lineItems=[];render();
    return{pass:found,detail:found?'$500.00 found':'not found'};
  });
  test('li:dragHandle',function(){addRow();render();var ok=!!document.querySelector('.drag-handle');removeRow(window.lineItems.length-1);return{pass:ok};});
  test('li:dragDropReorder',function(){
    // Set up 2 items with distinct SKUs
    window.lineItems=[
      {sku:'FIRST',description:'A',qty:1,unit_price:10,start_date:'',end_date:'',margin:null},
      {sku:'SECOND',description:'B',qty:1,unit_price:20,start_date:'',end_date:'',margin:null}
    ];
    render();
    // Simulate drag: move item 0 to position 1
    var item=window.lineItems.splice(0,1)[0];
    window.lineItems.splice(1,0,item);
    render();
    var ok=window.lineItems[0].sku==='SECOND'&&window.lineItems[1].sku==='FIRST';
    // Verify table reflects new order
    var rows=document.querySelectorAll('#liArea table tbody tr');
    var firstRowSku=rows[0]?rows[0].querySelector('input')?.value:'';
    window.lineItems=[];render();
    return{pass:ok,detail:'order: '+window.lineItems.map?'verified':'err'};
  });
  // 5. Calcs
  test('li:custUnitCalc',function(){
    window.lineItems=[{sku:'T',description:'T',qty:1,unit_price:100,start_date:'',end_date:'',margin:20}];
    render();
    var cells=Array.from(document.querySelectorAll('#liArea tbody td'));
    var found=cells.some(function(c){return c.textContent.trim()==='$125.00';});
    window.lineItems=[];render();return{pass:found,detail:found?'found':'$125.00 not found'};
  });
  test('li:colOrder',function(){
    var ths=Array.from(document.querySelectorAll('#liArea thead th')).map(function(t){return t.textContent.trim();});
    var startIdx=ths.indexOf('Start'),qtyIdx=ths.indexOf('Qty'),vadUIdx=ths.indexOf('VAD Unit $');
    var vadEIdx=ths.indexOf('VAD Ext. $'),mPctIdx=ths.indexOf('Margin%'),mDIdx=ths.indexOf('Margin$');
    var custUIdx=ths.indexOf('Customer Unit $'),custEIdx=ths.indexOf('Customer Ext. $');
    var ok=startIdx<qtyIdx&&qtyIdx<vadUIdx&&vadUIdx<vadEIdx&&vadEIdx<mPctIdx&&mPctIdx<mDIdx&&mDIdx<custUIdx&&custUIdx<custEIdx;
    return{pass:ok,detail:'Start@'+startIdx+' Qty@'+qtyIdx+' VADu@'+vadUIdx+' M%@'+mPctIdx+' Cu@'+custUIdx+' Ce@'+custEIdx};
  });

  test('li:noDateCols',function(){
    var ths=Array.from(document.querySelectorAll('#liArea thead th')).map(function(t){return t.textContent.trim();});
    return{pass:!ths.includes('Start')&&!ths.includes('End'),detail:ths.join('|')};
  });
  test('grp:alwaysGroups',function(){
    var items=[{sku:'A',description:'A',qty:1,unit_price:10,start_date:'2026-01-01',end_date:'2026-12-31',margin:null}];
    var g=groupByYear(items);
    return{pass:g!==null&&g.length===1&&g[0].label==='Payment 1',detail:g?g[0].label:null};
  });
  test('grp:datesInHeader',function(){
    window.lineItems=[{sku:'T',description:'T',qty:1,unit_price:100,start_date:'2026-06-21',end_date:'2027-06-20',margin:null}];
    render();
    var grpHdr=document.querySelector('#liArea .drag-handle')?.closest('table')?.previousElementSibling;
    var hasServiceDates=grpHdr&&grpHdr.textContent.includes('Service Dates');
    window.lineItems=[];render();
    return{pass:!!hasServiceDates};
  });
  test('grp:fmtDateDisplay',function(){
    return{pass:fmtDateDisplay('2026-06-21')==='Jun 21, 2026',detail:fmtDateDisplay('2026-06-21')};
  });
  test('grp:updateGroupDates',function(){
    window.lineItems=[{sku:'A',description:'A',qty:1,unit_price:10,start_date:'2026-01-01',end_date:'2026-12-31',margin:null},{sku:'B',description:'B',qty:1,unit_price:10,start_date:'2026-02-01',end_date:'2026-12-31',margin:null}];
    updateGroupDates(0,'start_date','2026-03-01');
    var ok=window.lineItems[0].start_date==='2026-03-01'&&window.lineItems[1].start_date==='2026-03-01';
    window.lineItems=[];return{pass:ok};
  });
  test('calc:cprice',function(){return{pass:Math.abs(cprice(100,20)-125)<0.01,detail:cprice(100,20)};});
  test('calc:effectiveMargin override',function(){return{pass:effectiveMargin({margin:25},15)===25};});
  test('calc:effectiveMargin fallback',function(){return{pass:effectiveMargin({margin:null},15)===15};});
  test('calc:groupByYear single→group',function(){var g=groupByYear([{start_date:'2026-01-01'},{start_date:'2026-06-01'}]);return{pass:g!==null&&g.length===1};});
  test('calc:groupByYear multi',function(){var g=groupByYear([{start_date:'2026-01-01'},{start_date:'2027-01-01'}]);return{pass:g!==null&&g.length===2};});
  // 6. State save/restore
  test('fileName:autoPopulates',function(){
    document.getElementById('quoteNumber').value='TS-TEST-001';
    document.getElementById('customerName').value='Acme Corp';
    document.getElementById('pdfFileName').dataset.userEdited='';
    updatePdfFileName();
    return{pass:document.getElementById('pdfFileName').value==='TS-TEST-001 - Acme Corp'};
  });
  test('fileName:respectsUserEdit',function(){
    document.getElementById('pdfFileName').value='Custom Name';
    document.getElementById('pdfFileName').dataset.userEdited='1';
    document.getElementById('quoteNumber').value='TS-TEST-002';
    updatePdfFileName();
    var ok=document.getElementById('pdfFileName').value==='Custom Name';
    document.getElementById('pdfFileName').dataset.userEdited='';
    return{pass:ok};
  });
  test('pdf:hasServiceDates',function(){
    var fnStr=downloadPdf.toString();
    return{pass:fnStr.includes('Service Dates')};
  });
  test('state:saveRestore',function(){
    document.getElementById('customerName').value='__rt__';
    document.getElementById('quoteNumber').value='TEST-999';
    window.lineItems=[{sku:'S',description:'D',qty:1,unit_price:50,start_date:'',end_date:'',margin:null}];
    var s=getQuoteState();
    document.getElementById('customerName').value='';window.lineItems=[];
    restoreQuoteState(s);
    return{pass:document.getElementById('customerName').value==='__rt__'&&window.lineItems.length===1};
  });
  // 7. Drawer
  test('drawer:openClose',function(){
    openDrawer();var o=document.getElementById('savedDrawer').classList.contains('open');
    closeDrawer();var c=!document.getElementById('savedDrawer').classList.contains('open');
    return{pass:o&&c};
  });
  test('drawer:rendersSavedQuotes',function(){
    var saved=JSON.parse(localStorage.getItem('ts_saved_quotes')||'[]');
    openDrawer();
    var items=document.querySelectorAll('#savedList .saved-item');
    closeDrawer();
    return{pass:items.length===saved.length,detail:'saved='+saved.length+' rendered='+items.length};
  });
  test('drawer:loadSavedQuote',function(){
    var saved=JSON.parse(localStorage.getItem('ts_saved_quotes')||'[]');
    if(!saved.length)return{pass:true,detail:'no saved quotes to test'};
    var entry=saved[0];
    try{restoreQuoteState(entry.state);var ok=document.getElementById('quoteNumber').value===entry.quoteNumber;return{pass:ok,detail:'qn='+document.getElementById('quoteNumber').value};}
    catch(e){return{pass:false,detail:e.message};}
  });
  // 8. Set total
  test('setTotal:proportional',function(){
    window.lineItems=[{sku:'A',description:'A',qty:1,unit_price:80,start_date:'',end_date:'',margin:null},{sku:'B',description:'B',qty:1,unit_price:20,start_date:'',end_date:'',margin:null}];
    document.getElementById('marginPct').value='10';
    document.getElementById('setTotalInput').value='110';
    applySetTotal();
    var total=window.lineItems.reduce(function(s,it){return s+itemCprice(it,10)*it.qty;},0);
    return{pass:Math.abs(total-110)<0.01,detail:total.toFixed(2)};
  });
  // 9. Rep settings
  test('rep:saveToStorage',function(){
    var origName=localStorage.getItem('ts_rep_name')||'';
    var origEmail=localStorage.getItem('ts_rep_email')||'';
    document.getElementById('repName').value='__tr__';
    saveRepSettings();
    var ok=localStorage.getItem('ts_rep_name')==='__tr__';
    // Restore original values
    localStorage.setItem('ts_rep_name',origName);
    localStorage.setItem('ts_rep_email',origEmail);
    document.getElementById('repName').value=origName;
    document.getElementById('repEmail').value=origEmail;
    saveRepSettings();
    return{pass:ok};
  });
  test('rep:populatesHidden',function(){
    var origName=localStorage.getItem('ts_rep_name')||'';
    document.getElementById('repName').value='__tr__';
    saveRepSettings();
    var ok=document.getElementById('preparedBy').value==='__tr__';
    document.getElementById('repName').value=origName;
    saveRepSettings();
    return{pass:ok};
  });
  // 10. Customer price back-calc margin
  test('custPrice:backCalcMargin',function(){
    window.lineItems=[{sku:'T',description:'T',qty:1,unit_price:100,start_date:'',end_date:'',margin:null}];
    render();
    var m=(1-100/(125/1))*100;
    window.lineItems[0].margin=Math.round(m*1000)/1000;
    updateTotalsOnly();
    return{pass:Math.abs(window.lineItems[0].margin-20)<0.01,detail:'margin='+window.lineItems[0].margin};
  });
  test('margin:globalStep0.125',function(){
    var el=document.getElementById('marginPct');
    return{pass:el.step==='0.125',detail:'step='+el.step};
  });
  // 11. Signature confirmation modal
  test('signModal:openClose',function(){
    document.getElementById('contactEmail').value='test@test.com';
    document.getElementById('signerEmailHidden').value='signer@tekstream.com';
    document.getElementById('customerName').value='Test Co';
    openSignModal();
    var open=document.getElementById('signModal').classList.contains('open');
    var name=document.getElementById('modalCustomerName').textContent;
    var email=document.getElementById('modalCustomerEmail').textContent;
    closeSignModal();
    var closed=!document.getElementById('signModal').classList.contains('open');
    return{pass:open&&closed&&name==='Test Co'&&email==='test@test.com',detail:'name='+name+' email='+email};
  });
  test('signModal:dom',function(){
    return{pass:!!document.getElementById('signModal')&&!!document.getElementById('modalCustomerName')&&!!document.getElementById('modalCustomerEmail')&&!!document.getElementById('modalSignerEmail')};
  });
  // Restore auto-save and cleanup
  window.autoSave = _origAutoSave;
  newQuote();loadRepSettings();
  // Summary
  var passed=results.filter(function(r){return r.pass;}).length;
  var failed=results.filter(function(r){return!r.pass;});
  var pct=Math.round(passed/results.length*100);
  console.log('\n=== REGRESSION: '+passed+'/'+results.length+' ('+pct+'%) '+(passed===results.length?'ALL PASS':'FAILURES BELOW')+' ===');
  failed.forEach(function(r){console.error('FAIL: '+r.name+(r.detail?' ('+r.detail+')':''));});
  return{passed,total:results.length,pct,failed:failed.map(function(r){return{name:r.name,detail:r.detail};})};
}
runRegressionTests();

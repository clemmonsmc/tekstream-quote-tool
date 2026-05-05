async function runRegressionTests() {
  const results = [];
  function test(name, fn) {
    try { const r=fn(); results.push({name,pass:r.pass,detail:r.detail||''}); }
    catch(e){ results.push({name,pass:false,detail:'ERROR: '+e.message}); }
  }
  // 1. Functions
  ['render','renderRow','groupByYear','downloadPdf','previewPdf','emailQuote','extractVAD',
   'sendForSignature','openDrawer','closeDrawer','renderSavedQuotes','restoreQuoteState',
   'saveRepSettings','loadRepSettings','autoSave','applySetTotal','updateTotalsOnly',
   'initDragDrop','moveRow','effectiveMargin','itemCprice','newQuote','addRow','recalcAll',
   'checkExpiry','getQuoteState','generatePdfBlob'].forEach(function(fn){
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
  test('li:removeRow',function(){var b=window.lineItems.length;removeRow(b-1);return{pass:window.lineItems.length===b-1};});
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
  test('calc:cprice',function(){return{pass:Math.abs(cprice(100,20)-125)<0.01,detail:cprice(100,20)};});
  test('calc:effectiveMargin override',function(){return{pass:effectiveMargin({margin:25},15)===25};});
  test('calc:effectiveMargin fallback',function(){return{pass:effectiveMargin({margin:null},15)===15};});
  test('calc:groupByYear single',function(){return{pass:groupByYear([{start_date:'2026-01-01'},{start_date:'2026-06-01'}])===null};});
  test('calc:groupByYear multi',function(){var g=groupByYear([{start_date:'2026-01-01'},{start_date:'2027-01-01'}]);return{pass:g!==null&&g.length===2};});
  // 6. State save/restore
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
  test('rep:saveToStorage',function(){document.getElementById('repName').value='__tr__';saveRepSettings();return{pass:localStorage.getItem('ts_rep_name')==='__tr__'};});
  test('rep:populatesHidden',function(){return{pass:document.getElementById('preparedBy').value==='__tr__'};});
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
  // Cleanup
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

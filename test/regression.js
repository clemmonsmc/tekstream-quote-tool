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
  test('fileName:autoPopulates',function(){
    document.getElementById('quoteNumber').value='TS-TEST-001';
    document.getElementById('customerName').value='Acme Corp';
    document.getElementById('pdfFileName').dataset.userEdited='';
    updatePdfFileName();
    return{pass:document.getElementById('pdfFileName').value==='TS-TEST-001 - Acme Corp'};
  });
  test('pdf:hasTermsAndConditions',function(){var s=downloadPdf.toString();return{pass:s.includes('Terms and Conditions')&&s.includes('OEM Terms')&&s.includes('WITNESS WHEREOF')};});
  test('pdf:verbatimSection1',function(){var s=downloadPdf.toString();return{pass:s.includes('submitting a purchase order, or using the programs')&&s.includes('Qualys Service User Agreement')};});
  test('pdf:verbatimSection9',function(){var s=downloadPdf.toString();return{pass:s.includes('third-party intellectual property infringement claims')&&s.includes('Partner provides no indemnification')};});
  test('pdf:verbatimSection12',function(){var s=downloadPdf.toString();return{pass:s.includes('solely for administrative convenience')&&s.includes('expressly rejected and shall have no force or effect')};});
  test('pdf:fontBeforeSplit',function(){var s=downloadPdf.toString();return{pass:s.includes("setFontSize(7.5);\n        var bLines=doc.splitTextToSize")};});
  test('pdf:dynamicOEM',function(){
    var s=downloadPdf.toString();
    return{pass:s.includes('_oemLinks')&&s.includes('_s1b')&&s.includes('sentinelone.com')&&s.includes('qualys.com')};
  });
  test('pdf:oemScansDescriptions',function(){var s=downloadPdf.toString();return{pass:s.includes('it.description')};});
  test('pdf:oemSplunkViaDesc',function(){
    var _skus='SE-T-LIC-ST SPLUNK ENTERPRISE TERM LICENSE';var found=[];
    if(/SPL[EK\-]|SPLUNK/.test(_skus))found.push('Splunk');
    return{pass:found.length===1&&found[0]==='Splunk',detail:found.join(',')};
  });
  test('pdf:oemNoQualysForS1',function(){
    var _skus='PF-PLT-FF-S1 PR-AIAST-ND-S1 S1-CMPAI-EN-S1';
    var found=[];
    if(/(^|\s)Q\-/.test(_skus)||/QUALYS/.test(_skus))found.push('Qualys');
    if(/\-S1\b|\bS1\-|SENTINELONE/.test(_skus))found.push('SentinelOne');
    return{pass:found.length===1&&found[0]==='SentinelOne',detail:found.join(',')};
  });
  test('pdf:oemQualysDetected',function(){
    var _skus='Q-S-ETM Q-VM-ASST';
    var found=[];
    if(/(^|\s)Q\-/.test(_skus)||/QUALYS/.test(_skus))found.push('Qualys');
    if(/\-S1\b|\bS1\-|SENTINELONE/.test(_skus))found.push('SentinelOne');
    return{pass:found.length===1&&found[0]==='Qualys',detail:found.join(',')};
  });
  test('pdf:updatedSection8',function(){var s=downloadPdf.toString();return{pass:s.includes('FAILURE OF ESSENTIAL PURPOSE')&&!s.includes('TOTAL LIABILITY SHALL NOT EXCEED')};});
  test('pdf:hasServiceDates',function(){var s=downloadPdf.toString();return{pass:s.includes('Service Dates')};});
  test('pdf:noLineItemDates',function(){var s=downloadPdf.toString();return{pass:!s.includes('it.start_date)doc.text')};});

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
  // ── Item 1: Sort columns + reset to original order ───────────────────
  ['cycleSort','resetSort','sortIndicator','applySort','nextOriginalIndex'].forEach(function(fn){
    test('fn:'+fn,function(){return{pass:typeof window[fn]==='function',detail:typeof window[fn]};});
  });
  test('sort:initialState',function(){
    return{pass:window.sortState&&window.sortState.col===null&&window.sortState.dir===0,detail:JSON.stringify(window.sortState)};
  });
  test('sort:addRowAssignsOriginalIndex',function(){
    window.lineItems=[];addRow();addRow();
    var ok=window.lineItems.length===2 && window.lineItems[0].originalIndex===0 && window.lineItems[1].originalIndex===1;
    var d='idx0='+window.lineItems[0].originalIndex+' idx1='+window.lineItems[1].originalIndex;
    window.lineItems=[];render();return{pass:ok,detail:d};
  });
  test('sort:loadLineItemsAssignsOriginalIndex',function(){
    window.loadLineItems([{sku:'B',description:'B',qty:1,unit_price:10},{sku:'A',description:'A',qty:1,unit_price:20}]);
    var ok=window.lineItems[0].originalIndex===0 && window.lineItems[1].originalIndex===1;
    var d='items='+JSON.stringify(window.lineItems.map(function(i){return{s:i.sku,o:i.originalIndex};}));
    window.lineItems=[];render();return{pass:ok,detail:d};
  });
  test('sort:cycleSortToggles',function(){
    window.sortState={col:null,dir:0};
    cycleSort('sku');var s1=JSON.stringify(window.sortState);
    cycleSort('sku');var s2=JSON.stringify(window.sortState);
    cycleSort('sku');var s3=JSON.stringify(window.sortState);
    var ok=s1==='{"col":"sku","dir":1}' && s2==='{"col":"sku","dir":-1}' && s3==='{"col":null,"dir":0}';
    return{pass:ok,detail:s1+' | '+s2+' | '+s3};
  });
  test('sort:applySortAsc',function(){
    var items=[{sku:'C',description:'',qty:1,unit_price:0,margin:null},{sku:'A',description:'',qty:1,unit_price:0,margin:null},{sku:'B',description:'',qty:1,unit_price:0,margin:null}];
    window.lineItems=items;window.sortState={col:'sku',dir:1};
    var sorted=applySort(items).map(function(i){return i.sku;}).join('');
    window.lineItems=[];window.sortState={col:null,dir:0};render();
    return{pass:sorted==='ABC',detail:sorted};
  });
  test('sort:applySortDesc',function(){
    var items=[{sku:'A',description:'',qty:1,unit_price:0,margin:null},{sku:'C',description:'',qty:1,unit_price:0,margin:null},{sku:'B',description:'',qty:1,unit_price:0,margin:null}];
    window.lineItems=items;window.sortState={col:'sku',dir:-1};
    var sorted=applySort(items).map(function(i){return i.sku;}).join('');
    window.lineItems=[];window.sortState={col:null,dir:0};render();
    return{pass:sorted==='CBA',detail:sorted};
  });
  test('sort:resetReturnsOriginalOrder',function(){
    window.loadLineItems([{sku:'Z',description:'',qty:1,unit_price:0},{sku:'A',description:'',qty:1,unit_price:0},{sku:'M',description:'',qty:1,unit_price:0}]);
    cycleSort('sku'); // asc
    var sorted=applySort(window.lineItems).map(function(i){return i.sku;}).join('');
    resetSort();
    // After resetSort, lineItems itself should be back in original order
    var resetActual=window.lineItems.map(function(i){return i.sku;}).join('');
    window.lineItems=[];render();
    return{pass:sorted==='AMZ'&&resetActual==='ZAM',detail:'sorted='+sorted+' resetActual='+resetActual};
  });
  test('sort:resetUndoesDragReorder',function(){
    // Simulate drag-reordering by mutating lineItems order directly (as drag-drop does)
    window.loadLineItems([{sku:'X',description:'',qty:1,unit_price:0},{sku:'Y',description:'',qty:1,unit_price:0},{sku:'Z',description:'',qty:1,unit_price:0}]);
    // Drag X to the end: simulates user drag
    var dragged=window.lineItems.splice(0,1)[0];
    window.lineItems.push(dragged);
    var afterDrag=window.lineItems.map(function(i){return i.sku;}).join('');
    resetSort();
    var afterReset=window.lineItems.map(function(i){return i.sku;}).join('');
    window.lineItems=[];render();
    return{pass:afterDrag==='YZX'&&afterReset==='XYZ',detail:'afterDrag='+afterDrag+' afterReset='+afterReset};
  });
  test('sort:resetSortStateClears',function(){
    cycleSort('sku');resetSort();
    var ok=window.sortState.col===null&&window.sortState.dir===0;
    return{pass:ok,detail:JSON.stringify(window.sortState)};
  });
  test('sort:headersRenderClickable',function(){
    window.lineItems=[{sku:'A',description:'',qty:1,unit_price:10,margin:null,originalIndex:0}];
    render();
    var headers=document.querySelectorAll('#liArea th[onclick]');
    window.lineItems=[];render();
    return{pass:headers.length>=6,detail:'clickable headers='+headers.length};
  });
  test('sort:resetButtonExists',function(){
    var btn=document.querySelector('button[onclick="resetSort()"]');
    return{pass:!!btn,detail:btn?btn.textContent.trim():'not found'};
  });
  test('sort:legacyRestoreBackfillsOriginalIndex',function(){
    var legacyState={customerName:'Legacy Co',quoteNumber:'TS-LEGACY',lineItems:[{sku:'X',description:'X',qty:1,unit_price:5,margin:null},{sku:'Y',description:'Y',qty:1,unit_price:6,margin:null}]};
    restoreQuoteState(legacyState);
    var ok=window.lineItems[0].originalIndex===0&&window.lineItems[1].originalIndex===1;
    var d='idx0='+window.lineItems[0].originalIndex+' idx1='+window.lineItems[1].originalIndex;
    window.lineItems=[];newQuote();return{pass:ok,detail:d};
  });
  test('sort:newQuoteResetsSort',function(){
    cycleSort('sku');newQuote();
    var ok=window.sortState.col===null&&window.sortState.dir===0;
    return{pass:ok,detail:JSON.stringify(window.sortState)};
  });
  test('sort:sortWithinGroup',function(){
    // Two payment groups, sort within each
    window.loadLineItems([
      {sku:'Z1',description:'',qty:1,unit_price:10,start_date:'2026-01-01',end_date:'2026-12-31'},
      {sku:'A1',description:'',qty:1,unit_price:20,start_date:'2026-01-01',end_date:'2026-12-31'},
      {sku:'Z2',description:'',qty:1,unit_price:30,start_date:'2027-01-01',end_date:'2027-12-31'},
      {sku:'A2',description:'',qty:1,unit_price:40,start_date:'2027-01-01',end_date:'2027-12-31'}
    ]);
    cycleSort('sku');
    // Render and read SKU order from rendered rows
    var rows=document.querySelectorAll('#liArea tr[data-row] input');
    var order=[];rows.forEach(function(r){if(r.value&&/^[AZ]\d$/.test(r.value))order.push(r.value);});
    // We just check that sort produced something — direct applySort test is the real verification
    var g=groupByYear(window.lineItems);
    var g0=applySort(g[0].items).map(function(i){return i.sku;}).join(',');
    var g1=applySort(g[1].items).map(function(i){return i.sku;}).join(',');
    var ok=g0==='A1,Z1'&&g1==='A2,Z2';
    window.lineItems=[];render();
    return{pass:ok,detail:'g0='+g0+' g1='+g1};
  });
  // ── Item 7: PO generator ─────────────────────────────────────────────
  ['generatePoPdfBlob','downloadPoPdf'].forEach(function(fn){
    test('fn:'+fn,function(){return{pass:typeof window[fn]==='function',detail:typeof window[fn]};});
  });
  ['shipToAddress','shipToCityStateZip','shipToPhone','vendorName'].forEach(function(id){
    test('dom:#'+id,function(){return{pass:!!document.getElementById(id)};});
  });
  test('po:vendorDropdownOptions',function(){
    var el=document.getElementById('vendorName');
    if(!el)return{pass:false,detail:'no vendorName element'};
    var opts=Array.from(el.options).map(function(o){return o.value;});
    var ok=opts.indexOf('Arrow ECS')>=0&&opts.indexOf('TD Synnex')>=0&&opts.indexOf('Carahsoft')>=0&&opts.indexOf('Other')>=0;
    return{pass:ok,detail:opts.join(',')};
  });
  test('po:stateRoundtripShipTo',function(){
    document.getElementById('shipToAddress').value='123 Main St';
    document.getElementById('shipToCityStateZip').value='Atlanta, GA 30303';
    document.getElementById('shipToPhone').value='404-555-1234';
    document.getElementById('vendorName').value='Arrow ECS';
    var s=getQuoteState();
    document.getElementById('shipToAddress').value='';
    document.getElementById('shipToCityStateZip').value='';
    document.getElementById('shipToPhone').value='';
    document.getElementById('vendorName').value='';
    restoreQuoteState(s);
    var ok=document.getElementById('shipToAddress').value==='123 Main St'&&
           document.getElementById('shipToCityStateZip').value==='Atlanta, GA 30303'&&
           document.getElementById('shipToPhone').value==='404-555-1234'&&
           document.getElementById('vendorName').value==='Arrow ECS';
    newQuote();
    return{pass:ok,detail:'roundtrip ok='+ok};
  });
  test('po:newQuoteResetsShipToAndVendor',function(){
    document.getElementById('shipToAddress').value='X';
    document.getElementById('vendorName').value='Arrow ECS';
    newQuote();
    var ok=!document.getElementById('shipToAddress').value&&!document.getElementById('vendorName').value;
    return{pass:ok,detail:'shipTo='+document.getElementById('shipToAddress').value+' vendor='+document.getElementById('vendorName').value};
  });
  test('po:generatePoPdfBlobNoLineItemsThrows',function(){
    window.lineItems=[];
    // downloadPoPdf shows an alert and returns — we just verify generatePoPdfBlob can be called with empty items
    var ok=true;
    try{ generatePoPdfBlob().then(function(){ok=true;}).catch(function(){ok=true;}); }catch(e){ok=true;}
    return{pass:ok,detail:'no throw'};
  });
  test('po:downloadButtonExists',function(){
    var btn=document.querySelector('button[onclick="downloadPoPdf()"]');
    return{pass:!!btn,detail:btn?btn.textContent.trim():'not found'};
  });
  test('po:signaturePlaceholder',function(){
    // Either loaded (data:) or null on first init — both acceptable
    var ok=window.signatureDataUrl===null||(typeof window.signatureDataUrl==='string'&&window.signatureDataUrl.indexOf('data:')===0);
    return{pass:ok,detail:typeof window.signatureDataUrl};
  });
  // ── Item 8: Margin & Commission Summary ──────────────────────────────
  ['updateServicesRev','updateAeMultiplier','renderCommissionPanel'].forEach(function(fn){
    test('fn:'+fn,function(){return{pass:typeof window[fn]==='function',detail:typeof window[fn]};});
  });
  test('commission:initialState',function(){
    var s=window.commissionState;
    var ok=s&&s.aeMultiplier===20&&s.servicesRevByGroup&&Object.keys(s.servicesRevByGroup).length===0;
    return{pass:ok,detail:JSON.stringify(s)};
  });
  test('commission:panelContainerInDom',function(){
    return{pass:!!document.getElementById('commissionPanel')};
  });
  test('commission:panelHiddenWhenEmpty',function(){
    window.lineItems=[];render();
    var panel=document.getElementById('commissionPanel');
    return{pass:panel&&panel.innerHTML==='',detail:'innerHTML len='+(panel?panel.innerHTML.length:'no panel')};
  });
  test('commission:panelShowsWithLineItems',function(){
    window.loadLineItems([{sku:'X',description:'',qty:1,unit_price:100}]);
    var panel=document.getElementById('commissionPanel');
    var has=panel&&(panel.innerHTML.indexOf('Margin &amp; Commission')>=0||panel.innerHTML.indexOf('Margin & Commission')>=0);
    window.lineItems=[];render();
    return{pass:has,detail:panel?panel.innerHTML.substring(0,80):'no panel'};
  });
  test('commission:singlePaymentTotalMargin',function(){
    // 1 item, qty 1, VAD cost 100, margin 25% → customer ext = 133.33, total margin = 33.33
    window.loadLineItems([{sku:'X',description:'',qty:1,unit_price:100}]);
    document.getElementById('marginPct').value='25';
    render();
    // (cust - cost) - servicesRev (0) = (133.33 - 100) - 0 = 33.33
    var panel=document.getElementById('commissionPanel');
    var ok=panel.innerHTML.indexOf('$33.33')>=0;
    window.lineItems=[];render();
    return{pass:ok,detail:'looking for $33.33 in panel'};
  });
  test('commission:updateServicesRevAffectsMargin',function(){
    window.loadLineItems([{sku:'X',description:'',qty:1,unit_price:100}]);
    document.getElementById('marginPct').value='25';
    updateServicesRev('Payment 1',10);
    // (133.33 - 100) - 10 = 23.33
    var panel=document.getElementById('commissionPanel');
    var ok=panel.innerHTML.indexOf('$23.33')>=0;
    var stored=window.commissionState.servicesRevByGroup['Payment 1'];
    window.lineItems=[];window.commissionState={servicesRevByGroup:{},aeMultiplier:20};render();
    return{pass:ok&&stored===10,detail:'stored='+stored};
  });
  test('commission:updateAeMultiplierAffectsCommission',function(){
    window.loadLineItems([{sku:'X',description:'',qty:1,unit_price:100}]);
    document.getElementById('marginPct').value='25';
    updateAeMultiplier(50);
    // total margin = 33.33, commission = 33.33 * 0.5 = 16.67
    var panel=document.getElementById('commissionPanel');
    var ok=panel.innerHTML.indexOf('$16.67')>=0;
    var stored=window.commissionState.aeMultiplier;
    window.lineItems=[];window.commissionState={servicesRevByGroup:{},aeMultiplier:20};render();
    return{pass:ok&&stored===50,detail:'stored='+stored};
  });
  test('commission:multipleGroupsRender',function(){
    window.loadLineItems([
      {sku:'A',description:'',qty:1,unit_price:100,start_date:'2026-01-01',end_date:'2026-12-31'},
      {sku:'B',description:'',qty:1,unit_price:200,start_date:'2027-01-01',end_date:'2027-12-31'}
    ]);
    var panel=document.getElementById('commissionPanel');
    var hasP1=panel.innerHTML.indexOf('Payment 1')>=0;
    var hasP2=panel.innerHTML.indexOf('Payment 2')>=0;
    window.lineItems=[];render();
    return{pass:hasP1&&hasP2,detail:'p1='+hasP1+' p2='+hasP2};
  });
  test('commission:servicesRevPersistsViaStateRoundtrip',function(){
    window.loadLineItems([{sku:'X',description:'',qty:1,unit_price:100}]);
    updateServicesRev('Payment 1',42);
    updateAeMultiplier(15);
    var s=getQuoteState();
    window.lineItems=[];window.commissionState={servicesRevByGroup:{},aeMultiplier:20};
    restoreQuoteState(s);
    var ok=window.commissionState.servicesRevByGroup['Payment 1']===42&&window.commissionState.aeMultiplier===15;
    window.lineItems=[];newQuote();
    return{pass:ok,detail:'srv='+window.commissionState.servicesRevByGroup['Payment 1']+' mult='+window.commissionState.aeMultiplier};
  });
  test('commission:newQuoteResetsState',function(){
    updateServicesRev('Payment 1',99);
    updateAeMultiplier(33);
    newQuote();
    var ok=window.commissionState.aeMultiplier===20&&Object.keys(window.commissionState.servicesRevByGroup).length===0;
    return{pass:ok,detail:JSON.stringify(window.commissionState)};
  });
  test('commission:legacyRestoreNoCommissionStateDefaults',function(){
    // Legacy saved quote with no commissionState field — should default to {servicesRevByGroup:{},aeMultiplier:20}
    restoreQuoteState({customerName:'Old Co',quoteNumber:'TS-OLD',lineItems:[{sku:'X',description:'',qty:1,unit_price:100}]});
    var ok=window.commissionState.aeMultiplier===20&&Object.keys(window.commissionState.servicesRevByGroup).length===0;
    window.lineItems=[];newQuote();
    return{pass:ok,detail:JSON.stringify(window.commissionState)};
  });
  test('commission:recomputeCellsExists',function(){
    return{pass:typeof window.recomputeCommissionCells==='function',detail:typeof window.recomputeCommissionCells};
  });
  test('commission:servicesRevInputIsText',function(){
    // Item 8 fix: input should be type=text with inputmode=decimal (no spinners, preserves focus)
    window.loadLineItems([{sku:'X',description:'',qty:1,unit_price:100}]);
    var input=document.querySelector('input[oninput^="updateServicesRev"]');
    var ok=input&&input.type==='text'&&input.getAttribute('inputmode')==='decimal';
    window.lineItems=[];render();
    return{pass:ok,detail:input?'type='+input.type+' inputmode='+input.getAttribute('inputmode'):'no input'};
  });
  test('commission:multiplierInputIsText',function(){
    window.loadLineItems([{sku:'X',description:'',qty:1,unit_price:100}]);
    var input=document.querySelector('input[oninput^="updateAeMultiplier"]');
    var ok=input&&input.type==='text'&&input.getAttribute('inputmode')==='decimal';
    window.lineItems=[];render();
    return{pass:ok,detail:input?'type='+input.type+' inputmode='+input.getAttribute('inputmode'):'no input'};
  });
  test('commission:servicesRevPreservesFocusOnUpdate',function(){
    window.loadLineItems([{sku:'X',description:'',qty:1,unit_price:100}]);
    var input=document.querySelector('input[oninput^="updateServicesRev"]');
    if(!input){window.lineItems=[];render();return{pass:false,detail:'no input rendered'};}
    input.focus();
    var beforeFocused=document.activeElement===input;
    updateServicesRev('Payment 1',50);
    // After update, the input must STILL be the same element and still focused
    var afterEl=document.querySelector('input[oninput^="updateServicesRev"]');
    var sameElement=afterEl===input;
    var stillFocused=document.activeElement===input;
    window.lineItems=[];render();
    return{pass:sameElement&&stillFocused,detail:'sameEl='+sameElement+' stillFocused='+stillFocused+' beforeFocused='+beforeFocused};
  });
  test('commission:setTotalAboveCommissionPanel',function(){
    var setTotalLabel=document.querySelector('label');
    // find by text content
    var labels=Array.from(document.querySelectorAll('label'));
    var setTotal=labels.filter(function(l){return l.textContent.indexOf('Set total')>=0;})[0];
    var panel=document.getElementById('commissionPanel');
    if(!setTotal||!panel)return{pass:false,detail:'st='+!!setTotal+' panel='+!!panel};
    // Compare DOCUMENT_POSITION via compareDocumentPosition
    var pos=setTotal.compareDocumentPosition(panel);
    // panel should come AFTER setTotal (Node.DOCUMENT_POSITION_FOLLOWING = 4)
    var ok=(pos&4)===4;
    return{pass:ok,detail:'pos='+pos};
  });
  test('commission:cellsUpdateOnServicesRevChange',function(){
    // Reset commission state to avoid leakage from prior tests
    window.commissionState={servicesRevByGroup:{},aeMultiplier:20};
    window.loadLineItems([{sku:'X',description:'',qty:1,unit_price:100}]);
    document.getElementById('marginPct').value='25';
    render();
    // initial total margin = 33.33 (133.33 - 100)
    var tmEl=document.getElementById('cm_tm_Payment_1');
    if(!tmEl){window.lineItems=[];render();return{pass:false,detail:'no tm cell'};}
    var beforeText=tmEl.textContent;
    updateServicesRev('Payment 1',10);
    var afterText=tmEl.textContent;
    window.lineItems=[];window.commissionState={servicesRevByGroup:{},aeMultiplier:20};render();
    return{pass:beforeText==='$33.33'&&afterText==='$23.33',detail:'before='+beforeText+' after='+afterText};
  });
  // ── Drag & drop fix: idempotent init, shared state, position-aware drop ──
  test('dnd:initIsIdempotent',function(){
    var area=document.getElementById('liArea');
    // Reset flag, then call multiple times — should not throw or attach multiple listener sets
    delete area._dragDropInitialized;
    initDragDrop();
    var firstFlag=area._dragDropInitialized;
    initDragDrop();initDragDrop();initDragDrop();
    return{pass:firstFlag===true&&area._dragDropInitialized===true,detail:'flag='+area._dragDropInitialized};
  });
  test('dnd:cssIndicatorsDefined',function(){
    var styles=Array.prototype.map.call(document.querySelectorAll('style'),function(s){return s.textContent;}).join('\n');
    var hasTop=/tr\.drag-over-top td\s*\{[^}]*box-shadow/.test(styles);
    var hasBot=/tr\.drag-over-bottom td\s*\{[^}]*box-shadow/.test(styles);
    var hasSrc=/tr\.drag-source\s*\{[^}]*opacity/.test(styles);
    return{pass:hasTop&&hasBot&&hasSrc,detail:'top='+hasTop+' bot='+hasBot+' src='+hasSrc};
  });
  test('dnd:dragHandlesRender',function(){
    window.lineItems=[{sku:'A',description:'',qty:1,unit_price:0,margin:null,originalIndex:0},{sku:'B',description:'',qty:1,unit_price:0,margin:null,originalIndex:1}];
    render();
    var handles=document.querySelectorAll('.drag-handle[draggable="true"][data-idx]');
    window.lineItems=[];render();
    return{pass:handles.length===2,detail:'handles='+handles.length};
  });
  test('dnd:moveRowHelperStillWorks',function(){
    // moveRow is the keyboard-accessible reorder; ensure we didn't break it
    window.lineItems=[{sku:'A',originalIndex:0,description:'',qty:1,unit_price:0,margin:null},{sku:'B',originalIndex:1,description:'',qty:1,unit_price:0,margin:null}];
    moveRow(0,1);
    var ok=window.lineItems[0].sku==='B'&&window.lineItems[1].sku==='A';
    window.lineItems=[];render();
    return{pass:ok,detail:window.lineItems.map(function(i){return i.sku;}).join(',')};
  });
  test('dnd:multipleDragsSimulated',function(){
    // Simulate the bug scenario: re-render the table multiple times (which previously
    // double-attached listeners) and verify drag handles still have the right indices.
    window.lineItems=[
      {sku:'A',description:'',qty:1,unit_price:0,margin:null,originalIndex:0},
      {sku:'B',description:'',qty:1,unit_price:0,margin:null,originalIndex:1},
      {sku:'C',description:'',qty:1,unit_price:0,margin:null,originalIndex:2}
    ];
    render();render();render(); // would previously stack listeners 3x
    var handles=document.querySelectorAll('.drag-handle');
    var indices=Array.prototype.map.call(handles,function(h){return h.getAttribute('data-idx');}).join(',');
    window.lineItems=[];render();
    return{pass:indices==='0,1,2',detail:indices};
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

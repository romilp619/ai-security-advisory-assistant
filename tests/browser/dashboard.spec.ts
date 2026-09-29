import { test, expect } from '@playwright/test';
import raw from '../fixtures/GHSA-f82v-jwr5-mffw.json' with {type:'json'};
import { mapGitHub, sources } from '../../src/lib/ingestion';
const doc=mapGitHub(raw,sources[0],new Date().toISOString());
test('honest empty state, example form and accessible setup dialog',async({page},testInfo)=>{
  const errors: string[]=[];page.on('pageerror',e=>errors.push(e.message));
  // Pinned so the unconfigured banner is asserted regardless of the developer's .env.local.
  await page.route('**/api/status',r=>r.fulfill({json:{configured:false,missing:['SANITY_ORGANIZATION_TOKEN'],accessRequired:false}}));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Clarity before your next update.'})).toBeVisible();
  await expect(page.getByText('Connect your knowledge base to start researching')).toBeVisible();
  await page.getByRole('button',{name:'N Check Next.js middleware Version assessment'}).click();
  await expect(page.getByLabel('Software',{exact:false})).toHaveValue('Next.js');
  await expect(page.getByLabel('Installed version',{exact:false})).toHaveValue('14.2.24');
  await page.getByRole('button',{name:'Complete setup'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('SANITY_ORGANIZATION_TOKEN');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.screenshot({path:'test-results/'+testInfo.project.name+'-dashboard.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
test('renders evidence from a clearly mocked research response with real advisory data',async({page})=>{
  const quote=doc.advisoryId+' documents '+doc.cve;
  await page.route('**/api/status',r=>r.fulfill({json:{configured:true,missing:[],accessRequired:false}}));
  await page.route('**/api/research',r=>r.fulfill({contentType:'application/x-ndjson',body:[
    {type:'activity',data:{stage:'knowledge_base_read',detail:'Read next/middleware',at:new Date().toISOString()}},
    {type:'result',data:{requestId:'mock-browser-test',query:{software:'Next.js',version:'14.2.24',question:'What vulnerabilities affect me?'},createdAt:new Date().toISOString(),summary:'Mocked transport test using a real advisory.',findings:[{advisory:doc,assessment:{status:'conditional',reason:'Deployment conditions require verification.'},knowledgeBase:'kbTest',paths:['next/middleware'],evidenceQuote:quote,impactExcerpt:doc.description.slice(0,80),remediationExcerpt:'',origin:'knowledge-base+live',sourceVersionMatch:true}],limitations:['This is a mocked browser test.'],activity:[],entries:[{knowledgeBase:'kbTest',paths:['next/middleware'],content:quote}],coverage:{identity:{status:'resolved',ecosystem:'npm',packageName:'next',display:'Next.js',basis:'known-alias'},sources:[{id:'osv.dev',name:'OSV.dev (Open Source Vulnerabilities)',url:'https://osv.dev',status:'ok',detail:'Queried the npm package "next" at version 14.2.24.',startedAt:new Date().toISOString(),durationMs:1200,origin:'live'},{id:'sanity-knowledge-base',name:'Sanity Context Knowledge Base',url:'https://www.sanity.io/docs/ai/sanity-context-knowledge-bases',status:'failed',detail:'The curated Knowledge Base path did not complete.',startedAt:new Date().toISOString(),durationMs:900,origin:'built-snapshot'}],live:{advisoriesRetrieved:66,versionMatched:30,truncated:false,freshestRecordAt:new Date().toISOString()},knowledgeBase:{entriesRead:1,advisoriesVerified:1},complete:false}}},
  ].map(x=>JSON.stringify(x)).join('\n')+'\n'}));
  await page.goto('/');
  await page.getByRole('button',{name:'N Check Next.js middleware Version assessment'}).click();
  await page.getByRole('button',{name:'Run research'}).click();
  await expect(page.getByText('CVE-2025-29927',{exact:true})).toBeVisible();
  await expect(page.getByText('Conditions to verify',{exact:true})).toBeVisible();
  await expect(page.getByText('14.2.25',{exact:true})).toBeVisible();
  // The provenance badge's colour class must be derived from the same field as its
  // label, so a finding can never be described as curated while styled as live.
  const badge=page.locator('.origin-badge').first();
  await expect(badge).toHaveText('Curated + live source');
  await expect(badge).toHaveClass(/\bboth\b/);
  await expect(badge).not.toHaveClass(/\blive\b/);
  await page.getByRole('tab',{name:'Sources'}).click();
  await expect(page.getByRole('link',{name:'View source'})).toHaveAttribute('href',doc.sourceUrl);
  await page.getByRole('tab',{name:'Activity'}).click();
  await expect(page.getByText('Read next/middleware',{exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'Coverage'}).click();
  await expect(page.getByRole('heading',{name:'What was actually checked'})).toBeVisible();
  await expect(page.getByText('Incomplete coverage',{exact:true})).toBeVisible();
  await expect(page.getByText('OSV.dev (Open Source Vulnerabilities)',{exact:true})).toBeVisible();
  await expect(page.getByText('Did not complete',{exact:true})).toBeVisible();
  await expect(page.getByText('npm / next',{exact:true})).toBeVisible();
});
test('reports a dependency file check without implying a clean bill of health',async({page})=>{
  await page.route('**/api/status',r=>r.fulfill({json:{configured:true,missing:[],accessRequired:false}}));
  await page.route('**/api/dependencies',r=>r.fulfill({json:{
    requestId:'mock-deps',createdAt:new Date().toISOString(),lockfileVersion:3,
    counts:{dependencies:2,queried:2,withAdvisories:1,advisories:1},
    results:[{name:'minimist',version:'1.2.5',dev:false,paths:['node_modules/minimist'],advisoryIds:['GHSA-xvch-5gv4-984h'],detailed:false,findings:[]}],
    skipped:[{reason:'symlinked workspace entry',count:1}],truncated:false,detailLimitReached:false,
    source:{id:'osv.dev',name:'OSV.dev (Open Source Vulnerabilities)',url:'https://osv.dev',status:'ok',detail:'Queried 2 exact package versions.',startedAt:new Date().toISOString(),durationMs:800,origin:'live'},
    complete:true,limitations:['A dependency with no advisory is not proven safe.'],
  }}));
  await page.goto('/');
  await page.getByRole('tab',{name:'Dependencies'}).click();
  await page.setInputFiles('input[type=file]',{name:'package-lock.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({lockfileVersion:3,packages:{'':{},'node_modules/minimist':{version:'1.2.5'}}}))});
  await expect(page.getByText('minimist',{exact:true})).toBeVisible();
  await expect(page.getByText('GHSA-xvch-5gv4-984h',{exact:false})).toBeVisible();
  await expect(page.getByText('A dependency with no advisory is not proven safe.',{exact:true})).toBeVisible();
});
test('accepts a dropped package-lock.json and rejects another file type',async({page})=>{
  let posted: unknown = null;
  await page.route('**/api/status',r=>r.fulfill({json:{configured:true,missing:[],accessRequired:false}}));
  await page.route('**/api/dependencies',r=>{
    posted = JSON.parse(r.request().postData() || '{}');
    return r.fulfill({json:{
      requestId:'mock-drop',createdAt:new Date().toISOString(),lockfileVersion:3,
      counts:{dependencies:1,queried:1,withAdvisories:1,advisories:1},
      results:[{name:'minimist',version:'1.2.5',dev:false,paths:['node_modules/minimist'],advisoryIds:['GHSA-xvch-5gv4-984h'],detailed:false,findings:[]}],
      skipped:[],truncated:false,detailLimitReached:false,
      source:{id:'osv.dev',name:'OSV.dev (Open Source Vulnerabilities)',url:'https://osv.dev',status:'ok',detail:'Queried 1 exact package version.',startedAt:new Date().toISOString(),durationMs:100,origin:'live'},
      complete:true,limitations:['A dependency with no advisory is not proven safe.'],
    }});
  });
  await page.goto('/');
  await page.getByRole('tab',{name:'Dependencies'}).click();
  const zone=page.getByRole('region',{name:'Drop package-lock.json here'});
  await page.evaluate(()=>{
    const data=new DataTransfer();
    data.items.add(new File(['{}'],'package-lock.json',{type:'application/json'}));
    document.querySelector('.upload-dropzone')!.dispatchEvent(new DragEvent('dragenter',{bubbles:true,cancelable:true,dataTransfer:data}));
  });
  await expect(zone).toHaveClass(/drag-active/);
  await expect(zone).toContainText('Release to check this file');
  await page.evaluate(()=>{
    const data=new DataTransfer();
    data.items.add(new File([JSON.stringify({lockfileVersion:3,packages:{'':{},'node_modules/minimist':{version:'1.2.5'}}})],'package-lock.json',{type:'application/json'}));
    document.querySelector('.upload-dropzone')!.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}));
  });
  await expect(zone).not.toHaveClass(/drag-active/);
  await expect(page.getByText('minimist',{exact:true})).toBeVisible();
  expect(posted).toMatchObject({lockfileVersion:3,packages:{'node_modules/minimist':{version:'1.2.5'}}});
  await page.evaluate(()=>{
    const data=new DataTransfer();
    data.items.add(new File(['not a lockfile'],'notes.txt',{type:'text/plain'}));
    document.querySelector('.upload-dropzone')!.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}));
  });
  await expect(page.getByRole('alert').filter({hasText:'Choose a package-lock.json file.'})).toContainText('Choose a package-lock.json file.');
  await expect(page.getByText('minimist',{exact:true})).toHaveCount(0);
});

test('distinguishes source records that share a CVE and disagree on fixes',async({page})=>{
  const source=(id:string,fixed:string)=>({
    advisory:{advisoryId:id,cve:'CVE-2021-23337',severity:'high',
      sourceUrl:'https://osv.dev/vulnerability/'+id,ranges:[{affected:'<'+fixed,fixed}]},
    assessment:{status:'conditional'},
  });
  await page.route('**/api/status',r=>r.fulfill({json:{configured:true,missing:[],accessRequired:false}}));
  await page.route('**/api/dependencies',r=>r.fulfill({json:{
    requestId:'mock-overlap',createdAt:new Date().toISOString(),lockfileVersion:3,
    counts:{dependencies:1,queried:1,withAdvisories:1,advisories:2},
    results:[{name:'lodash',version:'4.17.20',dev:false,paths:['node_modules/lodash'],
      advisoryIds:['GHSA-35jh-r3h4-6jhm','GHSA-r5fr-rjxr-66jc'],detailed:true,
      findings:[source('GHSA-35jh-r3h4-6jhm','4.17.21'),source('GHSA-r5fr-rjxr-66jc','4.18.0')]}],
    skipped:[],truncated:false,detailLimitReached:false,
    source:{id:'osv.dev',name:'OSV.dev',url:'https://osv.dev',status:'ok',
      detail:'Queried 1 exact package version.',startedAt:new Date().toISOString(),durationMs:100,origin:'live'},
    complete:true,limitations:['Review source records before upgrading.'],
  }}));
  await page.goto('/');
  await page.getByRole('tab',{name:'Dependencies'}).click();
  await page.setInputFiles('input[type=file]',{name:'package-lock.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify({lockfileVersion:3,packages:{'':{},'node_modules/lodash':{version:'4.17.20'}}}))});
  await expect(page.getByText('2 matching source records')).toBeVisible();
  await expect(page.getByRole('link',{name:'Open source record GHSA-35jh-r3h4-6jhm'})).toHaveAttribute('href','https://osv.dev/vulnerability/GHSA-35jh-r3h4-6jhm');
  await expect(page.getByRole('link',{name:'Open source record GHSA-r5fr-rjxr-66jc'})).toBeVisible();
  await expect(page.getByText('also CVE-2021-23337')).toHaveCount(2);
  await expect(page.getByText('Source lists fixed: 4.17.21')).toBeVisible();
  await expect(page.getByText('Source lists fixed: 4.18.0')).toBeVisible();
  await expect(page.getByText('Some source records share a CVE but list different affected ranges or fixes.',{exact:false})).toBeVisible();
});

test('shows backend failure without fabricating a successful result',async({page})=>{
  await page.route('**/api/research',r=>r.fulfill({status:503,json:{error:'Connect Sanity and an AI provider before researching.'}}));
  await page.goto('/');
  await page.getByRole('button',{name:'N Check Next.js middleware Version assessment'}).click();
  await page.getByRole('button',{name:'Run research'}).click();
  await expect(page.getByRole('alert').filter({hasText:'Connect Sanity'})).toContainText('Connect Sanity');
  await expect(page.getByText('CVE-2025-29927',{exact:true})).toHaveCount(0);
});

type Pg=import('@playwright/test').Page;
// Proof that the motion layer executed: GSAP writes inline styles, and SplitText
// replaces the headline's text with line elements.
const motionStarted=(page:Pg)=>page.waitForFunction(
  ()=>document.querySelectorAll('.headline-line').length>0
    || Boolean(document.querySelector('.research-panel')?.getAttribute('style')),
  null,{timeout:10000});
const settled=async(page:Pg)=>{
  // An empty global timeline trivially satisfies "nothing is active", so wait for the
  // animation to START before waiting for it to finish. Without this the helper
  // returns instantly and every end-state assertion becomes meaningless.
  await motionStarted(page);
  await page.waitForFunction(()=>{
    const g=(window as unknown as {gsap?:{globalTimeline:{getChildren:(a?:boolean,b?:boolean,c?:boolean)=>{isActive:()=>boolean}[]}}}).gsap;
    if(!g) return true;
    return g.globalTimeline.getChildren(true,true,false).every(t=>!t.isActive());
  },null,{timeout:12000}).catch(()=>{});
  await page.waitForTimeout(700);
};
const opacityOf=(page:import('@playwright/test').Page,selector:string)=>
  page.evaluate(s=>{const el=document.querySelector(s);return el?getComputedStyle(el).opacity:null;},selector);

test('entrance animations actually run, then settle',async({page},testInfo)=>{
  // Asserting only the end state cannot distinguish "animated correctly" from
  // "never animated at all", so this first proves motion is genuinely in flight.
  await page.route('**/api/status',r=>r.fulfill({json:{configured:true,missing:[],accessRequired:false}}));
  await page.goto('/');
  await motionStarted(page);
  const midFlight=await page.evaluate(()=>getComputedStyle(document.querySelector('.research-panel')!).opacity);
  expect(Number(midFlight),'panel should be mid-animation, not already at rest').toBeLessThan(1);
  await settled(page);
  expect(Number(await opacityOf(page,'.research-panel')),'panel should finish opaque').toBeGreaterThan(0.99);
  // SplitText must have split the headline into line elements.
  expect(await page.locator('.headline-line').count(),'headline should be split for the line reveal').toBeGreaterThan(0);
  void testInfo;
});

test('entrance animations settle and leave no hidden content',async({page},testInfo)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/status',r=>r.fulfill({json:{configured:true,missing:[],accessRequired:false}}));
  await page.goto('/');
  await settled(page);
  for(const selector of ['.welcome h1','.research-panel','.guide-panel','.connection-banner','.topbar','.brand']){
    // Numeric, not string equality: a tween sampled a frame before its final commit
    // reports 0.997, which is settled for every practical purpose.
    expect(Number(await opacityOf(page,selector)),selector+' should end fully opaque').toBeGreaterThan(0.99);
  }
  await expect(page.getByRole('heading',{name:'Clarity before your next update.'})).toBeVisible();
  await page.screenshot({path:'test-results/'+testInfo.project.name+'-animated.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test.describe('reduced motion',()=>{
  test.use({reducedMotion:'reduce'});
  test('renders content immediately and animates nothing',async({page})=>{
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/api/status',r=>r.fulfill({json:{configured:true,missing:[],accessRequired:false}}));
    await page.goto('/');
    // No settling wait: with prefers-reduced-motion the content must already be readable.
    await expect(page.getByRole('heading',{name:'Clarity before your next update.'})).toBeVisible();
    for(const selector of ['.welcome h1','.research-panel','.guide-panel','.examples button','.results-panel']){
      expect(await opacityOf(page,selector),selector+' must not be faded out under reduced motion').toBe('1');
    }
    // The headline stays plain, unsplit text; no line reveal is constructed at all.
    expect(await page.locator('.headline-line').count(),'no text should be split under reduced motion').toBe(0);
    expect(errors).toEqual([]);
  });
});

test('the display headline never runs under the hero symbol',async({page})=>{
  // The headline collapses to one line somewhere around 1450-1600px. That band sits
  // between the desktop (1440) and mobile projects, so it is checked explicitly here.
  await page.route('**/api/status',r=>r.fulfill({json:{configured:true,missing:[],accessRequired:false}}));
  for (const width of [1220,1475,1500,1600,1920]) {
    await page.setViewportSize({width,height:900});
    await page.goto('/');
    await motionStarted(page);
    const r=await page.evaluate(()=>{
      const h=document.querySelector('.welcome h1')!, s=document.querySelector('.welcome-symbol');
      if(!s||getComputedStyle(s).display==='none') return {skip:true,overlap:false,gap:0};
      const walker=document.createTreeWalker(h,NodeFilter.SHOW_TEXT);
      const rects:DOMRect[]=[]; let n:Node|null;
      while((n=walker.nextNode())){ if(!n.textContent?.trim()) continue;
        const rg=document.createRange(); rg.selectNodeContents(n); rects.push(...Array.from(rg.getClientRects())); }
      const right=Math.max(...rects.map(x=>x.right)), top=Math.min(...rects.map(x=>x.top)), bottom=Math.max(...rects.map(x=>x.bottom));
      const sr=s.getBoundingClientRect();
      return {skip:false, overlap: right>sr.left && top<sr.bottom && bottom>sr.top, gap:Math.round(sr.left-right)};
    });
    expect(r.overlap,`headline overlaps the hero symbol at ${width}px (clearance ${r.gap}px)`).toBe(false);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`horizontal scroll at ${width}px`).toBe(true);
  }
});

test('every results tab stays reachable on a narrow screen',async({page})=>{
  // Five tabs do not fit a phone. The tab list must scroll on its own rather than
  // overflowing the page and putting the last tab out of reach.
  await page.route('**/api/status',r=>r.fulfill({json:{configured:true,missing:[],accessRequired:false}}));
  for (const width of [320,360,390]) {
    await page.setViewportSize({width,height:900});
    await page.goto('/');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),
      `page scrolls horizontally at ${width}px`).toBe(true);
    const last=page.getByRole('tab',{name:'Activity'});
    await last.scrollIntoViewIfNeeded();
    expect(await page.evaluate(()=>{
      const t=[...document.querySelectorAll('[role=tab]')].pop()!;
      const r=t.getBoundingClientRect();
      return r.right<=window.innerWidth+1 && r.left>=-1;
    }),`last tab is not reachable at ${width}px`).toBe(true);
    await last.click();
    await expect(page.locator('[role=tab][data-state=active]')).toHaveText(/Activity/);
  }
});

test('the example card row reveals without vertical desync',async({page})=>{
  // A staggered y-offset across a row of siblings reads as misalignment.
  await page.route('**/api/status',r=>r.fulfill({json:{configured:true,missing:[],accessRequired:false}}));
  await page.setViewportSize({width:1440,height:900});
  await page.addInitScript(()=>{
    (window as unknown as {__d:number[]}).__d=[];
    const tick=()=>{
      const c=[...document.querySelectorAll('.examples button')];
      if(c.length===3){
        const ys=c.map(e=>{const m=getComputedStyle(e).transform.match(/matrix\(([^)]+)\)/);
          return m?parseFloat(m[1].split(',')[5]):0;});
        (window as unknown as {__d:number[]}).__d.push(Math.max(...ys)-Math.min(...ys));
      }
      if((window as unknown as {__d:number[]}).__d.length<180) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.goto('/');
  await page.evaluate(()=>window.scrollTo({top:400,behavior:'instant'}));
  await page.waitForTimeout(2500);
  const worst=await page.evaluate(()=>Math.max(0,...(window as unknown as {__d:number[]}).__d));
  expect(worst,'cards in the row drifted vertically out of line during the reveal').toBeLessThanOrEqual(1);
});

test('headline descenders are never clipped by the SplitText line masks',async({page})=>{
  // SplitText masks each line with `overflow: clip` sized to the line box. A display
  // line-height is shorter than the font's ink, so y, p and g get cut flat unless the
  // mask is given extra room. Measured against real font metrics, not eyeballed.
  await page.route('**/api/status',r=>r.fulfill({json:{configured:true,missing:[],accessRequired:false}}));
  for (const width of [1440,1600]) {
    await page.setViewportSize({width,height:900});
    await page.goto('/');
    await motionStarted(page);
    await settled(page);
    const rows=await page.evaluate(async()=>{
      const h=document.querySelector('.welcome h1')!;
      const cs=getComputedStyle(h);
      await document.fonts.ready;
      const ctx=document.createElement('canvas').getContext('2d')!;
      ctx.font=`${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const m=ctx.measureText('your next update.');
      const inkDescent=m.actualBoundingBoxDescent;          // how far ink actually drops
      // Half-leading must be derived from the FONT's own ascent/descent, not from the
      // ink ascent of a capital. Using ink ascent puts the baseline too high and
      // reports room that does not exist.
      const fontAscent=m.fontBoundingBoxAscent, fontDescent=m.fontBoundingBoxDescent;
      return [...h.querySelectorAll('.headline-line-mask')].map(mask=>{
        const line=mask.querySelector('.headline-line')!;
        const lr=line.getBoundingClientRect();
        const lineH=parseFloat(getComputedStyle(line).lineHeight);
        const halfLeading=(lineH-(fontAscent+fontDescent))/2;
        const baseline=lr.top+halfLeading+fontAscent;
        return {room:mask.getBoundingClientRect().bottom-baseline, needed:inkDescent,
          text:(line.textContent||'').trim().slice(0,18)};
      });
    });
    expect(rows.length,`no split lines at ${width}px`).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.room,`"${r.text}" has ${r.room.toFixed(1)}px below the baseline but the font's ink needs ${r.needed.toFixed(1)}px at ${width}px`)
        .toBeGreaterThanOrEqual(r.needed);
    }
  }
});

import { chromium } from 'playwright'

const results = []
const ok = (name, cond, extra='') => { results.push({name, pass: !!cond, extra}); console.log(`${cond?'✅':'❌'} ${name}${extra?'  ('+extra+')':''}`) }
const SHOT = (p,n)=>p.screenshot({path:`tests/shots/${n}.png`})

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push('PAGEERROR: '+e.message))
page.on('console', m => { if (m.type()==='error') errors.push('CONSOLE: '+m.text()) })
page.on('dialog', async d => { if (d.type()==='prompt') await d.accept('1'); else await d.accept() })

const URL = process.env.SC_URL || 'http://localhost:5173/'

// Drag-select a character range WITHIN one paragraph of the shared .sv-doc.
async function dragInPara(paraIdx, s, e) {
  const pts = await page.evaluate(([pi,s,e])=>{
    const ps=document.querySelectorAll('.sv-doc p'); const p=ps[pi]
    const tn=document.createTreeWalker(p, NodeFilter.SHOW_TEXT).nextNode()
    // start = left edge of char s, end = right edge of char (e-1) — so a full
    // [s,e) range is unambiguously covered regardless of glyph-centre rounding.
    const edge=(o,side)=>{const r=document.createRange();r.setStart(tn,o);r.setEnd(tn,o+1);const b=r.getClientRects()[0];return{x: side==='right'? b.right-1 : b.left+1, y:b.top+b.height/2}}
    return {a: edge(Math.min(s,tn.length-1),'left'), b: edge(Math.min(Math.max(e-1,s),tn.length-1),'right')}
  }, [paraIdx,s,e])
  await page.mouse.move(pts.a.x, pts.a.y); await page.mouse.down()
  await page.mouse.move((pts.a.x+pts.b.x)/2, (pts.a.y+pts.b.y)/2, {steps:4})
  await page.mouse.move(pts.b.x, pts.b.y, {steps:4}); await page.mouse.up()
  await page.waitForTimeout(400)
}

// Single click at a character within a paragraph (no drag) — used to select a cue.
async function clickInPara(paraIdx, off) {
  const pt = await page.evaluate(([pi,off])=>{
    const ps=document.querySelectorAll('.sv-doc p'); const tn=document.createTreeWalker(ps[pi],NodeFilter.SHOW_TEXT).nextNode()
    const r=document.createRange();r.setStart(tn,Math.min(off,tn.length-1));r.setEnd(tn,Math.min(off+1,tn.length));const b=r.getClientRects()[0]
    return {x:b.left+b.width/2, y:b.top+b.height/2}
  }, [paraIdx,off])
  await page.mouse.click(pt.x, pt.y)
  await page.waitForTimeout(200)
}

// Drag-select an exact phrase found in the rendered script (real mouse path),
// used to prove the character mapping is exact even deep in long wrapped lines.
async function dragPhrase(phrase) {
  const c = await page.evaluate((phrase)=>{
    const p=[...document.querySelectorAll('.sv-doc p')].find(el=>el.textContent.includes(phrase))
    const tn=document.createTreeWalker(p,NodeFilter.SHOW_TEXT).nextNode()
    const i=tn.textContent.indexOf(phrase)
    const r1=document.createRange();r1.setStart(tn,i);r1.setEnd(tn,i+1)
    const r2=document.createRange();r2.setStart(tn,i+phrase.length-1);r2.setEnd(tn,i+phrase.length)
    const a=r1.getClientRects()[0]; const rcs=r2.getClientRects(); const bb=rcs[rcs.length-1]
    return {ax:a.left+1,ay:a.top+a.height/2,bx:bb.right-1,by:bb.top+bb.height/2}
  }, phrase)
  await page.mouse.move(c.ax,c.ay); await page.mouse.down()
  await page.mouse.move((c.ax+c.bx)/2,(c.ay+c.by)/2,{steps:6})
  await page.mouse.move(c.bx,c.by,{steps:6}); await page.mouse.up()
  await page.waitForTimeout(300)
}

// ════════════ A. CORRUPT RECOVERY ════════════
await page.goto(URL, { waitUntil:'domcontentloaded' })
await page.evaluate(() => {
  localStorage.clear()
  const id='corrupt-1'
  localStorage.setItem('cueflow_project_'+id, JSON.stringify({ id, title:'Corrupt Co', scenes:'oops' }))
  localStorage.setItem('cueflow_index', JSON.stringify([{id, title:'Corrupt Co', updatedAt:new Date().toISOString(), sceneCount:0, shotCount:0}]))
  localStorage.setItem('cueflow_active_id', id)
})
await page.goto(URL, { waitUntil:'networkidle' })
await page.waitForTimeout(1300)
ok('Corrupt project does NOT crash app', await page.locator('.crash').count()===0 && await page.locator('.app, .welcome').count()>0)
ok('Corrupt project repaired + loaded', (await page.locator('.hdr-project').textContent().catch(()=>''))?.includes('Corrupt Co'))

// ════════════ B. CLEAN FLOW ════════════
await page.evaluate(()=>localStorage.clear())
await page.goto(URL, { waitUntil:'networkidle' })
await page.waitForTimeout(500)
ok('Welcome renders', await page.locator('.welcome-name').textContent()==='SHOTCALLER')
await page.fill('.welcome input', 'King Lear · Act III')
await page.click('text=Create Project')
await page.waitForTimeout(600)
ok('Edit mode after create', await page.locator('.app').count()===1)

// Settings: add camera, vocab, toggle (#12: settings now opens as modal via rail-settings button)
await page.click('.rail-settings'); await page.waitForTimeout(250)
await page.click('text=Add Camera'); await page.waitForTimeout(200)
ok('Add camera works', await page.locator('.cam-edit-row').count()===4)
await page.click('.settings-tab:has-text("VOCAB")'); await page.waitForTimeout(150)
await page.click('.vocab-add-row .cat-pill:has-text("Custom")'); await page.waitForTimeout(150)
await page.locator('.vocab-add-row input').fill('CRANE MOVE'); await page.locator('.vocab-add-row input').press('Enter'); await page.waitForTimeout(200)
ok('Add custom vocab', (await page.locator('.vocab-term').allTextContents()).some(t=>t.includes('CRANE MOVE')))
await page.locator('.modal .close').click(); await page.waitForTimeout(200)

// Import script
await page.click('.rail-btn:has-text("Import")'); await page.waitForTimeout(250)
await page.click('button:has-text("Import Script")'); await page.waitForTimeout(250)
const script = `LEAR\nBlow, winds, and crack your cheeks! rage! blow!\nKENT\nAlas, sir, are you here? things that love night love not such nights as these.\nLEAR\nLet the great gods, that keep this dreadful pother over our heads, find out their enemies now.`
await page.fill('.modal textarea', script)
await page.click('text=Use pasted text'); await page.waitForTimeout(250)
await page.click('.modal button:has-text("Continue")'); await page.waitForTimeout(250)
ok('Detected LEAR + KENT', (await page.locator('.char-chip').allTextContents()).some(c=>c.includes('LEAR')) && (await page.locator('.char-chip').allTextContents()).some(c=>c.includes('KENT')))
await page.click('.modal button:has-text("Import Script")'); await page.waitForTimeout(600)
await page.locator('.sidebar-close').click().catch(()=>{}); await page.waitForTimeout(300)
ok('Script rendered as paragraphs in shared doc', await page.locator('.sv-doc p').count()>=4)

// ── #1: MODE SWITCH — identical content, single shared element ──
const cueText = (await page.locator('.sv-doc').textContent()).replace(/\s+/g,' ').trim()
const cueHtml = await page.locator('.sv-doc').innerHTML()
await page.click('.sv-mode:has-text("Text Mode")'); await page.waitForTimeout(300)
ok('#1 Only ONE shared doc element (no separate editor)', await page.locator('.sv-doc').count()===1 && await page.locator('.sv-editable').count()===0)
ok('#1 Doc is editable in Text Mode', await page.locator('.sv-doc[contenteditable="true"]').count()===1)
const textText = (await page.locator('.sv-doc').textContent()).replace(/\s+/g,' ').trim()
ok('#1 Text identical across Cue↔Text', cueText===textText, `len ${cueText.length} vs ${textText.length}`)
const textHtml = await page.locator('.sv-doc').innerHTML()
ok('#1 Same HTML structure (no reflow)', cueHtml===textHtml)
await page.click('.sv-mode:has-text("Cue Mode")'); await page.waitForTimeout(300)
ok('#1 Doc NOT editable in Cue Mode', await page.locator('.sv-doc[contenteditable="false"]').count()===1)

// ── CUE ASSIGNMENT (shared doc) ──
await dragInPara(1, 0, 11)  // "Blow, winds"
ok('Assign popover appears', await page.locator('.assign-pop').count()===1)
ok('Popover shows selected text', (await page.locator('.assign-selected').textContent())?.includes('Blow'))

// ── #4: vocab insert adds trailing space ──
await page.locator('.assign-pop .vocab-chip').first().click()
await page.waitForTimeout(150)
const stVal = await page.locator('.shot-type-input input').inputValue()
ok('#4 Vocab insert adds trailing space', stVal.length>0 && stVal.endsWith(' '), JSON.stringify(stVal))
await page.fill('.shot-type-input input','')
await page.locator('.assign-pop .cam-pick').nth(1).click()
await page.fill('.shot-type-input input', 'MCU LEAR')
await SHOT(page,'09-popover-shot')
await page.click('.assign-pop button:has-text("Create Shot")')
await page.waitForTimeout(500)
await page.locator('.detail-panel .close').click().catch(()=>{}); await page.waitForTimeout(200)
ok('Shot 1 created', await page.locator('.shot-row').count()===1)
ok('Cue overlay highlight rendered', await page.locator('.cue-rect').count()>=1)

// second shot (no chapter)
await dragInPara(3, 0, 9)  // "Alas, sir"
await page.locator('.assign-pop .cam-pick').nth(0).click()
await page.fill('.shot-type-input input', 'WS STORM')
await page.click('.assign-pop button:has-text("Create Shot")')
await page.waitForTimeout(400)
await page.locator('.detail-panel .close').click().catch(()=>{}); await page.waitForTimeout(200)
ok('Shot 2 created', await page.locator('.shot-row').count()===2)

// ── #3: CHAPTER — heading only, name from selection, no camera/shot ──
await dragInPara(2, 0, 4)  // "KENT"
ok('Popover open for chapter selection', await page.locator('.assign-pop').count()===1)
await page.click('.am-tab:has-text("Chapter")')
await page.waitForTimeout(200)
const chName = await page.locator('.assign-pop input[placeholder="CHAPTER NAME"]').inputValue()
ok('#3 Chapter name auto-filled from selection', chName.trim()==='KENT', JSON.stringify(chName))
ok('#3 Chapter mode hides camera picker', await page.locator('.assign-pop .cam-picker').count()===0)
await SHOT(page,'10-popover-chapter')
const shotsBeforeChapter = await page.locator('.shot-row').count()
await page.click('.assign-pop button:has-text("Create Chapter")')
await page.waitForTimeout(400)
await page.locator('.detail-panel .close').click().catch(()=>{})
ok('#3 Chapter created as divider row', (await page.locator('.chapter-row').allTextContents()).some(t=>t.includes('KENT')))
ok('#3 Chapter did NOT create a shot', await page.locator('.shot-row').count()===shotsBeforeChapter, `shots=${await page.locator('.shot-row').count()}`)
await SHOT(page,'04-edit-with-shots')

// ── DETAIL PANEL: single camera ring (#9: open via edit button, not row click) ──
await page.locator('.shot-row').first().hover(); await page.waitForTimeout(150)
await page.locator('.shot-row').first().locator('.sr-edit').click(); await page.waitForTimeout(300)
const rings = await page.evaluate(()=>[...document.querySelectorAll('.detail-panel .cam-pick')].filter(p=>{const oc=getComputedStyle(p).outlineColor;return oc!=='rgba(0, 0, 0, 0)'}).length)
ok('Detail panel rings exactly ONE camera', rings===1, `rings=${rings}`)
await page.locator('.detail-panel .close').click(); await page.waitForTimeout(200)

// ── #6A: CLICK A CUE TO SELECT IT (handles appear, detail panel stays closed) ──
await clickInPara(1, 2) // click inside "Blow, winds" cue
ok('#6A Click cue → handles appear', await page.locator('.cue-handle').count()===2, `handles=${await page.locator('.cue-handle').count()}`)
ok('#6A Click cue does NOT open detail panel', await page.locator('.detail-panel').count()===0)
ok('#6A Clicked cue is highlighted', await page.locator('.cue-rect.sel').count()>=1)

// ── #6A: DRAG HANDLE RESIZE (on the selected cue) ──
const beforeEnd = await page.evaluate(()=>{const i=JSON.parse(localStorage.getItem('cueflow_index'));const p=JSON.parse(localStorage.getItem('cueflow_project_'+i[0].id));return p.scenes[0].shots[0].endIndex})
const hb = await page.locator('.cue-handle.end').first().boundingBox()
if (hb){ await page.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2); await page.mouse.down(); await page.mouse.move(hb.x+30,hb.y+hb.height/2,{steps:5}); await page.mouse.move(hb.x+70,hb.y+hb.height/2,{steps:5}); await page.mouse.up(); await page.waitForTimeout(500) }
const afterEnd = await page.evaluate(()=>{const i=JSON.parse(localStorage.getItem('cueflow_index'));const p=JSON.parse(localStorage.getItem('cueflow_project_'+i[0].id));return p.scenes[0].shots[0].endIndex})
ok('#6A Drag handle resizes cue', afterEnd!==beforeEnd, `${beforeEnd}->${afterEnd}`)

// ── #6B: SELECTION OVERLAPPING AN EXISTING CUE IS BLOCKED ──
await clickInPara(0, 1) // click "LEAR" (unassigned) to deselect → handles disappear
const shotsBeforeOverlap = await page.locator('.shot-row').count()
await dragInPara(1, 1, 10) // inside the existing "Blow, winds" cue (clear of its handles)
ok('#6B Overlapping selection is blocked (no popover)', await page.locator('.assign-pop').count()===0)
ok('#6B Overlapping selection shows an error', await page.locator('.sv-error').count()===1)
ok('#6B Overlapping selection creates no new shot', await page.locator('.shot-row').count()===shotsBeforeOverlap)

// ── filters / search / export ──
await page.locator('.cam-filter').nth(1).click(); await page.waitForTimeout(150)
ok('Camera filter narrows', await page.locator('.shot-row').count()===1)
await page.locator('.cam-filter').nth(1).click(); await page.waitForTimeout(150)
await page.fill('.sl-search input','STORM'); await page.waitForTimeout(150)
ok('Search filters', await page.locator('.shot-row').count()===1)
await page.fill('.sl-search input',''); await page.waitForTimeout(150)
await page.click('.shotlist .btn:has-text("Export")'); await page.waitForTimeout(150)
const [dl] = await Promise.all([ page.waitForEvent('download').catch(()=>null), page.click('.export-menu button:has-text("Shotlist CSV")') ])
ok('CSV export downloads', !!dl)

// ════════════ #2: POPOVER ALWAYS VISIBLE (low selection) ════════════
await page.evaluate(()=>localStorage.clear())
await page.goto(URL,{waitUntil:'networkidle'}); await page.waitForTimeout(400)
await page.fill('.welcome input','Long'); await page.click('text=Create Project'); await page.waitForTimeout(500)
await page.click('.rail-btn:has-text("Import")'); await page.waitForTimeout(200)
await page.click('button:has-text("Import Script")'); await page.waitForTimeout(200)
const longScript = Array.from({length:60},(_,i)=>`Line ${i+1} of a very long script with enough words to fill the viewport height nicely here.`).join('\n')
await page.fill('.modal textarea', longScript)
await page.click('text=Use pasted text'); await page.waitForTimeout(200)
await page.click('.modal button:has-text("Continue")'); await page.waitForTimeout(200)
await page.click('.modal button:has-text("Import Script")'); await page.waitForTimeout(500)
await page.locator('.sidebar-close').click().catch(()=>{}); await page.waitForTimeout(300)
// scroll to bottom and select a line near the very bottom of the viewport
await page.evaluate(()=>{const s=document.querySelector('.sv-scroll');s.scrollTop=s.scrollHeight})
await page.waitForTimeout(300)
const paraCount = await page.locator('.sv-doc p').count()
await dragInPara(paraCount-1, 0, 12)
const inView = await page.evaluate(()=>{const el=document.querySelector('.assign-pop');if(!el)return null;const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,vh:window.innerHeight,fits: r.top>=0 && r.bottom<=window.innerHeight}})
ok('#2 Popover fully visible for bottom selection', inView && inView.fits, inView?`top=${Math.round(inView.top)} bottom=${Math.round(inView.bottom)} vh=${inView.vh}`:'no popover')
await SHOT(page,'11-popover-lowselection')
await page.keyboard.press('Escape')

// ════════════ #6: EXACT CHARACTER MAPPING (deep in a long wrapped line) ════════════
// This is the regression that earlier `.includes()` checks missed: a phrase deep
// in a long line must map to EXACTLY the selected characters (no space-drift).
await page.evaluate(()=>localStorage.clear())
await page.goto(URL,{waitUntil:'networkidle'}); await page.waitForTimeout(400)
await page.fill('.welcome input','Exact'); await page.click('text=Create Project'); await page.waitForTimeout(500)
await page.click('.rail-btn:has-text("Import")'); await page.waitForTimeout(150)
await page.click('button:has-text("Import Script")'); await page.waitForTimeout(150)
await page.fill('.modal textarea','Everyone turns to see who said that, reveal none other than Edward Bloom. The crowd parts to reveal him standing tall in the doorway while the storm rages outside tonight.')
await page.click('text=Use pasted text'); await page.waitForTimeout(150)
await page.click('.modal button:has-text("Continue")'); await page.waitForTimeout(150)
await page.click('.modal button:has-text("Import Script")'); await page.waitForTimeout(450)
await page.locator('.sidebar-close').click().catch(()=>{}); await page.waitForTimeout(300)
const phrase='Edward Bloom. The crowd parts to'
await dragPhrase(phrase)
const exSel=(await page.locator('.assign-selected').textContent().catch(()=>'')).replace(/[“”]/g,'').replace(/\s+/g,' ').trim()
ok('#6 Deep-line selection maps to EXACT characters', exSel===phrase, `got "${exSel}"`)
await page.locator('.assign-pop .cam-pick').nth(0).click(); await page.fill('.shot-type-input input','MCU'); await page.click('.assign-pop button:has-text("Create Shot")'); await page.waitForTimeout(650)
const exSlice=await page.evaluate(()=>{const i=JSON.parse(localStorage.getItem('cueflow_index'));const s=JSON.parse(localStorage.getItem('cueflow_project_'+i[0].id)).scenes[0];const sh=s.shots[0];return s.rawScript.plainText.slice(sh.startIndex,sh.endIndex).replace(/\s+/g,' ').trim()})
ok('#6 Stored cue slice matches selection exactly', exSlice===phrase, `got "${exSlice}"`)

// ════════════ #7: RICH TEXT shows in cue list + live view ════════════
// Bold a word inside the cue in Text Mode, then confirm the formatting renders
// in the shotlist and the live cue table (and the plainText slice is unchanged).
await page.click('.sv-mode:has-text("Text Mode")'); await page.waitForTimeout(300)
const bpt=await page.evaluate(()=>{const tn=document.createTreeWalker(document.querySelector('.sv-doc p'),NodeFilter.SHOW_TEXT).nextNode();const i=tn.textContent.indexOf('Bloom');const r=document.createRange();r.setStart(tn,i);r.setEnd(tn,i+5);const b=r.getClientRects()[0];return{x:b.left+b.width/2,y:b.top+b.height/2}})
await page.mouse.dblclick(bpt.x,bpt.y); await page.waitForTimeout(150)
await page.click('.sv-format button[title="Bold"]'); await page.waitForTimeout(200)
await page.click('.sv-mode:has-text("Cue Mode")'); await page.waitForTimeout(400)
ok('#7 Rich text (bold) shows in shotlist', /<b>\s*Bloom\s*<\/b>/i.test(await page.locator('.sr-script').first().innerHTML()))
await page.click('.hdr-tab:has-text("Live")'); await page.waitForTimeout(250)
await page.click('.modal button:has-text("Go Live")'); await page.waitForTimeout(450)
ok('#7 Rich text (bold) shows in live view', /<b>\s*Bloom\s*<\/b>/i.test(await page.locator('.lr-script').first().innerHTML()))
await page.keyboard.press('Escape'); await page.waitForTimeout(200); await page.locator('.modal button:has-text("Exit to Edit")').click().catch(()=>{}); await page.waitForTimeout(300)

// ════════════ #8: BATCH SELECT + DELETE cues/chapters ════════════
await page.evaluate(()=>localStorage.clear())
await page.goto(URL,{waitUntil:'networkidle'}); await page.waitForTimeout(400)
await page.fill('.welcome input','Batch'); await page.click('text=Create Project'); await page.waitForTimeout(500)
await page.click('.rail-btn:has-text("Import")'); await page.waitForTimeout(150)
await page.click('button:has-text("Import Script")'); await page.waitForTimeout(150)
await page.fill('.modal textarea','Alpha beta gamma delta epsilon zeta eta theta iota.')
await page.click('text=Use pasted text'); await page.waitForTimeout(150)
await page.click('.modal button:has-text("Continue")'); await page.waitForTimeout(150)
await page.click('.modal button:has-text("Import Script")'); await page.waitForTimeout(450)
await page.locator('.sidebar-close').click().catch(()=>{}); await page.waitForTimeout(300)
for (const [a,e,cam,ty] of [[0,5,0,'WS'],[11,16,1,'CU'],[23,30,2,'MS']]) {
  await dragInPara(0,a,e); await page.locator('.assign-pop .cam-pick').nth(cam).click(); await page.fill('.shot-type-input input',ty); await page.click('.assign-pop button:has-text("Create Shot")'); await page.waitForTimeout(300)
}
await page.waitForTimeout(650)
ok('#8 Three cues created', await page.locator('.shot-row').count()===3)
await page.locator('.shot-row .row-check').nth(0).click({force:true}); await page.waitForTimeout(100)
await page.locator('.shot-row .row-check').nth(1).click({modifiers:['Shift'],force:true}); await page.waitForTimeout(150)
ok('#8 Batch bar shows 2 selected', (await page.locator('.sl-batch-count').textContent()).startsWith('2'))
await page.click('.sl-batchbar .btn.danger'); await page.waitForTimeout(200)
ok('#8 Delete uses UI-kit modal (not native)', await page.locator('.modal:has-text("Delete")').count()===1)
await page.click('.modal button:has-text("Delete")'); await page.waitForTimeout(650)
ok('#8 Batch delete removed selected cues', await page.locator('.shot-row').count()===1)
ok('#8 Remaining cue renumbered to 001', (await page.locator('.sr-num').first().textContent())==='001')

// ════════════ C. LIVE MODE (quick regression) ════════════
await page.evaluate(()=>localStorage.clear())
await page.goto(URL,{waitUntil:'networkidle'}); await page.waitForTimeout(400)
await page.fill('.welcome input','Live'); await page.click('text=Create Project'); await page.waitForTimeout(500)
await page.click('.rail-btn:has-text("Import")'); await page.waitForTimeout(200)
await page.click('button:has-text("Import Script")'); await page.waitForTimeout(200)
await page.fill('.modal textarea','First line of the scene here.\nSecond line of the scene here.')
await page.click('text=Use pasted text'); await page.waitForTimeout(200)
await page.click('.modal button:has-text("Continue")'); await page.waitForTimeout(200)
await page.click('.modal button:has-text("Import Script")'); await page.waitForTimeout(500)
await page.locator('.sidebar-close').click().catch(()=>{}); await page.waitForTimeout(300)
await dragInPara(0,0,10); await page.locator('.assign-pop .cam-pick').nth(0).click(); await page.fill('.shot-type-input input','WS'); await page.click('.assign-pop button:has-text("Create Shot")'); await page.waitForTimeout(300); await page.locator('.detail-panel .close').click().catch(()=>{})
await dragInPara(1,0,10); await page.locator('.assign-pop .cam-pick').nth(1).click(); await page.fill('.shot-type-input input','CU'); await page.click('.assign-pop button:has-text("Create Shot")'); await page.waitForTimeout(300); await page.locator('.detail-panel .close').click().catch(()=>{})
await page.click('.hdr-tab:has-text("Live")'); await page.waitForTimeout(250)
await page.click('.modal button:has-text("Go Live")'); await page.waitForTimeout(500)
ok('Live mode renders', await page.locator('.live').count()===1)
const c1 = await page.locator('.lb-counter').textContent()
await page.keyboard.press('Space'); await page.waitForTimeout(400)
ok('Space advances cue', c1 !== await page.locator('.lb-counter').textContent())
await page.keyboard.press('j'); await page.waitForTimeout(250)
ok('Jump modal (J)', await page.locator('.modal:has-text("Jump to Cue")').count()===1)
await page.keyboard.press('Escape'); await page.waitForTimeout(250)
ok('Escape closes Jump modal', await page.locator('.modal:has-text("Jump to Cue")').count()===0)
await page.keyboard.press('Escape'); await page.waitForTimeout(250)
ok('Exit modal', await page.locator('.modal:has-text("Exit Live Mode")').count()===1)
await page.click('.modal button:has-text("Exit to Edit")'); await page.waitForTimeout(400)
ok('Back to edit', await page.locator('.hdr-tab.active:has-text("Edit")').count()===1)

// ════════════ SUMMARY ════════════
console.log('\n──────── SUMMARY ────────')
console.log(`PASSED ${results.filter(r=>r.pass).length}/${results.length}`)
results.filter(r=>!r.pass).forEach(f=>console.log('  ❌ '+f.name+(f.extra?' ('+f.extra+')':'')))
console.log('JS ERRORS:', errors.length); errors.slice(0,8).forEach(e=>console.log('  '+e))
await browser.close()
process.exit(results.some(r=>!r.pass)||errors.length?1:0)

import { chromium } from 'playwright'
const R=[]; const ok=(n,c,x='')=>{R.push(!!c);console.log(`${c?'✅':'❌'} ${n}${x?'  ('+x+')':''}`)}
const b = await chromium.launch()
const page = await b.newContext({viewport:{width:1280,height:900}}).then(c=>c.newPage())
const errs=[]; page.on('pageerror',e=>errs.push(e.message)); page.on('dialog',d=>d.accept())
const URL='http://localhost:5180/'
const settle=()=>page.waitForTimeout(650)
const scene=()=>page.evaluate(()=>{const i=JSON.parse(localStorage.getItem('cueflow_index'));return JSON.parse(localStorage.getItem('cueflow_project_'+i[0].id)).scenes[0]})
async function dragInPara(pi,s,e){const pts=await page.evaluate(([pi,s,e])=>{const ps=document.querySelectorAll('.sv-doc p');const tn=document.createTreeWalker(ps[pi],NodeFilter.SHOW_TEXT).nextNode();const edge=(o,side)=>{const r=document.createRange();r.setStart(tn,o);r.setEnd(tn,o+1);const b=r.getClientRects()[0];return{x:side==='right'?b.right-1:b.left+1,y:b.top+b.height/2}};return{a:edge(Math.min(s,tn.length-1),'left'),b:edge(Math.min(Math.max(e-1,s),tn.length-1),'right')}},[pi,s,e]);await page.mouse.move(pts.a.x,pts.a.y);await page.mouse.down();await page.mouse.move((pts.a.x+pts.b.x)/2,pts.a.y,{steps:4});await page.mouse.move(pts.b.x,pts.b.y,{steps:4});await page.mouse.up();await page.waitForTimeout(300)}
async function cue(pi,s,e,cam,type){await dragInPara(pi,s,e);await page.locator('.assign-pop .cam-pick').nth(cam).click();await page.fill('.shot-type-input input',type);await page.click('.assign-pop button:has-text("Create Shot")');await page.waitForTimeout(300)}
async function chapter(pi,s,e){await dragInPara(pi,s,e);await page.click('.am-tab:has-text("Chapter")');await page.waitForTimeout(150);await page.click('.assign-pop button:has-text("Create Chapter")');await page.waitForTimeout(300)}

await page.goto(URL);await page.evaluate(()=>localStorage.clear());await page.goto(URL,{waitUntil:'networkidle'});await page.waitForTimeout(400)
await page.fill('.welcome input','T8');await page.click('text=Create Project');await page.waitForTimeout(500)
await page.click('.rail-btn:has-text("Import")');await page.waitForTimeout(150)
await page.click('button:has-text("Import Script")');await page.waitForTimeout(150)
await page.fill('.modal textarea','Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron.')
await page.click('text=Use pasted text');await page.waitForTimeout(150)
await page.click('.modal button:has-text("Continue")');await page.waitForTimeout(150)
await page.click('.modal button:has-text("Import Script")');await page.waitForTimeout(450)
await page.locator('.sidebar-close').click().catch(()=>{});await page.waitForTimeout(300)

await cue(0,0,5,0,'WS')        // Alpha
await cue(0,11,16,1,'CU')      // gamma
await cue(0,23,30,2,'MS')      // epsilon
await cue(0,36,39,0,'ECU')     // eta
await chapter(0,46,50)         // iota
await settle()
let s=await scene()
ok('Setup: 4 cues + 1 chapter', s.shots.length===4 && s.chapters.length===1, `shots=${s.shots.length} ch=${s.chapters.length}`)
ok('Checkboxes hidden by default (opacity 0)', await page.evaluate(()=>getComputedStyle(document.querySelector('.shot-row .row-check')).opacity)==='0')

const checks = page.locator('.shot-row .row-check')
await checks.nth(0).click({force:true}); await page.waitForTimeout(100)
await checks.nth(2).click({modifiers:['Shift'], force:true}); await page.waitForTimeout(150)
ok('Shift-click selects a range of 3', (await page.locator('.sl-batch-count').textContent()).startsWith('3'), await page.locator('.sl-batch-count').textContent())
await page.locator('.chapter-row .row-check').first().click({force:true}); await page.waitForTimeout(150)
ok('Batch bar counts 4 selected', (await page.locator('.sl-batch-count').textContent()).startsWith('4'))
ok('Selected rows highlighted', await page.locator('.shot-row.multi-sel').count()===3 && await page.locator('.chapter-row.multi-sel').count()===1)
await page.screenshot({path:'tests/shots/17-batch-select.png'})

await page.click('.sl-batchbar .btn.danger'); await page.waitForTimeout(200)
ok('Confirm modal (UI-kit) appears', await page.locator('.modal:has-text("Delete")').count()===1)
await page.click('.modal button:has-text("Delete")'); await settle()
s=await scene()
ok('Batch delete removed 3 shots', s.shots.length===1, `shots=${s.shots.length}`)
ok('Batch delete removed the chapter', s.chapters.length===0)
ok('Remaining shot renumbered to 001', s.shots[0].number===1)
ok('Selection cleared after delete', await page.locator('.sl-batchbar').count()===0)

await page.locator('.shot-row .row-check').first().click({force:true}); await page.waitForTimeout(150)
await page.keyboard.press('Delete'); await page.waitForTimeout(200)
ok('Delete key opens confirm', await page.locator('.modal:has-text("Delete")').count()===1)
await page.click('.modal button:has-text("Delete")'); await settle()
ok('Delete key removed the shot', (await scene()).shots.length===0)

console.log('JS errors:',errs.length,errs.slice(0,3))
console.log(`\nRESULT ${R.filter(Boolean).length}/${R.length}`)
await b.close()
process.exit(R.every(Boolean)&&!errs.length?0:1)

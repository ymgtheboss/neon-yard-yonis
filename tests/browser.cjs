'use strict';
// Optional real-browser smoke test. Uses an isolated, temporary Chrome profile.
const {spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),WS=require('ws');
const villageTest=process.argv.includes('--village');
const root=path.join(__dirname,'..'),port=18282,debug=18283,profile=fs.mkdtempSync(path.join(os.tmpdir(),'neon-subzero-browser-'));
const server=spawn(process.execPath,[path.join(root,'server.cjs')],{env:{...process.env,PORT:String(port),ROUND_MS:'20000',WORLD_MAP:villageTest?'village':'subzero'},stdio:['ignore','pipe','pipe']});
let serverLog='';server.stdout.on('data',b=>serverLog+=b);server.stderr.on('data',b=>serverLog+=b);
let browser,ws,serial=0;const bots=[];const pending=new Map(),errors=[];const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<300;i++){try{const v=await fn();if(v)return v;}catch{}await delay(200);}throw Error('Timed out: '+label);}
function call(method,params={}){return new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
(async()=>{
 await until(async()=>(await fetch(`http://127.0.0.1:${port}`)).ok,'game server');
 browser=spawn(process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl',`--remote-debugging-port=${debug}`,`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-timer-throttling','--window-size=1440,900','about:blank'],{stdio:'ignore'});
 const target=await until(async()=>(await (await fetch(`http://127.0.0.1:${debug}/json/list`)).json()).find(t=>t.type==='page'),'Chrome debugger');
 ws=new WS(target.webSocketDebuggerUrl);await new Promise(r=>ws.once('open',r));ws.on('message',raw=>{const m=JSON.parse(raw);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);});
 await call('Runtime.enable');await call('Page.enable');
 await call('Page.addScriptToEvaluateOnNewDocument',{source:"window.__socketCloses=[];const NativeSocket=window.WebSocket;window.WebSocket=class extends NativeSocket{constructor(...args){super(...args);this.addEventListener('close',e=>window.__socketCloses.push({code:e.code,reason:e.reason}));}};"});
 if(process.argv.includes('--presentation')){
  await call('Fetch.enable',{patterns:[{urlPattern:'http://127.0.0.1:'+port+'/',requestStage:'Request'}]});
  ws.on('message',async raw=>{const m=JSON.parse(raw);if(m.method!=='Fetch.requestPaused')return;try{
   const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace('</script>\n</body>',fs.readFileSync(path.join(__dirname,'presentation-hook.js'),'utf8')+'\n</script>\n</body>');
   await call('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/html'}],body:Buffer.from(html).toString('base64')});
  }catch(e){errors.push(String(e));}});
 }
 await call('Page.navigate',{url:`http://127.0.0.1:${port}`});
 await until(()=>evaluate(`document.getElementById('joinMessage')?.textContent==='${villageTest?'Bellhaven':'Subzero'} ready'`),'Subzero GLB, textures and collision loading');
 await until(()=>evaluate("window.weaponAssets?.loaded===10"),'all ten imported weapon models');
 await evaluate("document.getElementById('quality').value='performance';document.getElementById('quality').onchange()");
 if(process.argv.includes('--presentation'))await call('Fetch.disable');
 assert.deepEqual(await evaluate('window.weaponAssets.errors'),[]);
 if(process.argv.includes('--presentation')){fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});const data=await evaluate('window.renderPresentationGallery()');fs.writeFileSync(path.join(__dirname,'artifacts/reload-gallery.png'),Buffer.from(data,'base64'));console.log('PASS actual first-person reload poses render for six weapon families');await call('Page.navigate',{url:`http://127.0.0.1:${port}`});await until(()=>evaluate("document.getElementById('joinMessage')?.textContent==='Subzero ready'&&window.weaponAssets?.loaded===10"),'fresh production page after pose capture');}

 if(process.argv.includes('--menu')){
  fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});
  if(process.argv.includes('--build-previews')){
   const previews=await evaluate(fs.readFileSync(path.join(__dirname,'menu-previews.js'),'utf8'));
   for(const [id,data]of Object.entries(previews))fs.writeFileSync(path.join(root,'public/maps',id+'-preview.jpg'),Buffer.from(data,'base64'));
   await call('Page.navigate',{url:`http://127.0.0.1:${port}`});
   await until(()=>evaluate("document.getElementById('joinMessage')?.textContent==='Subzero ready'"),'menu reload');
  }
  for(const mobile of [false,true]){
   await call('Emulation.setDeviceMetricsOverride',{width:mobile?390:1440,height:mobile?844:900,deviceScaleFactor:1,mobile});
   await delay(300);assert.equal(await evaluate('window.innerWidth'),mobile?390:1440,'viewport matches device');
   for(const page of ['Home','Weapons','Loadout','Skins','Maps']){
    await evaluate(`document.getElementById('nav${page}').click()`);await delay(350);
    assert.equal(await evaluate(`!document.getElementById('menu${page}').classList.contains('hidden')`),true);
    assert.equal(await evaluate("document.getElementById('menu').scrollWidth<=document.getElementById('menu').clientWidth"),true,'no horizontal overflow '+page);
    const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(__dirname,'artifacts',`menu-${mobile?'mobile':'desktop'}-${page.toLowerCase()}.png`),Buffer.from(shot.data,'base64'));
   }
  }
  await evaluate("document.getElementById('navLoadout').click();document.getElementById('menuLoadoutSlots').querySelector('button').click()");
  assert.equal(await evaluate("!document.getElementById('menuWeapons').classList.contains('hidden')"),true);
  await evaluate("document.getElementById('weaponsBack').click()");
  assert.equal(await evaluate("!document.getElementById('menuHome').classList.contains('hidden')"),true);
  await evaluate("document.getElementById('navMaps').click();document.getElementById('menuMapCards').children[1].click();document.getElementById('join').click()");
  await until(()=>evaluate("document.getElementById('mapLoadStatus').textContent.includes('Bellhaven')&&!document.getElementById('start').disabled"),'chosen map applied for new host');
  assert.deepEqual(errors,[]);console.log('PASS five menu pages at desktop/mobile sizes, no horizontal overflow, loadout navigation, back button, and selected map applied when joining');return;
 }
 if(villageTest){
  fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});
  await evaluate("document.getElementById('join').click()");
  await until(()=>evaluate("!document.getElementById('room').classList.contains('hidden')&&!document.getElementById('start').disabled"),'village host ready');
  for(const [id,name]of [['subzero','Subzero'],['village','Bellhaven']]){
   await evaluate(`(()=>{const s=document.getElementById('mapSelect');s.value='${id}';s.onchange();})()`);
   await until(()=>evaluate(`document.getElementById('mapLoadStatus').textContent.includes('${name}')&&document.getElementById('mapLoadStatus').textContent.includes('1/1')&&!document.getElementById('start').disabled`),name+' switch ready');
  }
  console.log('PASS host switches Bellhaven → Subzero → Bellhaven in the lobby without reconnecting');
  await evaluate("document.getElementById('start').click()");
  await until(()=>evaluate("!document.getElementById('resume').classList.contains('hidden')"),'village round running');
  const pose=await evaluate("(()=>{const r=document.getElementById('resume').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
  await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...pose});await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...pose});
  await delay(800);await evaluate("document.getElementById('room').classList.add('hidden')");
  const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(__dirname,'artifacts/village-game.png'),Buffer.from(shot.data,'base64'));
  await until(()=>evaluate("document.getElementById('boardTitle').textContent==='Round complete.'"),'village results');
  assert.deepEqual(errors,[]);console.log('PASS Bellhaven GLB, textures, collision, in-game map selection and round results in Chrome');
  const shots=await evaluate(fs.readFileSync(path.join(__dirname,'village-gallery.js'),'utf8'));for(const [name,data]of Object.entries(shots))fs.writeFileSync(path.join(__dirname,'artifacts/village-'+name+'.png'),Buffer.from(data,'base64'));
  return;
 }
 if(!process.argv.includes('--quick')){
 const gallery=await evaluate(fs.readFileSync(path.join(__dirname,'weapon-gallery.js'),'utf8'));
 fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});fs.writeFileSync(path.join(__dirname,'artifacts/weapon-gallery.png'),Buffer.from(gallery.data,'base64'));
 assert.equal(gallery.stats.length,10);for(const item of gallery.stats){assert.ok(item.calls<=32,item.id+' draw calls');assert.ok(item.triangles>0,item.id+' triangles');}console.log('PASS all ten textured GLBs render in hip-fire and ADS poses; shared assets survive disposal',gallery.stats);
 }
 const menuShot=await call('Page.captureScreenshot',{format:'png'});fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});fs.writeFileSync(path.join(__dirname,'artifacts/combat-menu.png'),Buffer.from(menuShot.data,'base64'));
 for(const [i,gun]of ['pistol','shotgun','sniper','smg','revolver','lmg','dmr','carbine','autoshot'].entries()){
  const bot=new WS(`ws://127.0.0.1:${port}`);bots.push(bot);bot.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='welcome'||m.type==='mapChanged')bot.send(JSON.stringify({type:'mapReady',mapId:m.mapId,mapEpoch:m.mapEpoch}));});await new Promise(r=>bot.once('open',r));bot.send(JSON.stringify({type:'join',name:'Operator '+(i+1),skin:['ember','arctic','royal'][i%3],loadout:[gun,'rifle'],grenades:['frag','medkit']}));
 }
 await evaluate("document.getElementById('join').click()");await until(()=>evaluate("!document.getElementById('room').classList.contains('hidden')"),'join lobby');await until(()=>evaluate('window.combatAudio?.loaded===24'),'24 recorded audio buffers decoded');console.log('PASS all 24 recorded combat and footstep clips decode in Chrome');bots[0].send(JSON.stringify({type:'start'}));await delay(1500);for(const bot of bots)bot.send(JSON.stringify({type:'input',fire:true,yaw:0,pitch:0}));
 const resume=await evaluate("(()=>{const r=document.getElementById('resume').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
 await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...resume});
 await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...resume});
 await call('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW'});await delay(1200);await call('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW'});
 const telemetry=await evaluate("document.getElementById('network').textContent");
 // Headless mouse capture is platform-dependent; hide a remaining pause panel only for the visual artifact.
 await evaluate("document.getElementById('room').classList.add('hidden')");
 const screenshot=await call('Page.captureScreenshot',{format:'png'});fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});fs.writeFileSync(path.join(__dirname,'artifacts/subzero-browser.png'),Buffer.from(screenshot.data,'base64'));
 await until(()=>evaluate("document.getElementById('boardTitle')?.textContent==='Round complete.'&&!document.getElementById('board').classList.contains('hidden')"),'end of round results');
 await until(()=>evaluate("document.getElementById('winnerModel').querySelector('canvas')!==null"),'winner character render');assert.equal(await evaluate("document.getElementById('voteChoices').children.length"),2);
 const results=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(__dirname,'artifacts/combat-results.png'),Buffer.from(results.data,'base64'));
 assert.deepEqual(errors,[]);console.log('PASS Chrome loads the armory and operator preview, renders all ten weapon types in multiplayer, and displays round results without uncaught JavaScript errors');console.log('Software-rendered browser telemetry (not hardware FPS):',telemetry);console.log('Screenshot: tests/artifacts/subzero-browser.png');
})().catch(async e=>{console.error(e,errors,serverLog);if(ws?.readyState===1){try{console.error('Page state:',await evaluate("({closes:window.__socketCloses,message:document.getElementById('joinMessage')?.textContent,room:document.getElementById('room')?.className,join:document.getElementById('join')?.outerHTML,body:document.body.innerText.slice(-1200)})"));}catch{}}process.exitCode=1;}).finally(()=>{for(const bot of bots)bot.terminate();ws?.close();browser?.kill();server.kill();});

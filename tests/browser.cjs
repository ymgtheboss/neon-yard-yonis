'use strict';
// Optional real-browser smoke test. Uses an isolated, temporary Chrome profile.
const {spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),WS=require('ws');
const root=path.join(__dirname,'..'),port=18282,debug=18283,profile=fs.mkdtempSync(path.join(os.tmpdir(),'neon-subzero-browser-'));
const server=spawn(process.execPath,[path.join(root,'server.cjs')],{env:{...process.env,PORT:String(port)},stdio:'ignore'});
let browser,ws,serial=0;const pending=new Map(),errors=[];const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<150;i++){try{const v=await fn();if(v)return v;}catch{}await delay(200);}throw Error('Timed out: '+label);}
function call(method,params={}){return new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;}
(async()=>{
 await until(async()=>(await fetch(`http://127.0.0.1:${port}`)).ok,'game server');
 browser=spawn(process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl',`--remote-debugging-port=${debug}`,`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-timer-throttling','--window-size=1440,900','about:blank'],{stdio:'ignore'});
 const target=await until(async()=>(await (await fetch(`http://127.0.0.1:${debug}/json/list`)).json()).find(t=>t.type==='page'),'Chrome debugger');
 ws=new WS(target.webSocketDebuggerUrl);await new Promise(r=>ws.once('open',r));ws.on('message',raw=>{const m=JSON.parse(raw);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);});
 await call('Runtime.enable');await call('Page.enable');await call('Page.navigate',{url:`http://127.0.0.1:${port}`});
 await until(()=>evaluate("document.getElementById('joinMessage')?.textContent==='Subzero ready'"),'Subzero GLB, textures and collision loading');
 await evaluate("document.getElementById('join').click()");await until(()=>evaluate("!document.getElementById('room').classList.contains('hidden')"),'join lobby');await evaluate("document.getElementById('start').click()");await delay(1500);
 const resume=await evaluate("(()=>{const r=document.getElementById('resume').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
 await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...resume});
 await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...resume});
 await call('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW'});await delay(1200);await call('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW'});
 const telemetry=await evaluate("document.getElementById('network').textContent");
 // Headless mouse capture is platform-dependent; hide a remaining pause panel only for the visual artifact.
 await evaluate("document.getElementById('room').classList.add('hidden')");
 const screenshot=await call('Page.captureScreenshot',{format:'png'});fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});fs.writeFileSync(path.join(__dirname,'artifacts/subzero-browser.png'),Buffer.from(screenshot.data,'base64'));
 assert.deepEqual(errors,[]);console.log('PASS Chrome loads the Subzero map and textures, joins multiplayer and starts a round without uncaught JavaScript errors');console.log('Software-rendered browser telemetry (not hardware FPS):',telemetry);console.log('Screenshot: tests/artifacts/subzero-browser.png');
})().catch(e=>{console.error(e,errors);process.exitCode=1;}).finally(()=>{ws?.close();browser?.kill();server.kill();});

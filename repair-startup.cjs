'use strict';
// Run beside index.html. The original is backed up before an atomic replacement.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const file=path.join(__dirname,'index.html');
function fail(s){console.error(s);process.exit(1)}
if(!fs.existsSync(file))fail('Move repair-startup.cjs into your neon-yard-mill-district folder, then run it again.');
const original=fs.readFileSync(file,'utf8');
if(original.includes('NEON_STARTUP_REPAIR_V1')){console.log('Startup repair is already installed. Run node server.cjs and refresh the browser.');process.exit(0)}
const target="const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});";
if(!original.includes(target)||!original.includes('<script type="module">'))fail('This repair expects the Mill District version. No files changed.');
const bootstrap=String.raw`<script>
// NEON_STARTUP_REPAIR_V1: report initialization failures before any game imports run.
(function(){
 const join=document.getElementById('join');
 const message=document.getElementById('joinMessage');
 const panel=document.createElement('div');
 panel.style.cssText='display:none;padding:14px;margin-top:12px;background:#442c22;color:#fff0db;border:1px solid #d0a16f;line-height:1.5;max-height:220px;overflow:auto';
 const title=document.createElement('b'),info=document.createElement('div'),detail=document.createElement('pre'),retry=document.createElement('button');
 detail.style.cssText='font:12px monospace;white-space:pre-wrap;overflow-wrap:anywhere;user-select:text';
 retry.textContent='Retry with lighter graphics';retry.style.marginTop='8px';
 retry.onclick=function(){const url=new URL(location.href);url.searchParams.set('safe','1');location.href=url.href};
 panel.append(title,info,detail,retry);message.append(panel);
 let stage='Loading game modules',ready=false,failed=false;
 join.disabled=true;join.textContent='LOADING GAME…';
 // Basic settings navigation remains available even if graphics cannot start.
 document.getElementById('openSettings').onclick=function(){document.getElementById('settings').classList.remove('hidden')};
 document.getElementById('closeSettings').onclick=function(){document.getElementById('settings').classList.add('hidden')};
 function report(error){
  if(failed)return;failed=true;panel.style.display='block';
  title.textContent=ready?'The game encountered an error.':'The game could not finish starting.';
  info.textContent='Screenshot the message below so we can identify the cause. The server does not need reinstalling.';
  detail.textContent='Stage: '+stage+'\n'+String(error&&error.message||error)+'\nBrowser: '+navigator.userAgent;
  if(!ready){join.disabled=true;join.textContent='STARTUP FAILED';}
 }
 window.NeonBoot={stage:function(s){stage=s},fail:report,ready:function(){ready=true;stage='Running';if(!failed){join.disabled=false;join.textContent='ENTER ARENA →';panel.style.display='none'}}};
 window.addEventListener('error',function(e){if(e.message||e.error)report(e.error||e.message);else if(e.target&&e.target.tagName==='SCRIPT')report('A game script could not load. Open this game through http://localhost:8000.');},true);
 window.addEventListener('unhandledrejection',function(e){report(e.reason||'An asynchronous startup operation failed.');});
 setTimeout(function(){if(!ready&&!failed)report('The game did not finish loading. Check that node server.cjs is still running, then refresh.');},20000);
})();
</script>
`;
const renderer=String.raw`window.NeonBoot?.stage('Starting 3D graphics');
function createGameRenderer(){
 const safe=new URLSearchParams(location.search).get('safe')==='1';
 const attempts=safe?[{antialias:false,powerPreference:'default'}]:[
  {antialias:true,powerPreference:'high-performance'},
  {antialias:false,powerPreference:'default'}
 ];
 const errors=[];
 for(let i=0;i<attempts.length;i++){
  try{
   const r=new THREE.WebGLRenderer(attempts[i]);
   if(safe||i>0){settings.quality='performance';settings.shadows='off';settings.resolution=.75;}
   r.domElement.addEventListener('webglcontextlost',function(e){e.preventDefault();window.NeonBoot?.fail('The browser lost its 3D graphics context. Close other graphics-heavy tabs and refresh.');});
   return r;
  }catch(error){errors.push(error.message||String(error));}
 }
 throw new Error('Could not start WebGL 2 graphics. '+errors.join(' / '));
}
const renderer=createGameRenderer();
window.NeonBoot?.stage('Building map graphics');`;
let result=original.replace('<script type="module">',bootstrap+'<script type="module">').replace(target,renderer);
result=result.replace('// Character meshes.',"window.NeonBoot?.stage('Preparing controls and player models');\n// Character meshes.");
result=result.replace('requestAnimationFrame(frame);\n\nwindow.addEventListener',"window.NeonBoot?.ready();\nrequestAnimationFrame(frame);\n\nwindow.addEventListener");
if(!result.includes('window.NeonBoot?.ready();'))fail('Could not locate startup completion. No files changed.');
new vm.Script(bootstrap.split('<script>')[1].split('</script>')[0]);
const code=result.split('<script type="module">')[1].split('</script>')[0];
const check=spawnSync(process.execPath,['--input-type=module','--check'],{input:code,encoding:'utf8'});
if(check.status!==0)fail('Syntax check failed. No files changed.\n'+check.stderr);
const backup=file+'.before-startup-repair-'+Date.now();
fs.copyFileSync(file,backup,fs.constants.COPYFILE_EXCL);
const temp=file+'.startup-repair.tmp';
try{fs.writeFileSync(temp,result,{flag:'wx'});fs.renameSync(temp,file)}catch(e){if(fs.existsSync(temp))fs.unlinkSync(temp);fail('Could not save repair: '+e.message)}
console.log('STARTUP REPAIR INSTALLED');
console.log('Backup: '+path.basename(backup));
console.log('Run: node server.cjs');
console.log('Then reload http://localhost:8000. If an error appears, send a screenshot of that message.');

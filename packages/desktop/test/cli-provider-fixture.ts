export const script = `
import {appendFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline';
import {spawn} from 'node:child_process';
const root=dirname(fileURLToPath(import.meta.url));
const log=value=>appendFileSync(join(root,'events.ndjson'),JSON.stringify(value)+'\\n');
const send=value=>process.stdout.write(JSON.stringify(value)+'\\n');
log({kind:'spawn',pid:process.pid,argv:process.argv.slice(2),cwd:process.cwd(),resources:{lease:process.env.HARNESS_RESOURCE_LEASE,cpus:process.env.HARNESS_RESOURCE_CPUS,threads:process.env.CARGO_BUILD_JOBS},env:Object.keys(process.env).filter(k=>/^(OPENAI_API_KEY|OPENAI_BASE_URL|ANTHROPIC_API_KEY|ANTHROPIC_BASE_URL)$/.test(k))});
if(process.argv.includes('--version')){console.log('fixture 1.0');process.exit(0);}
if(process.argv.includes('auth')){send({loggedIn:true,authMethod:'claude.ai'});process.exit(0);}
function hang(){const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});log({kind:'owned',pid:child.pid});setInterval(()=>{},1000);}
if(mode.startsWith('claude')){
 let input='';process.stdin.on('data',chunk=>input+=chunk);process.stdin.on('end',()=>{
 log({kind:'prompt',input});send({type:'system',subtype:'init',model:mode.endsWith('mismatch')?'other':'selected'});
 if(mode.endsWith('hang')){hang();return;}
 send({type:'assistant',message:{content:[{type:'thinking',thinking:'PRIVATE_REASONING'},{type:'tool_use',name:'Read',input:{secret:'PRIVATE_TOOL'}},{type:'text',text:'Public answer'}]}});
 send({type:'result',is_error:mode.endsWith('error'),result:mode.endsWith('error')?'Fixture failure':'Public answer'});
 });
}else{
 createInterface({input:process.stdin}).on('line',line=>{
 const msg=JSON.parse(line);log({kind:'rpc',...msg});const reply=result=>send({id:msg.id,result});
 const event=(method,params)=>send({method,params:{threadId:'thread-fixture',...params}});
 if(msg.method==='initialize')reply({userAgent:'fixture'});
 if(msg.method==='account/read')reply({account:{type:'chatgpt'}});
 if(msg.method==='model/list')reply({data:[{model:'selected',displayName:'Selected',hidden:false,supportedReasoningEfforts:[{reasoningEffort:'high'}],defaultReasoningEffort:'high',isDefault:true},{model:'hidden',hidden:true}]});
 if(msg.method==='modelProvider/capabilities/read')reply({imageGeneration:true});
 if(msg.method==='thread/start')reply({thread:{id:'thread-fixture'},model:mode.endsWith('mismatch')?'other':'selected',modelProvider:'openai'});
 if(msg.method==='turn/interrupt')reply({});
 if(msg.method==='turn/start'){
 reply({turn:{id:'turn-fixture'}});
 if(mode.endsWith('hang')){hang();return;}
 event('item/completed',{item:{type:'reasoning',text:'PRIVATE_REASONING'}});
 event('item/completed',{item:{type:'agentMessage',text:'Public answer'}});
 if(mode.endsWith('image'))event('item/completed',{item:{type:'imageGeneration',status:'completed',result:png,revisedPrompt:'Revised prompt'}});
 if(mode.endsWith('error')){event('error',{error:{message:'Fixture failure'},willRetry:false});return;}
 event('turn/completed',{turn:{status:'completed'}});
 }
 });
}
`;

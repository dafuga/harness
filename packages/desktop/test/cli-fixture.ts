import { ResourceQueueService } from '../../../src/services/ResourceQueueService';
import { snapshot } from '../../../test/support/resourceFixture';
export const resourceTelemetry = { pressure: false };
import { afterEach, vi } from 'vitest';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import process from 'node:process';
import { CodexAppServerAdapter } from '../src/adapters/CodexAppServerAdapter';
import { ClaudeCliAdapter } from '../src/adapters/ClaudeCliAdapter';
import type { AgentTurn } from '../src/models/AgentRunner.types';
const queues: ResourceQueueService[] = [];
const roots: string[] = [],
	pids: number[] = [];
export { pids };
export const png =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=';
const script = `
import {appendFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline';
import {spawn} from 'node:child_process';
const root=dirname(fileURLToPath(import.meta.url));
const log=value=>appendFileSync(join(root,'events.ndjson'),JSON.stringify(value)+'\\n');
const send=value=>process.stdout.write(JSON.stringify(value)+'\\n');
log({kind:'spawn',pid:process.pid,argv:process.argv.slice(2),cwd:process.cwd(),resources:{lease:process.env.HARNESS_RESOURCE_LEASE,cpus:process.env.HARNESS_RESOURCE_CPUS},env:Object.keys(process.env).filter(k=>/^(OPENAI_API_KEY|OPENAI_BASE_URL|ANTHROPIC_API_KEY|ANTHROPIC_BASE_URL)$/.test(k))});
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
interface Event {
	kind: string;
	pid?: number;
	argv?: string[];
	cwd?: string;
	env?: string[];
	resources?: { lease?: string; cpus?: string };
	method?: string;
	params?: Record<string, unknown>;
	input?: string;
}
afterEach(async () => {
	queues.splice(0).forEach((queue) => queue.close());
	resourceTelemetry.pressure = false;
	vi.unstubAllEnvs();
	for (const pid of pids.splice(0)) {
		try {
			process.kill(pid, 'SIGKILL');
		} catch {
			/* Fixture already stopped. */
		}
	}
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
export async function fixture(mode: string) {
	for (const key of 'OPENAI_API_KEY OPENAI_BASE_URL ANTHROPIC_API_KEY ANTHROPIC_BASE_URL'.split(
		' '
	))
		vi.stubEnv(key, 'fixture-sentinel');
	const root = await realpath(await mkdtemp(join(tmpdir(), 'harness-cli-')));
	roots.push(root);
	vi.stubEnv('HARNESS_RESOURCES_HOME', join(root, 'resources'));
	vi.stubEnv('HARNESS_RESOURCE_LEASE', '');
	const path = join(root, 'fake.mjs');
	const config = `const mode=${JSON.stringify(mode)},png=${JSON.stringify(png)};`;
	await writeFile(path, config + '\n' + script);
	const command = { command: process.execPath, args: [path] };
	const queue = new ResourceQueueService({
		home: join(root, 'resources'),
		env: {},
		monitor: {
			sample: async () =>
				snapshot({ memoryPressure: resourceTelemetry.pressure ? 'critical' : 'normal' })
		}
	});
	queues.push(queue);
	const adapter = mode.startsWith('codex')
		? new CodexAppServerAdapter(command, queue)
		: new ClaudeCliAdapter(command, queue);
	const events = async (): Promise<Event[]> => {
		try {
			return (await readFile(join(root, 'events.ndjson'), 'utf8'))
				.trim()
				.split('\n')
				.map((line) => JSON.parse(line));
		} catch {
			return [];
		}
	};
	return { root, command, adapter, events, queue };
}
export function turn(cwd: string, signal = new AbortController().signal): AgentTurn {
	return {
		cwd,
		signal,
		model: 'selected',
		effort: 'high',
		prompt: 'Requested task',
		access: 'read-only',
		onText: vi.fn(),
		onStatus: vi.fn()
	};
}
export function alive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

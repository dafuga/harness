import { mkdtemp, mkdir, writeFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GitAdapter } from '../../src/adapters/git-source-history/GitAdapter';
import { runHarness } from './cli';

export async function moduleTaskFixture() {
	const root = await mkdtemp(join(tmpdir(), 'harness-module-tasks-'));
	const git = new GitAdapter(root);
	await git.run(['init', '-q']);
	await git.run(['config', 'user.name', 'Task fixture']);
	await git.run(['config', 'user.email', 'fixture@example.invalid']);
	await mkdir(join(root, 'specification/units'), { recursive: true });
	await mkdir(join(root, 'src'));
	await writeFile(join(root, 'src/orders.ts'), 'export const orders = 1;\n');
	const unit = {
		schemaVersion: 1,
		id: 'service.orders',
		kind: 'service',
		title: 'Orders',
		responsibility: 'Maintain the complete order lifecycle.',
		responsibilityOrigin: 'declared',
		status: 'active',
		owns: { source: ['src/orders.ts'], symbols: ['orders'] },
		contract: {
			origin: 'declared',
			inputs: [],
			outputs: [{ name: 'orders', type: 'number' }],
			errors: []
		},
		dependencies: [],
		runtime: {
			kind: 'module',
			entry: 'src/orders.ts',
			targets: [{ kind: 'module', entry: 'src/orders.ts' }]
		},
		scenarios: [],
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
	};
	await writeFile(join(root, 'specification/units/service.orders.json'), JSON.stringify(unit));
	await git.run(['add', '.']);
	await git.run(['commit', '-qm', 'feat: add orders module']);
	const source = await git.run(['rev-parse', 'HEAD']);
	const bin = join(root, 'fixture-bin');
	await mkdir(bin);
	for (const provider of ['claude', 'codex']) {
		const file = join(bin, provider);
		await writeFile(file, fakeRunner(root, provider));
		await chmod(file, 0o755);
	}
	const cli = (args: string[], success = true) =>
		runHarness(['task', ...args], root, success, { PATH: `${bin}:${process.env.PATH}` });
	const input = async (extra: Record<string, unknown> = {}) => {
		const file = join(root, 'task-input.json');
		await writeFile(
			file,
			JSON.stringify({
				id: 'orders-validation',
				title: 'Validate orders',
				feature: 'checkout',
				module: 'service.orders',
				instructions: 'Implement the wanted contract.',
				wantedContract: {
					responsibility: 'Reject empty orders.',
					inputs: [],
					outputs: [{ name: 'orders', type: 'number' }],
					errors: [{ name: 'empty-order', type: 'Error' }]
				},
				...extra
			})
		);
		return file;
	};
	const feature = () =>
		cli([
			'feature',
			'checkout',
			'--goal',
			'Make checkout reliable.',
			'--tldr',
			'Build validated orders and payment handling.'
		]);
	return {
		root,
		git,
		source,
		cli,
		input,
		feature,
		dispose: () => rm(root, { recursive: true, force: true })
	};
}

function fakeRunner(root: string, provider: string): string {
	return `#!/usr/bin/env bun
import {readFileSync,appendFileSync,writeFileSync,existsSync} from 'node:fs';
const root=${JSON.stringify(root)}, provider=${JSON.stringify(provider)};
const prompt=await Bun.stdin.text();
const args=process.argv.slice(2), model=args[args.indexOf(provider==='claude'?'--model':'-m')+1];
appendFileSync(root+'/calls.ndjson',JSON.stringify({provider,args,prompt,cwd:process.cwd()})+'\\n');
const mode=existsSync(root+'/mode')?readFileSync(root+'/mode','utf8'):'';
if(provider==='claude'&&mode==='quota') { console.log(JSON.stringify({type:'rate_limit_event',rate_limit_info:{status:'rejected',resetsAt:2000000000}})); console.log(JSON.stringify({type:'result',is_error:true,result:'Quota exhausted'})); process.exit(1); }
if(provider==='claude'&&mode==='auth') {console.log(JSON.stringify({type:'result',is_error:true,result:'Authentication required'}));process.exit(1);}
if(mode==='outside') writeFileSync('outside.txt','outside requested module');
else writeFileSync('src/orders.ts','export const orders = 2;\\n');
if(provider==='claude') {console.log(JSON.stringify({type:'system',subtype:'init',model}));console.log(JSON.stringify({type:'result',subtype:'success',is_error:false,result:'Implemented order validation.',modelUsage:{[model]:{}}}));}
else { console.log(JSON.stringify({type:'thread.started',thread_id:'fixture-session'})); console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Implemented order validation.'}})); console.log(JSON.stringify({type:'turn.completed',model})); }
`;
}

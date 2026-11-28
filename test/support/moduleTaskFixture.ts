import { mkdtemp, mkdir, writeFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GitAdapter } from '../../src/adapters/git-source-history/GitAdapter';
import { runHarness } from './cli';

export async function moduleTaskFixture(completion?: unknown) {
	const root = await mkdtemp(join(tmpdir(), 'harness-module-tasks-'));
	const git = new GitAdapter(root);
	await git.run(['init', '-q']);
	await git.run(['config', 'user.name', 'Task fixture']);
	await git.run(['config', 'user.email', 'fixture@example.invalid']);
	await writeOrdersModule(root);
	await writeCompletionFixture(root, completion);
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
	const tracker = join(bin, 'tracker');
	await writeFile(
		tracker,
		`#!/usr/bin/env bun
import {appendFileSync} from 'node:fs';
appendFileSync(${JSON.stringify(join(root, 'tracker.ndjson'))}, JSON.stringify(process.argv.slice(2))+'\\n');
`
	);
	await chmod(tracker, 0o755);
	const cli = (args: string[], success = true) =>
		runHarness(['task', ...args], root, success, {
			PATH: `${bin}:${process.env.PATH}`,
			...stubTaskBudget
		});
	const input = (extra: Record<string, unknown> = {}) => taskInput(root, extra);
	const feature = (success = true) =>
		cli(
			[
				'feature',
				'checkout',
				'--goal',
				'Make checkout reliable.',
				'--tldr',
				'Build validated orders and payment handling.'
			],
			success
		);
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

/**
 * The fake CLIs only write a few bytes, so they request a budget that fits inside the
 * smallest stock check lease (1 CPU / 512 MiB). The production default stays 2048 MiB.
 */
const stubTaskBudget = { HARNESS_TASK_CPUS: '1', HARNESS_TASK_MEMORY_MIB: '256' };

function fakeRunner(root: string, provider: string): string {
	return `#!/usr/bin/env bun
import {readFileSync,appendFileSync,writeFileSync,existsSync} from 'node:fs';
const root=${JSON.stringify(root)}, provider=${JSON.stringify(provider)};
const prompt=await Bun.stdin.text();
const args=process.argv.slice(2), model=args[args.indexOf(provider==='claude'?'--model':'-m')+1];
appendFileSync(root+'/calls.ndjson',JSON.stringify({provider,args,prompt,cwd:process.cwd()})+'\\n');
const mode=existsSync(root+'/mode')?readFileSync(root+'/mode','utf8'):'';
const check = prompt.match(/^Harness completion check: ([a-z0-9-]+)$/m)?.[1];
const conciseOrders = 'export function orders(valid=true){\\nif(valid)return 2;\\nreturn 0;\\n}\\n';
const conciseTests = "import {test,expect} from 'bun:test';\\nimport {orders} from './orders';\\ntest('orders',()=>{expect(orders(true)).toBe(2);expect(orders(false)).toBe(0)});\\n";
let summary = 'Implemented order validation.';
if (mode.startsWith('completion-')) {
  if (check === 'reduce-module-bytes') {
    writeFileSync('src/orders.ts', conciseOrders);
    writeFileSync('src/orders.test.ts', mode === 'completion-coverage-loss'
      ? conciseTests.replace('expect(orders(false)).toBe(0)', '') : conciseTests);
    if (mode === 'completion-test-failure') writeFileSync('src/orders.ts', conciseOrders.replace('return 2', 'return 3'));
    summary = 'Removed redundant comments and condensed test layout.';
  } else if (check === 'simplify-contract') {
    writeFileSync('contract.md', 'Validate before storing orders.\\n');
    summary = 'Combined duplicate validation rules.';
  } else if (!check && mode === 'completion-measurement-unavailable') {
    const original = readFileSync('src/orders.test.ts','utf8');
    writeFileSync('src/orders.test.ts', original + "\nif (process.env.HARNESS_COMPLETION_LCOV) throw new Error('Coverage runner unavailable');\n");
  } else if (!check && mode === 'completion-orchestrator') {
    writeFileSync('contract.md', 'Validate before storing orders.\\nOrders must be validated before storage.\\n');
  }
}
if (mode.startsWith('context-')) {
  const checkpoint=prompt.match(/^Checkpoint file: (.+)$/m)?.[1];
  if (!checkpoint || !existsSync(checkpoint)) {
    if (checkpoint) writeFileSync(checkpoint,'Verified orders fixture. Next: update orders.');
    const input=mode==='context-worker'?154000:mode==='context-preflight'?137000:900;
    console.log(JSON.stringify({type:'assistant',message:{id:'first',usage:{input_tokens:input,cache_read_input_tokens:1000,cache_creation_input_tokens:0,output_tokens:10}}}));
    if (mode==='context-preflight') {
      const origin=process.env.ANTHROPIC_BASE_URL;
      if (!origin) process.exit(11);
      await fetch(origin+'/v1/messages',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'aA9!+'.repeat(27000)}]})}).catch(()=>{});
      process.exit(12);
    }
    await Bun.sleep(3500);
    process.exit(7);
  }
  if (!prompt.includes('Verified orders fixture. Next: update orders.')) process.exit(8);
  if (mode!=='context-worker' && !existsSync(root+'/tracker.ndjson')) process.exit(9);
}
if(provider==='codex'&&mode==='codex-quota') { console.log(JSON.stringify({type:'turn.failed',error:{message:"You've hit your usage limit. Try again later."}})); process.exit(1); }
if(provider==='claude'&&mode==='quota') { console.log(JSON.stringify({type:'rate_limit_event',rate_limit_info:{status:'rejected',resetsAt:2000000000}})); console.log(JSON.stringify({type:'result',is_error:true,result:'Quota exhausted'})); process.exit(1); }
if(provider==='claude'&&mode==='auth') {console.log(JSON.stringify({type:'result',is_error:true,result:'Authentication required'}));process.exit(1);}
if(mode==='outside') writeFileSync('outside.txt','outside requested module');
else if(!mode.startsWith('completion-')) writeFileSync('src/orders.ts','export const orders = 2;\\n');
const response = check ? JSON.stringify({status: check==='security-review'||mode==='completion-provider-rejected'?'failed':'passed',summary}) : summary;
if(provider==='claude') {console.log(JSON.stringify({type:'system',subtype:'init',model}));console.log(JSON.stringify({type:'result',subtype:'success',is_error:false,result:response,usage:{input_tokens:70,output_tokens:20,cache_read_input_tokens:30,cache_creation_input_tokens:0,cache_creation:{ephemeral_1h_input_tokens:0}},total_cost_usd:0.002,modelUsage:{[model]:{}}}));}
${fakeCodexCompletion()}
`;
}

function fakeCodexCompletion(): string {
	return `else {
  console.log(JSON.stringify({type:'thread.started',thread_id:'fixture-session'}));
  if (check) console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Reviewing the submitted changes.'}}));
  console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:response}}));
  console.log(JSON.stringify({type:'turn.completed',model,usage:{input_tokens:100,output_tokens:20,cached_input_tokens:30}}));
}
`;
}

async function writeCompletionFixture(root: string, completion: unknown): Promise<void> {
	const disabled = [
		{ name: 'reduce-module-bytes', scope: 'module', enabled: false },
		{ name: 'simplify-contract', scope: 'orchestrator', enabled: false }
	];
	await writeFile(
		join(root, 'harness.completion.json'),
		JSON.stringify(completion ?? { checks: disabled })
	);
	if (!completion) return;
	await writeFile(
		join(root, 'src/orders.ts'),
		`// Comments that repeat the details of order validation.
export function orders(valid = true) {
	if (valid) return 2;
	return 0;
}
`
	);
	await writeFile(
		join(root, 'src/orders.test.ts'),
		`import { test, expect } from 'bun:test';
import { orders } from './orders';
// Duplicate notes about the expected results below.
test('orders', () => {
	expect(orders(true)).toBe(2);
	expect(orders(false)).toBe(0);
});
`
	);
}

async function writeOrdersModule(root: string): Promise<void> {
	await writeFile(join(root, '.gitignore'), '.cache/\n');
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
}

async function taskInput(root: string, extra: Record<string, unknown>): Promise<string> {
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
}

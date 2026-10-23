import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Exercise the real transport in fresh Bun and Node hosts, including synchronous PID tracking. */
export function observedProviderExit(runtime: string, transport: string, delay: number) {
	const root = mkdtempSync(join(tmpdir(), 'harness-provider-exit-'));
	try {
		const cli = fileURLToPath(
			new URL('../src/utils/development-tooling/cliProcess.ts', import.meta.url)
		);
		const rpc = fileURLToPath(
			new URL('../src/utils/agents-providers/codex-rpc/codexRpc.ts', import.meta.url)
		);
		const source = join(root, 'fixture.ts');
		const script = `import { cliProcess } from ${JSON.stringify(cli)};
import { codexRpc } from ${JSON.stringify(rpc)};
import { execFileSync } from 'node:child_process';
const resources = {id:'fixture',env:{},track:()=>{if (${delay}) execFileSync('sleep',[String(${delay}/1000)])}};
const watchdog = setTimeout(()=>{console.log(JSON.stringify({status:'timeout'}));process.exit(8)},1500);
try {
 const result = ${
		transport === 'cli'
			? `await cliProcess({command:'sh',args:['-c','printf "out\\n"']},{resources,timeoutMs:1000})`
			: `await codexRpc({command:'sh',args:['-c','printf fixture-failure >&2; exit 7']},resources)`
 };
 console.log(JSON.stringify({status:'passed',result}));
} catch (error) {
 console.log(JSON.stringify({status:'rejected',message:error.message}));
} finally { clearTimeout(watchdog); }
`;
		writeFileSync(source, script);
		const bundle = join(root, 'fixture.mjs');
		const built = spawnSync('bun', ['build', source, '--target=node', '--outfile', bundle], {
			encoding: 'utf8',
			timeout: 20_000
		});
		if (built.status !== 0) throw new Error(built.stderr);
		const ran = spawnSync(runtime, [runtime === 'bun' ? source : bundle], {
			encoding: 'utf8',
			timeout: 5000
		});
		return { exit: ran.status, stdout: ran.stdout, stderr: ran.stderr };
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

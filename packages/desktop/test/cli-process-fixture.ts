import { measureProcess } from '../../../test/support/cli-measurement/measureProcess';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Exercise the real transport in fresh Bun and Node hosts, including synchronous PID tracking. */
export async function observedProviderExit(runtime: string, transport: string, delay: number) {
	const root = mkdtempSync(join(tmpdir(), 'harness-provider-exit-'));
	try {
		const source = join(root, 'fixture.ts');
		writeFileSync(source, providerExitScript(transport, delay));
		const bundle = join(root, 'fixture.mjs');
		const built = spawnSync('bun', ['build', source, '--target=node', '--outfile', bundle], {
			encoding: 'utf8',
			timeout: 20_000
		});
		if (built.status !== 0) throw new Error(built.stderr);
		let exit: number | null = null;
		const result = await measureProcess(
			{
				units: [
					transport === 'cli' ? 'desktop.function.cli-process' : 'desktop.function.codex-rpc',
					'function.resource-environment'
				],
				workload: `${runtime}-${transport}-native-exit-${delay}`,
				target: 'module',
				command: [runtime, runtime === 'bun' ? source : bundle],
				cwd: root,
				expectSuccess: false
			},
			async (command, cwd) => {
				const ran = spawnSync(command[0], command.slice(1), {
					cwd,
					encoding: 'utf8',
					timeout: 5000
				});
				exit = ran.status;
				return { exitCode: ran.status ?? 1, stdout: ran.stdout, stderr: ran.stderr };
			}
		);
		return { exit, stdout: result.stdout, stderr: result.stderr };
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

function providerExitScript(transport: string, delay: number): string {
	const cli = fileURLToPath(
		new URL('../src/utils/development-tooling/cliProcess.ts', import.meta.url)
	);
	const rpc = fileURLToPath(
		new URL('../src/utils/agents-providers/codex-rpc/codexRpc.ts', import.meta.url)
	);
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
	return script;
}

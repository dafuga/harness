import { spawn, type ChildProcess } from 'node:child_process';
import type { IsolatedRun } from './runIsolated';
export function isolatedChild(run: IsolatedRun): ChildProcess {
	const command = run.stdio === 'inherit' ? 'exec "$0" "$@"' : 'exec "$0" "$@" 2>&1';
	return spawn('sh', ['-c', command, run.command, ...run.args], {
		cwd: run.cwd,
		env: run.env,
		detached: true,
		stdio: run.stdio === 'inherit' ? 'inherit' : ['ignore', 'pipe', 'ignore']
	});
}
export function captureIsolatedOutput(child: ChildProcess, output: Buffer[], limit: number): void {
	let kept = 0;
	child.stdout?.on('data', (chunk: Buffer) => {
		if (kept > limit) return;
		const room = limit - kept;
		output.push(chunk.length > room ? chunk.subarray(0, room) : chunk);
		if (chunk.length > room) output.push(Buffer.from('\n[output truncated]\n'));
		kept += chunk.length > room ? limit + 1 : chunk.length;
	});
}

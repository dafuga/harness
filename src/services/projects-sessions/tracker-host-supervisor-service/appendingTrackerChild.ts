// @harness-uid u_exiu6qdy62
import { spawn } from 'node:child_process';
import { appendFileSync, closeSync, openSync } from 'node:fs';

const stopGrace = 30_000;

export function supervisorLog(log: string, message: string): void {
	appendFileSync(log, `${new Date().toISOString()} [supervise] ${message}\n`, { mode: 0o600 });
}

/** Run one child with its output appended to the log. Aborting asks it to drain, then kills it. */
export function appendingTrackerChild(
	[executable, ...args]: string[],
	log: string,
	signal: AbortSignal
): Promise<string> {
	const output = openSync(log, 'a', 0o600);
	const child = spawn(executable, args, { stdio: ['ignore', output, output] });
	closeSync(output);
	let force: ReturnType<typeof setTimeout> | undefined;
	const stop = () => {
		child.kill('SIGTERM');
		force = setTimeout(() => child.kill('SIGKILL'), stopGrace);
	};
	if (signal.aborted) stop();
	else signal.addEventListener('abort', stop, { once: true });
	return new Promise((resolve) => {
		const finish = (outcome: string) => {
			clearTimeout(force);
			signal.removeEventListener('abort', stop);
			resolve(outcome);
		};
		child.once('error', () => finish('could not start'));
		child.once('exit', (code, killed) => finish(killed ?? `code ${code}`));
	});
}

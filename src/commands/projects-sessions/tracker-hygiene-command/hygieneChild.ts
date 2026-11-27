// @harness-uid u_u2kfcygh74
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

export async function startHygieneChild(args: string[], input?: string): Promise<number> {
	const entry = process.argv[1];
	const source = entry && /\.[cm]?[jt]s$/.test(entry) && existsSync(entry);
	const child = spawn(process.execPath, [...(source ? [entry] : []), 'hygiene', ...args], {
		detached: true,
		stdio: [input === undefined ? 'ignore' : 'pipe', 'ignore', 'ignore']
	});
	child.stdin?.on('error', () => {});
	child.stdin?.end(input);
	await new Promise<void>((resolve, reject) => {
		child.once('spawn', resolve);
		child.once('error', reject);
	});
	child.unref();
	return child.pid!;
}

export async function waitForHygiene(
	check: () => boolean | Promise<boolean>,
	milliseconds: number
) {
	const deadline = performance.now() + milliseconds;
	do {
		if (await check()) return true;
		await Bun.sleep(100);
	} while (performance.now() < deadline);
	return false;
}

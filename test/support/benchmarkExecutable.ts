import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Exercises native adapter framing and session continuation without a model call.
export async function installBenchmarkExecutables(root: string): Promise<string> {
	const bin = join(root, 'bin');
	await mkdir(bin);
	for (const runner of ['codex', 'claude']) {
		const path = join(bin, runner);
		await writeFile(
			path,
			`#!/usr/bin/env bun
import { writeFileSync } from 'node:fs';
if (process.argv.includes('--version')) { console.log('fixture 1'); process.exit(0); }
const args = process.argv.slice(2);
const prompt = await Bun.stdin.text();
const resumed = args.includes('resume') || args.includes('--resume');
if (!prompt.includes(resumed ? 'expected one' : 'Export value equal to 1')) process.exit(2);
if (resumed) writeFileSync('component.ts', 'export const value = 1;');
const session = '${runner}-fixture-session';
if ('${runner}' === 'codex') {
 console.log(JSON.stringify({ type: 'thread.started', thread_id: session }));
 console.log(JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 2 } }));
} else {
 console.log(JSON.stringify({ type: 'system', subtype: 'init', model: 'explicit-model' }));
 console.log(JSON.stringify({ type: 'result', subtype: 'success', session_id: session,
  usage: { input_tokens: 10, output_tokens: 2 }, total_cost_usd: resumed ? 0.02 : 0.01 }));
}
`
		);
		await chmod(path, 0o700);
	}
	return bin;
}

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import type { analyticsSnapshot } from '../../../../src/workflows/analyticsMetrics';
import { reportRuntimeRoot } from '../utils/reportRuntimeRoot';
export type AnalyticsSnapshot = ReturnType<typeof analyticsSnapshot>;
export class HarnessAnalyticsService {
	async snapshot(params: URLSearchParams): Promise<AnalyticsSnapshot> {
		const root = reportRuntimeRoot();
		const cli = process.env.HARNESS_CLI_PATH ?? resolve(root, '../../src/index.ts');
		const args = [cli, 'analytics', 'events', '--json'];
		for (const key of ['project', 'loop', 'task', 'model', 'since', 'until']) {
			const value = params.get(key);
			if (value) args.push(`--${key}`, value);
		}
		const output = await this.execute(args);
		// The CLI owns aggregation; dashboard consumes exactly the same snapshot.
		return JSON.parse(output) as AnalyticsSnapshot;
	}
	private execute(args: string[]): Promise<string> {
		return new Promise((resolveOutput, reject) => {
			const child = spawn(process.env.HARNESS_BUN_PATH ?? 'bun', args, {
				env: process.env,
				stdio: ['ignore', 'pipe', 'pipe']
			});
			let output = '';
			child.stdout.on('data', (chunk: Buffer) => {
				output += chunk.toString();
			});
			child.once('error', reject);
			child.once('close', (code) => {
				if (code === 0) resolveOutput(output);
				else reject(new Error('Harness analytics query failed.'));
			});
		});
	}
}

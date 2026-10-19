import { reportsEnvironment } from '../utils/reportsEnvironment';
import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export async function runReport(args: string[]): Promise<void> {
	const bundled = fileURLToPath(new URL('./reports/cli.js', import.meta.url));
	const source = fileURLToPath(new URL('../../packages/reports/src/cli/index.ts', import.meta.url));
	const entry = existsSync(bundled) ? bundled : source;
	const child = spawn(process.execPath, [entry, ...args], {
		stdio: 'inherit',
		env: {
			...reportsEnvironment(),
			HARNESS_REPORTS_RUNTIME_ROOT: existsSync(bundled)
				? dirname(bundled)
				: fileURLToPath(new URL('../../packages/reports/', import.meta.url)),
			HARNESS_CLI_PATH: existsSync(bundled)
				? fileURLToPath(new URL('./index.js', import.meta.url))
				: fileURLToPath(new URL('../index.ts', import.meta.url))
		}
	});
	process.exitCode = await new Promise<number>((resolve) =>
		child.once('exit', (code) => resolve(code ?? 1))
	);
}

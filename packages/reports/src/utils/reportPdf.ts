import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
export function reportPdf() {
	if (process.env.PROJECT_REPORTS_PYTHON) return process.env.PROJECT_REPORTS_PYTHON;
	const bundled = join(
		homedir(),
		'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3'
	);
	return existsSync(bundled) ? bundled : 'python3';
}

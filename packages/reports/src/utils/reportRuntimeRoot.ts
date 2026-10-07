import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
export function reportRuntimeRoot() {
	return (
		process.env.HARNESS_REPORTS_RUNTIME_ROOT ??
		resolve(fileURLToPath(new URL('../..', import.meta.url)))
	);
}

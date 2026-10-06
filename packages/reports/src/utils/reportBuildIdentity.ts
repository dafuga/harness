import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { reportRuntimeRoot } from './reportRuntimeRoot';
export function reportBuildIdentity(): string {
	try {
		return readFileSync(join(reportRuntimeRoot(), 'build', '.harness-build-id'), 'utf8').trim();
	} catch {
		return 'harness-reports-development';
	}
}

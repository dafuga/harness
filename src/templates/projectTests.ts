import { browserTestFiles } from './browserTest';
import type { PlannedFile } from '../core/files';
export function appTestFiles(): PlannedFile[] {
	return [
		...browserTestFiles(),
		{
			path: 'test/smoke.test.ts',
			contents:
				"import { expect, test } from 'vitest';\n\ntest('Harness app scaffold is ready', () => {\n\texpect(true).toBe(true);\n});\n"
		}
	];
}

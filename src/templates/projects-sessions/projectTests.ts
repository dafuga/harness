import { browserTestFiles } from '../development-tooling/browserTest';
import type { PlannedFile } from '../../core/development-tooling/files';
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

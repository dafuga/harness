import { browserTestFiles } from '../development-tooling/browserTest';
import type { PlannedFile } from '../../core/development-tooling/files';

const initialPageTest =
	"import { test } from './support/browserTest';\n\ntest('app page initial state', async ({ page, matchScreenshot }) => {\n\tawait page.goto('/');\n\tawait matchScreenshot(page, 'initial.png', { fullPage: true });\n});\n";

export function appTestFiles(): PlannedFile[] {
	return [
		...browserTestFiles(),
		{
			path: 'tests/e2e/app.spec.ts',
			contents: initialPageTest
		}
	];
}

import { browserTestFiles } from '../development-tooling/browserTest';
import type { PlannedFile } from '../../core/development-tooling/files';

const initialPageTest =
	"import { expect, test } from './support/browserTest';\n\ntest('app page initial state', async ({ page }) => {\n\tawait page.goto('/');\n\tawait expect(page).toHaveScreenshot('initial.png', { fullPage: true });\n});\n";

export function appTestFiles(): PlannedFile[] {
	return [
		...browserTestFiles(),
		{
			path: 'tests/e2e/app.spec.ts',
			contents: initialPageTest
		}
	];
}

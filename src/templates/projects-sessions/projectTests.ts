import { browserTestFiles } from '../development-tooling/browserTest';
import type { PlannedFile } from '../../core/development-tooling/files';

const initialPageTest =
	"import { test } from './support/browserTest';\n\nconst viewports = [\n\t{ id: 'desktop', size: { width: 1440, height: 900 } },\n\t{ id: 'tablet', size: { width: 920, height: 800 } },\n\t{ id: 'mobile', size: { width: 390, height: 844 } }\n] as const;\n\nfor (const viewport of viewports) {\n\ttest.describe(viewport.id + ' viewport', () => {\n\t\ttest.use({ viewport: viewport.size });\n\t\ttest('app page initial state', async ({ page, matchScreenshot }) => {\n\t\t\tawait page.goto('/');\n\t\t\tawait matchScreenshot(page, 'initial-' + viewport.id + '.png', { fullPage: true });\n\t\t});\n\t});\n}\n";

export function appTestFiles(): PlannedFile[] {
	return [
		...browserTestFiles(),
		{
			path: 'tests/e2e/app.spec.ts',
			contents: initialPageTest
		}
	];
}

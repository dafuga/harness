// @harness-uid u_orfabjtvsq
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { BrowserType } from '@playwright/test';
import { DesignCanvasError } from '../../../../packages/reports/src/models/planning-collaboration/DesignCanvasError';

/** Playwright from the project being designed, else the one installed beside this CLI. */
export async function loadChromium(root: string): Promise<BrowserType> {
	for (const from of [join(root, 'package.json'), import.meta.url])
		for (const name of ['playwright', '@playwright/test', 'playwright-core']) {
			let found: string;
			try {
				found = createRequire(from).resolve(name);
			} catch {
				continue;
			}
			// With no node_modules, Bun resolves any name from its download cache, at any version.
			if (found.includes('/install/cache/')) continue;
			const module = await import(pathToFileURL(found).href);
			return (module.chromium ?? module.default.chromium) as BrowserType;
		}
	throw new DesignCanvasError(
		'render needs Playwright: bun add -d @playwright/test && bunx playwright install chromium'
	);
}

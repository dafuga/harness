import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { unitsConfigFile, unitsConfigSchema } from '../src/core/unitsConfig';
import { verifyConfigFile, verifyConfigSchema } from '../src/core/verifyTypes';
import { verifyPlan } from '../src/services/verification-service/verifyPlan';

/**
 * The search specs of the explorer bar run on the shell fixture, outside the reports server, so
 * verification must run them under the shell config; the search specs of the shared workspace run
 * under the desktop's own Playwright config. Read from this repository's declared configuration.
 */
const config = verifyConfigSchema.parse(JSON.parse(readFileSync(verifyConfigFile, 'utf8')));
const unitsConfig = unitsConfigSchema.parse(JSON.parse(readFileSync(unitsConfigFile, 'utf8')));
const planned = (path: string) =>
	verifyPlan({ selectedTests: [path], scenarios: [], config, unitsConfig }).map((check) => ({
		cwd: check.cwd,
		command: check.command,
		timeoutMs: check.timeoutMs
	}));

test.each([
	'explorer-shell-search.spec.ts',
	'explorer-shell-search-scope.spec.ts',
	'explorer-shell-search-fit.spec.ts'
])('%s runs once in the reports package under the shell config', (spec) => {
	const path = `packages/reports/tests/e2e/${spec}`;
	expect(existsSync(path)).toBe(true);
	expect(planned(path)).toEqual([
		{
			cwd: 'packages/reports',
			command: `bun x playwright test --config src/configs/shellPlaywrightConfig.ts ${spec}`,
			timeoutMs: config.timeouts.test
		}
	]);
});

test.each(['ui-search.spec.ts', 'ui-search-scope.spec.ts', 'ui-search-fit.spec.ts'])(
	'%s runs in the desktop package under its own Playwright config',
	(spec) => {
		const path = `packages/desktop/tests/e2e/${spec}`;
		expect(existsSync(path)).toBe(true);
		expect(planned(path)).toEqual([
			{
				cwd: 'packages/desktop',
				command: `bun x playwright test tests/e2e/${spec}`,
				timeoutMs: config.timeouts.test
			}
		]);
	}
);

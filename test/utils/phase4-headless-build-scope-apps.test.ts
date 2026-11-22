import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { scenarioManifestSchema } from '../../src/core/unitTypes';
import { verifyConfigSchema } from '../../src/core/verifyTypes';
import {
	neededBuilds,
	scopedSetup
} from '../../src/workflows/verification-evidence/run-verify/verification-service/buildScope';

/** Headless scenarios whose registered tests and proof consume no compiled application output. */
const HEADLESS_SCENARIOS = [
	'local-project-chat',
	'upload-request-admission',
	'unit-registry-ownership',
	'design-options'
] as const;

const config = verifyConfigSchema.parse(JSON.parse(readFileSync('harness.verify.json', 'utf8')));

/** Setup steps that name no build; scoped verification must keep them. */
const unscopedSetup = config.setup.filter((step) => (step.builds ?? []).length === 0);

test.each(HEADLESS_SCENARIOS)(
	'%s needs no compiled build and keeps only the unscoped install and sync',
	(id) => {
		const url = new URL(`../../specification/scenarios/${id}.json`, import.meta.url);
		const manifest = scenarioManifestSchema.parse(JSON.parse(readFileSync(url, 'utf8')));
		const needed = neededBuilds([manifest]);
		expect(needed, `${id} must declare builds: []`).toEqual(new Set());
		const scoped = scopedSetup(config.setup, needed).map((step) => step.command);
		expect(scoped).toEqual(unscopedSetup.map((step) => step.command));
		expect(scoped[0]).toMatch(/^bun install --frozen-lockfile/);
		expect(scoped.some((command) => command.includes('svelte-kit sync'))).toBe(true);
		expect(scoped.some((command) => command.includes('build'))).toBe(false);
	}
);

import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { scenarioManifestSchema } from '../../src/core/unitTypes';
import type { ScenarioManifest } from '../../src/core/unitTypes';
import { verifyConfigSchema } from '../../src/core/verifyTypes';
import {
	neededBuilds,
	scopedSetup
} from '../../src/workflows/verification-evidence/run-verify/verification-service/buildScope';

/**
 * Desktop Phase 4 scenarios without a declared `builds` list. Their evidence includes items with no
 * build, so the stock fallback requires every build and keeps every setup step. Electron acceptances
 * launch `dist/main.cjs` (desktop-main) and load the `build/` renderer; browser checks load only the
 * renderer. Planning source is bundled into those outputs, so no Planning build output is consumed.
 */
const DESKTOP_DECLARED_BUILDS: Record<string, readonly string[]> = {
	'desktop-native': ['desktop-main', 'desktop-renderer'],
	'game-authoring': ['desktop-main', 'desktop-renderer'],
	'agent-references': ['desktop-renderer'],
	'agent-creation': ['desktop-renderer'],
	'design-options-ui': ['desktop-renderer']
};

/**
 * Shell scenarios keep their manifests unchanged: their registered evidence already names exactly
 * the builds they consume, so these are positive controls for the evidence-driven selection.
 */
const EVIDENCE_SELECTED_BUILDS: Record<string, readonly string[]> = {
	'explorer-shell': ['shell-fixture'],
	'browser-error-evidence': ['desktop-renderer', 'shell-fixture']
};

const root = new URL('../../', import.meta.url);
const rawConfig = JSON.parse(readFileSync(new URL('harness.verify.json', root), 'utf8')) as {
	builds: { id: string }[];
};
const config = verifyConfigSchema.parse(rawConfig);
const knownBuilds = new Set(rawConfig.builds.map((build) => build.id));

function manifestFor(id: string): ScenarioManifest {
	const url = new URL(`specification/scenarios/${id}.json`, root);
	return scenarioManifestSchema.parse(JSON.parse(readFileSync(url, 'utf8')));
}

/** A copy of the manifest without its declared builds, so the evidence fallback applies. */
function withoutDeclaredBuilds(manifest: ScenarioManifest): ScenarioManifest {
	const copy: ScenarioManifest = { ...manifest };
	delete copy.builds;
	return copy;
}

/** The setup commands that a run needing exactly these builds keeps, in their original order. */
function expectedCommands(builds: readonly string[]): string[] {
	return config.setup
		.filter((step) => {
			const named = step.builds ?? [];
			return named.length === 0 || named.some((build) => builds.includes(build));
		})
		.map((step) => step.command);
}

test.each(Object.entries(DESKTOP_DECLARED_BUILDS))(
	'%s declares exactly the builds its checks consume',
	(id, builds) => {
		const manifest = manifestFor(id);
		for (const build of builds) {
			expect(knownBuilds.has(build), `${build} is a configured build`).toBe(true);
		}
		expect(manifest.builds, `${id} must declare its builds`).toEqual([...builds]);
	}
);

test.each(Object.entries(DESKTOP_DECLARED_BUILDS))(
	'%s narrows neededBuilds and setup to its declared builds',
	(id, builds) => {
		const manifest = manifestFor(id);
		const needed = neededBuilds([manifest]);
		expect(needed, `${id} must not require every build`).toEqual(new Set(builds));
		const scoped = scopedSetup(config.setup, needed).map((step) => step.command);
		expect(scoped).toEqual(expectedCommands(builds));
	}
);

test.each(Object.entries(DESKTOP_DECLARED_BUILDS))(
	'%s without declared builds still falls back to every build through its null-build evidence',
	(id) => {
		expect(neededBuilds([withoutDeclaredBuilds(manifestFor(id))])).toBe('all');
	}
);

test.each(Object.entries(EVIDENCE_SELECTED_BUILDS))(
	'%s keeps its evidence-selected builds and setup without a manifest edit (positive control)',
	(id, builds) => {
		const needed = neededBuilds([manifestFor(id)]);
		expect(needed).toEqual(new Set(builds));
		const scoped = scopedSetup(config.setup, needed).map((step) => step.command);
		expect(scoped).toEqual(expectedCommands(builds));
	}
);

test('the build:desktop step still compiles planning, desktop-renderer and desktop-main as configured', () => {
	const step = config.setup.find((candidate) => candidate.command === 'bun run build:desktop');
	expect(step?.builds).toEqual(['planning', 'desktop-renderer', 'desktop-main']);
});

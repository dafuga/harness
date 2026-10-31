import { expect } from 'vitest';
import { UnitRegistryValidator } from '../../../src/validators/UnitRegistryValidator';
import { registryErrors } from '../../../src/cli/program/manageUnits';
import { UnitRegistryRepository } from '../../../src/repositories/verification-evidence/UnitRegistryRepository';
import { defaultUnitsConfig } from '../../../src/core/development-tooling/unitsConfig';
import type { LoadedUnits } from '../../../src/workflows/development-tooling/load-units/loadUnits.types';
import type { ComponentManifest } from '../../../src/core/unitTypes';
import type { Indexed } from '../../support/memoryTree.types';
import { indexFiles, unitOf } from '../../support/memoryTree';
import { measureWorkload } from '../../support/measureWorkload';

const facade = 'src/utils/scanImports.ts';
const canonical = 'src/utils/scanner/scanImports.ts';
const leaf = 'src/utils/scanner/svelteScripts.ts';
const types = 'src/utils/scanner/scanImports.types.ts';
const forwarding =
	'export { scanImports } from "./scanner/scanImports"; export { svelteScripts } from "./scanner/svelteScripts"; export type { Input } from "./scanner/scanImports.types";';

/** The normal ownership case checks identity admission and the reviewed canonical boundaries. */
export async function assertCanonicalOwnership() {
	await measureWorkload('validator.unit-registry', 'registry-ownership', () =>
		measureWorkload('workflow.manage-units', 'registry-ownership', async () => {
			const first = unitOf(
				await indexFiles({
					[facade]: 'export function scanImports(source: string): string { return source; }'
				}),
				'function.scan-imports'
			);
			assertIdentityAdmission(first);
			await assertRuntimeBackEdges(first);
			await assertComponentBackEdges();
		})
	);
}

function assertIdentityAdmission(first: ComponentManifest) {
	const other = { ...first, id: 'function.other', owns: { source: [leaf], symbols: ['other'] } };
	const paths = new Set([facade, leaf]);
	const validator = new UnitRegistryValidator();
	expect
		.soft(validator.validate([first, { ...other, id: first.id }], paths))
		.toContain('Duplicate active unit id function.scan-imports');
	expect(validator.validate([first, other], paths)).toEqual([]);
	expect(validator.validate([first, { ...other, owns: first.owns }], paths)).toContain(
		`${facade} is owned by function.scan-imports and function.other`
	);
	let reads = 0;
	const observed = { ...first };
	Object.defineProperty(observed, 'id', {
		get: () => {
			reads++;
			return first.id;
		}
	});
	class ManifestRows extends Array<ComponentManifest> {
		static get [Symbol.species]() {
			return Array;
		}
	}
	const admitted = ManifestRows.of(observed, other);
	Object.defineProperty(admitted, Symbol.iterator, {
		value: function* () {
			yield observed;
			yield observed;
		}
	});
	expect(validator.validate(admitted, paths)).toEqual([]);
	expect(reads).toBeGreaterThan(0);
}

async function assertRuntimeBackEdges(first: ComponentManifest) {
	const source: Record<string, string> = {
		leaf: 'import { svelteScripts } from "./svelteScripts"; export function scanImports(source: string): string { return svelteScripts(source); }',
		types:
			'import type { Input } from "../scanImports"; export function scanImports(source: Input): string { return source; }',
		backedge:
			'import { svelteScripts } from "../scanImports"; export function scanImports(source: string): string { return svelteScripts(source); }'
	};
	for (const [mode, implementation] of Object.entries(source)) {
		const files = {
			[facade]: forwarding,
			[canonical]: implementation,
			[leaf]: 'export function svelteScripts(source: string): string { return source; }',
			[types]: 'export type Input = string;'
		};
		const owner = {
			...first,
			owns: { source: Object.keys(files), symbols: ['scanImports', 'svelteScripts'] },
			runtime: {
				kind: 'module' as const,
				entry: canonical,
				targets: [{ kind: 'module' as const, entry: canonical }]
			}
		};
		const indexed = await indexFiles(files, [owner]);
		const stable = await indexFiles(files, indexed.result.manifests);
		const errors = registryErrors(context(stable));
		if (mode === 'backedge')
			expect
				.soft(errors)
				.toContain(
					`function.scan-imports: canonical ${canonical} runtime-imports forwarding entry ${facade}`
				);
		else expect(errors).toEqual([]);
	}
}

function context(indexed: Indexed): LoadedUnits {
	return {
		root: '/memory',
		config: defaultUnitsConfig,
		index: indexed.index,
		stored: indexed.result.manifests,
		fresh: indexed.result,
		scenarios: [],
		errors: [],
		unformatted: [],
		repository: new UnitRegistryRepository('/memory')
	};
}

async function assertComponentBackEdges() {
	const entry = 'src/components/Select.svelte';
	const implementation = 'src/components/shared-primitives/Select.svelte';
	const publicSource =
		'<script lang="ts">import Component from "./shared-primitives/Select.svelte"; let { label }: { label: string } = $props();</script><Component {label} />';
	const original = unitOf(
		await indexFiles({
			[entry]:
				'<script lang="ts">let { label }: { label: string } = $props();</script><p>{label}</p>'
		}),
		'component.select'
	);
	for (const mode of ['leaf', 'types', 'backedge']) {
		const imported = mode === 'types' ? 'import type Component from "../Select.svelte";' : '';
		const cycle = mode === 'backedge';
		const source =
			'<script lang="ts">' +
			(cycle ? 'import Component from "../Select.svelte";' : imported) +
			'let { label }: { label: string } = $props();</script>' +
			(cycle ? '<Component {label} />' : '<p>{label}</p>');
		const files = { [entry]: publicSource, [implementation]: source };
		const owner = {
			...original,
			id: 'reports.component.select',
			owns: { source: Object.keys(files), symbols: ['Select'] },
			runtime: {
				kind: 'module' as const,
				entry: implementation,
				targets: [{ kind: 'module' as const, entry: implementation }]
			}
		};
		const indexed = await indexFiles(files, [owner]);
		const stable = await indexFiles(files, indexed.result.manifests);
		const errors = registryErrors(context(stable));
		if (cycle)
			expect
				.soft(errors)
				.toContain(
					`reports.component.select: canonical ${implementation} runtime-imports forwarding entry ${entry}`
				);
		else expect(errors).toEqual([]);
	}
}

import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { indexFiles, unitOf } from '../../support/memoryTree';
import type { ComponentManifest } from '../../../src/core/unitTypes';
import { UnitRegistryValidator } from '../../../src/validators/UnitRegistryValidator';
import { revisionRegistry } from '../../../src/utils/verification-evidence/revision-registry/revisionRegistry';

const primitiveFiles = {
	'src/components/shared-primitives/Card.svelte':
		'<!-- @harness-tier atom --><article>Card</article>',
	'src/components/Cards.svelte':
		'<!-- @harness-tier organism --><script lang="ts">import Card from "./shared-primitives/Card.svelte";</script><Card />'
};

/** Composition follows runtime component calls, independently of navigation and type imports. */
async function assertCompositionRegistry(): Promise<void> {
	const files = {
		...primitiveFiles,
		'src/components/atoms/ButtonAtom.svelte': '<!-- @harness-tier atom --><button>Save</button>',
		'src/components/Control.svelte':
			'<!-- @harness-tier molecule --><script lang="ts">import ButtonAtom from "./atoms/ButtonAtom.svelte";</script><ButtonAtom />',
		'src/components/Feature.svelte':
			'<!-- @harness-tier organism --><script lang="ts">import Control from "./Control.svelte";</script><Control />',
		'src/components/Typed.svelte':
			'<!-- @harness-tier molecule --><script lang="ts">import type { ComponentProps } from "svelte"; import type Feature from "./Feature.svelte"; let data: ComponentProps<typeof Feature>;</script>',
		'src/routes/home/+page.svelte':
			'<!-- @harness-tier page --><script lang="ts">import Feature from "../../components/Feature.svelte";</script><Feature />'
	};
	const indexed = await indexFiles(files);
	const units = indexed.result.manifests;
	const control = unitOf(indexed, 'component.control'),
		feature = unitOf(indexed, 'component.feature');
	expect(control.composition).toEqual({ level: 'molecule', uses: ['component.atoms-button-atom'] });
	expect(unitOf(indexed, 'component.typed').composition?.uses).toEqual([]);
	control.dependencies.push({ unit: 'page.home', via: 'url', origin: 'declared' });
	const validator = new UnitRegistryValidator();
	expect(validator.validate(units, new Set(Object.keys(files)))).toEqual([]);
	await assertPrimitiveContracts(units, files);
	const stored = revisionRegistry(units, []);
	expect(stored.units.find((unit) => unit.id === control.id)?.composition).toEqual(
		control.composition
	);
	const invalid = units.map((unit) =>
		unit.id === feature.id
			? { ...unit, composition: { ...unit.composition!, level: 'molecule' as const } }
			: unit
	);
	expect(validator.validate(invalid, new Set(Object.keys(files)))).toContain(
		'component.feature: molecule cannot compose molecule component.control'
	);
}

async function assertPrimitiveContracts(units: ComponentManifest[], files: Record<string, string>) {
	const cards = units.find((unit) => unit.id === 'component.cards')!;
	expect(cards.contract.primitives).toEqual(['component.shared-primitives-card']);
	const omitted = units.map((unit) =>
		unit.id === cards.id ? { ...unit, contract: { ...unit.contract, primitives: [] } } : unit
	);
	expect(new UnitRegistryValidator().validate(omitted, new Set(Object.keys(files)))).toContain(
		'component.cards: contract omits shared primitive component.shared-primitives-card'
	);
	const restored = await indexFiles(files, omitted);
	expect(unitOf(restored, 'component.cards').contract.primitives).toEqual(
		cards.contract.primitives
	);
}

test('atomic levels follow runtime calls and survive projections', assertCompositionRegistry);

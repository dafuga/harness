import type { Guide } from './guide';

const unitGuide: Guide = {
	topic: 'unit',
	summary: 'A unit is one responsibility with a stable identity, owned source and a contract.',
	steps: [
		'Generate the unit, or index existing source into the registry.',
		'Replace the derived responsibility and contract with declared ones when they matter.',
		'Declare dependencies that cross a runtime boundary: process, HTTP, Wasm or contract.',
		'Before changing code, name the units you change and read only their source.',
		'Read dependency contracts with harness units show instead of their implementations.',
		'Re-index after every source change and commit the manifests with the code.'
	],
	rules: [
		'Manifests live in specification/units, one canonical JSON file per unit.',
		'An identity never changes and is never given to different source.',
		'Moving source keeps the identity; recreating retired source revives it with its baseline.',
		'Retire a unit explicitly once its source is gone; the tombstone keeps its history.',
		'runtime.kind and runtime.entry name the default execution target; runtime.targets lists ' +
			'every applicable target, includes the default, and names each runtime kind once.',
		'An alternative implementation in other source is its own unit, linked to the original ' +
			'by a declared contract dependency.',
		'Derived responsibilities and contracts are labelled derived until a person declares them.',
		'A unit recreated from retired source records lineage to the retired identity, so ' +
			'baselines and history carry over.',
		'Manifests cap performance tolerance at 5%; only a recorded reviewer approval changes it.',
		'Derived dependencies come from imports; unresolved or computed imports are uncertain.',
		'Uncertain references are reported and widen test selection until they are declared.',
		'harness generate component stays the Svelte component scaffold; harness generate unit ' +
			'accepts any scaffold kind and also writes the manifest.'
	],
	antiPatterns: [
		'Do not edit an identity to dodge a frozen budget.',
		'Do not delete a manifest by hand; retire the unit.',
		'Do not read the whole repository when the unit contracts answer the question.'
	],
	exampleCommands: [
		'harness generate unit PriceQuote',
		'harness generate unit Billing --kind service --responsibility "Charges an invoice once."',
		'harness units index --write',
		'harness units show service.billing',
		'harness units check',
		'harness units schema ComponentManifest'
	]
};

export const unitGuides: Guide[] = [unitGuide];

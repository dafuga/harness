import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';

/** Project only authored test semantics from validated raw Git JSON, without rewriting values. */
export function authoredUnitData(unit: ComponentManifest) {
	const helperExamples = (unit.helperContracts ?? [])
		.filter((helper) => helper.examples !== undefined)
		.map(({ name, examples }) => ({ name, examples }));
	const contractExamples = {
		inputs: exampleFields(unit.contract.inputs),
		outputs: exampleFields(unit.contract.outputs),
		errors: exampleFields(unit.contract.errors)
	};
	if (
		!unit.testing &&
		!helperExamples.length &&
		!Object.values(contractExamples).some((rows) => rows.length)
	)
		return undefined;
	return { unit: unit.id, testing: unit.testing ?? null, helperExamples, contractExamples };
}

/** Authored fields may change in a test checkpoint; all other product metadata remains intact. */
export function productUnitData(unit: ComponentManifest): ComponentManifest {
	const product = globalThis.structuredClone(unit);
	delete product.testing;
	for (const helper of product.helperContracts ?? []) delete helper.examples;
	for (const group of ['inputs', 'outputs', 'errors'] as const)
		for (const field of product.contract[group]) delete field.examples;
	return product;
}

function exampleFields(fields: ComponentManifest['contract']['inputs']) {
	return fields
		.filter((field) => Object.hasOwn(field, 'examples'))
		.map(({ name, examples }) => ({ name, examples }));
}

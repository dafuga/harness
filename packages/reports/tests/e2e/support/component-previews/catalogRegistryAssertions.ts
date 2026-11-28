import { expect } from '../../../../../../test/support/browserTest';
import { catalogCases, catalogScenario, catalogUnits, previewState } from './catalogUnits';

/** Every registered visual unit and variant has a declared, correctly ordered capture slot. */
export function assertCatalogRegistry() {
	const expected = catalogUnits.map((unit) => unit.id);
	expect([...catalogScenario.units].sort(), 'Catalog includes every active visual unit').toEqual(
		expected
	);
	expect(catalogScenario.states, 'Catalog preview states follow canonical unit order').toEqual(
		catalogCases.map(({ unit, variant }) =>
			expect.objectContaining({ id: previewState(unit.id, variant), units: [unit.id] })
		)
	);
}

import { measureWorkload } from '../../../../test/support/measureWorkload';
import type { ComponentManifest } from '../../../../src/core/unitTypes';
import { TestExpectationService } from '../../../../src/services/verification-evidence/TestExpectationService';
import { expect, test } from 'vitest';
import { entityLabels, entityLens, shortCommit } from '../../src/utils/entityLens';
import manifest from '../../../../test/fixtures/contract-migration/lens-examples.json';

test('the ten collections keep Pages first and APIs immediately after', () =>
	measureWorkload('reports.function.entity-lens', 'layout-catalog-behavior', () => {
		expect(Object.keys(entityLabels), 'Pages stay first when APIs are listed').toEqual([
			'pages',
			'apis',
			'layouts',
			'components',
			'functions',
			'configs',
			'services',
			'models',
			'types',
			'platforms'
		]);
		const words = Object.values(entityLabels).flatMap((label) => [label.title, label.subtitle]);
		expect(words.join(' ')).not.toMatch(/sub-?components|related|reports/i);
	}));

const invokeEntityLens = (...input: never[]) => {
	const [from, to] = input as unknown as Parameters<typeof entityLens>;
	return measureWorkload('reports.function.entity-lens', 'layout-catalog-behavior', () =>
		entityLens(from, to)
	);
};

new TestExpectationService().registerExamples(test, manifest as ComponentManifest, {
	entityLens: invokeEntityLens,
	shortCommit
});

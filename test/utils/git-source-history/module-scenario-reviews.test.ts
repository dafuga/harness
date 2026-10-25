import { expect, test } from 'vitest';
import { moduleScenarioReviews } from '../../../src/utils/git-source-history/moduleScenarioReviews';

test('moduleScenarioReviews trims values', () => {
	expect(moduleScenarioReviews(' value ')).toBe('value');
});

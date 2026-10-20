import { expect, test } from 'vitest';
import { changeEnvironment } from '../../src/utils/changeEnvironment';
test.each([
	['dev', ['dev']],
	['stage', ['dev', 'stage']],
	['preprod', ['dev', 'stage', 'preprod']],
	['prod', ['dev', 'stage', 'preprod']]
] as const)('changes viewed in %s stop before production', (environment, expected) => {
	expect(changeEnvironment(environment)).toEqual(expected);
});

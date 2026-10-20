import { expect, test } from 'vitest';
import { changeEnvironment } from '../../src/utils/changeEnvironment';
test.each([
	['dev', ['dev']],
	['stage', ['dev', 'stage']],
	['preprod', ['dev', 'stage']],
	['prod', ['dev', 'stage']]
] as const)('changes viewed in %s stop before protected environments', (environment, expected) => {
	expect(changeEnvironment(environment)).toEqual(expected);
});

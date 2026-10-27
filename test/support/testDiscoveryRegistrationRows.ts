/** Synthetic runner contexts used by the discovery method case. */
export function registrationRows() {
	return [
		{ code: 'registerExamples(test.skip, unit, {})', title: 'finish: Finish', disabled: true },
		{ code: "registerExamples(test['only'], unit, {})", title: 'finish: Finish', disabled: true },
		{
			code: "registerCases(test.skip, unit, 'test/methods.test.ts', {})",
			title: 'Runner.finish initialized',
			disabled: true,
			method: true
		},
		{
			code: "describe.skip('disabled', () => { service.registerExamples(test, unit, {}); })",
			title: 'disabled > finish: Finish',
			disabled: true,
			suite: true
		},
		{
			code: "describe('active', () => { service.registerExamples(test, unit, {}); })",
			title: 'active > finish: Finish',
			suite: true
		},
		{ code: 'registerExamples(test[modifier], unit, {})', title: 'finish: Finish', dynamic: true },
		{
			code: 'if (condition) service.registerExamples(test, unit, {})',
			title: 'finish: Finish',
			dynamic: true,
			suite: true
		},
		{
			code: 'function later() { service.registerExamples(test, unit, {}); }',
			title: 'finish: Finish',
			dynamic: true,
			suite: true
		},
		{
			code: 'fake.registerExamples(test, unit, {})',
			title: 'finish: Finish',
			dynamic: true,
			suite: true
		}
	];
}

/** Import and binding variations for the same generated-registration case. */
export function registrarSources() {
	const prefix = "import { test } from 'vitest'; import unit from './unit.json'; ";
	return [
		{
			source: `${prefix}import { TestExpectationService as Check } from '@dafuga01/harness/verification'; new Check().registerExamples(test, unit, {});`,
			dynamic: false
		},
		{
			source: `${prefix}import { TestExpectationService } from './fake'; new TestExpectationService().registerExamples(test, unit, {});`,
			dynamic: true
		},
		{
			source: `${prefix}import type { TestExpectationService } from '../src/services/verification-evidence/TestExpectationService'; new TestExpectationService().registerExamples(test, unit, {});`,
			dynamic: true
		},
		{
			source: `${prefix}import { TestExpectationService } from '../src/services/verification-evidence/TestExpectationService'; let checker = new TestExpectationService(); checker.registerExamples(test, unit, {});`,
			dynamic: true
		},
		{
			source: `${prefix}import { TestExpectationService } from '../src/services/verification-evidence/TestExpectationService'; const checker = new TestExpectationService(); checker.registerExamples(test, unit, {});`,
			dynamic: false
		},
		{
			source:
				"import { test as check } from 'vitest'; import { TestExpectationService } from '../src/services/verification-evidence/TestExpectationService'; const unit = loadManifest(); new TestExpectationService().registerExamples(check, unit, {});",
			dynamic: true,
			computed: true
		},
		{
			source:
				"import { test } from 'vitest'; import { TestExpectationService } from '../src/services/verification-evidence/TestExpectationService'; const unit = loadManifest(); new TestExpectationService().registerCases(test.skip, unit, 'test/examples.test.ts', {});",
			dynamic: true,
			computed: true,
			disabled: true
		},
		{
			source:
				"import { test } from 'vitest'; import { TestExpectationService } from '../src/services/verification-evidence/TestExpectationService'; test('case', () => new TestExpectationService().registerExamples(() => {}, loadManifest(), {}));",
			dynamic: false
		}
	];
}

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

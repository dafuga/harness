export function fixtureUnit() {
	return {
		schemaVersion: 1,
		id: 'page.fixture',
		kind: 'page',
		title: 'Fixture',
		responsibility: 'Renders the fixture page.',
		responsibilityOrigin: 'declared',
		status: 'active',
		owns: { source: ['src/routes/fixture/+page.svelte'], symbols: ['Page'] },
		contract: { origin: 'declared', inputs: [], outputs: [], errors: [] },
		dependencies: [],
		runtime: {
			kind: 'module',
			entry: 'src/routes/fixture/+page.svelte',
			targets: [{ kind: 'module', entry: 'src/routes/fixture/+page.svelte' }]
		},
		scenarios: ['visual'],
		testing: {
			version: 1,
			shape: 'page',
			states: ['default'],
			cases: ['desktop', 'tablet', 'mobile'].map((viewport) => ({
				id: `default.${viewport}`,
				state: 'default',
				viewports: [viewport],
				test: { file: 'test/page.spec.ts', title: `fixture ${viewport}` },
				expected: { kind: 'screenshot', file: `test/baselines/${viewport}.png` }
			}))
		},
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
	};
}

export function fixtureScenario() {
	return {
		schemaVersion: 1,
		id: 'visual',
		title: 'Synthetic visual fixture',
		kind: 'ui',
		units: ['page.fixture'],
		states: [{ id: 'default', title: 'Default', coverage: 'required' }],
		viewports: ['desktop', 'tablet', 'mobile'].map((id) => ({ id, width: 4, height: 4 })),
		tests: [
			{
				id: 'page',
				kind: 'e2e',
				runner: 'playwright',
				target: 'test/page.spec.ts',
				cases: ['desktop', 'tablet', 'mobile'].map((viewport) => ({
					unit: 'page.fixture',
					case: `default.${viewport}`
				}))
			}
		],
		evidence: [
			{
				id: 'screens',
				kind: 'screenshot',
				states: ['default'],
				viewports: ['desktop', 'tablet', 'mobile'],
				provenance: 'actual-capture',
				build: 'site',
				capture: 'viewport',
				required: true
			}
		]
	};
}

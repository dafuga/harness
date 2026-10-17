import { mount } from 'svelte';
import '../../../../src/lib/styles/base.css';
import '../../../../src/lib/styles/harness.css';
import '../../../../src/lib/styles/entity.css';
import '../../../../src/lib/styles/entity-evidence.css';
import EntityTests from '../../../../src/components/harness/EntityTests.svelte';
import { answers, nav, view } from '../../../../test/entityPlaces';
import { ids } from '../../../../test/entityUnits';

const shown = view('current');
const record = shown.head.records[0];
record.status = 'failed';
record.tests[0].status = 'failed';
Object.assign(record.tests[0], {
	browserErrors: [
		{
			test: 'Orders › failed request',
			file: 'orders.spec.ts',
			project: 'chromium',
			retry: 0,
			errors: [
				{ type: 'console', message: 'Orders unavailable', page: 'https://fixture.test/orders' }
			],
			expected: [
				{ type: 'console', message: 'Orders unavailable', reason: 'Tests the retry state.' },
				{ type: 'console', message: 'Retry exhausted', reason: 'Retries must be reported.' }
			]
		}
	]
});
const result = answers(shown, ids.list);
// This fixture exercises test diagnostics; the independent capture viewers have their own suites.
result.evidence.after.captures = [];
document.getElementById('app')!.className = 'ex-content';
mount(EntityTests, {
	target: document.getElementById('app') as HTMLElement,
	props: {
		entity: result.entity,
		scope: shown.scope,
		evidence: result.evidence,
		behavior: { ...result.behavior, rows: [] },
		nav: nav(),
		mediaBase: '/media/'
	}
});

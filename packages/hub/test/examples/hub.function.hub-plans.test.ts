import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { hubPlanRecord } from '../../src/utils/networking-security/hub-catalog/hubPlanRecord';
import { hubPlans } from '../../src/utils/networking-security/hubPlans';

const responsibility =
	'Validate committed plans and turn their current designs into catalog planning records.';
const plan = {
	unitId: 'hub.function.hub-plans',
	path: 'src/functions/hub-plans',
	category: 'function',
	slug: 'hub-plans',
	title: 'Read hosted plans',
	goal: responsibility,
	createdAt: '2026-11-15T00:00:00.000Z',
	baseRevision: '0123456789abcdef0123456789abcdef01234567',
	contract: { responsibility, inputs: [], outputs: [], errors: [], states: [], viewports: [] },
	contractHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
} as unknown as Parameters<typeof hubPlanRecord>[1];

function emptyContext() {
	return {
		source: {},
		repository: {},
		commit: '0123456789abcdef0123456789abcdef01234567',
		entries: [],
		identity: {},
		cache: {}
	} as unknown as Parameters<typeof hubPlans>[0];
}

test('Converts a plan without designs into a draft catalog record', async () => {
	const record = await hubPlanRecord(emptyContext(), plan);
	const output = {
		id: record.id,
		path: record.path,
		category: record.category,
		title: record.title,
		goal: record.goal,
		lifecycle: record.lifecycle,
		versions: record.versions,
		threads: record.threads,
		contract: record.contract
	};
	expect(output).toMatchObject({
		id: plan.unitId,
		path: plan.path,
		category: 'functions',
		title: plan.title,
		lifecycle: 'draft',
		versions: [],
		threads: [],
		contract: { inputs: [], outputs: [], errors: [] }
	});
	recordExampleCases(
		{
			unitId: 'hub.function.hub-plans',
			symbol: 'hubPlanRecord',
			state: 'converts-a-plan-without-designs-into-a-draft-catalog-record',
			evidence: 'examples-cases',
			file: 'converts-a-plan-without-designs-into-a-draft-catalog-record.json'
		},
		[{ name: 'valid plan with no committed design versions', input: { plan, designEntries: [] }, output }]
	);
});

test('Returns no plans for an empty source', async () => {
	const context = emptyContext();
	const output = await hubPlans(context);
	expect(output).toEqual([]);
	recordExampleCases(
		{
			unitId: 'hub.function.hub-plans',
			symbol: 'hubPlans',
			state: 'returns-no-plans-for-an-empty-source',
			evidence: 'examples-cases',
			file: 'returns-no-plans-for-an-empty-source.json'
		},
		[{ name: 'source tree has no entries', input: { entries: [] }, output }]
	);
});

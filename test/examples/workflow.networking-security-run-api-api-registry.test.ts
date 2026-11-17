import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { apiRegistry } from '../../src/workflows/networking-security/run-api/apiRegistry';
import type { HarnessApiService } from '../../src/services/networking-security/HarnessApiService';
import type { ApiSnapshot } from '../../src/services/networking-security/HarnessApiService.types';

const unitId = 'workflow.networking-security-run-api-api-registry';
const commit = '0123456789abcdef0123456789abcdef01234567';
const snapshot: ApiSnapshot = {
	project: { id: 'api-project' },
	revision: { branch: 'main', commit, atTip: true },
	writable: true,
	entities: []
};
const contract = { responsibility: 'Shows evidence rows for a report.' };
const unit = { id: 'reports.component.evidence-grid', contract };
const registry = { commit, units: [unit] };
const savedPlan = { responsibility: 'Plans the weekly evidence export.' };

type Reply = { data: unknown } | Error;
type Replies = Record<string, Reply>;
type Outcome = { output: unknown; calls: string[] } | { error: Error; calls: string[] };

// Fake client: answers each read kind from `replies`; an Error reply models a rejected read.
function fakeClient(replies: Replies, calls: string[]): HarnessApiService {
	return {
		read: async (kind: string) => {
			calls.push(kind);
			const reply = replies[kind];
			if (reply instanceof Error) throw reply;
			return reply;
		}
	} as unknown as HarnessApiService;
}

async function call(resource: string, replies: Replies, id?: string): Promise<Outcome> {
	const calls: string[] = [];
	try {
		const output = await apiRegistry(fakeClient(replies, calls), snapshot, resource, id);
		return { output, calls };
	} catch (cause) {
		return { error: cause instanceof Error ? cause : new Error(String(cause)), calls };
	}
}

function record(state: string, name: string, input: unknown, outcome: Outcome): void {
	const body =
		'error' in outcome
			? { error: { name: outcome.error.name, message: outcome.error.message } }
			: { output: outcome.output };
	recordExampleCases(
		{ unitId, symbol: 'apiRegistry', state, evidence: 'examples-cases', file: `${state}.json` },
		[{ name, input, ...body }]
	);
}

test('Returns registry data for the selected revision', async () => {
	const outcome = await call('registry', { registry: { data: registry } });
	expect(outcome).toEqual({ output: registry, calls: ['registry'] });
	record(
		'returns-registry-data-for-the-selected-revision',
		'registry resource returns commit and units',
		{ resource: 'registry' },
		outcome
	);
});

test('Returns id and contract summaries when no id is given', async () => {
	const outcome = await call('components', { registry: { data: registry } });
	expect(outcome).toEqual({
		output: [{ id: unit.id, contract }],
		calls: ['registry']
	});
	record(
		'returns-id-and-contract-summaries-when-no-id-is-given',
		'other resource without id lists id and contract pairs',
		{ resource: 'components' },
		outcome
	);
});

test('Returns a saved plan contract for a contracts lookup', async () => {
	const outcome = await call('contracts', { entity: { data: { contract: savedPlan } } }, 'plan-weekly');
	expect(outcome).toEqual({ output: savedPlan, calls: ['entity'] });
	record(
		'returns-a-saved-plan-contract-for-a-contracts-lookup',
		'contracts lookup with a saved entity id returns its contract',
		{ resource: 'contracts', id: 'plan-weekly' },
		outcome
	);
});

test('Falls back to a backend unit after a saved-plan miss', async () => {
	const replies: Replies = {
		entity: new Error('Harness API HTTP 404: not found'),
		registry: { data: registry }
	};
	const outcome = await call('contracts', replies, unit.id);
	expect(outcome).toEqual({ output: contract, calls: ['entity', 'registry'] });
	record(
		'falls-back-to-a-backend-unit-after-a-saved-plan-miss',
		'saved entity HTTP 404 is a miss, then the backend unit contract is returned',
		{ resource: 'contracts', id: unit.id },
		outcome
	);
});

test('Rejects when no unit or saved plan has the id', async () => {
	const replies: Replies = {
		entity: new Error('Harness API HTTP 400: Entity not found at this revision.'),
		registry: { data: registry }
	};
	const outcome = await call('contracts', replies, 'missing-plan');
	expect((outcome as { error?: Error }).error?.message).toContain(
		'No registered unit or saved plan has this id'
	);
	record(
		'rejects-when-no-unit-or-saved-plan-has-the-id',
		'exact entity-not-found 400 and an unmatched unit id reject',
		{ resource: 'contracts', id: 'missing-plan' },
		outcome
	);
});

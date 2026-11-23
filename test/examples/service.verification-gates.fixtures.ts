import type { ComponentManifest } from '../../src/core/development-tooling/unitTypes';
import type { BudgetEvent } from '../../src/core/verification-evidence/budgetTypes';
import type { VerificationRecord } from '../../src/core/verification-evidence/verificationTypes';
import type { LedgerRead } from '../../src/repositories/verification-evidence/BudgetLedgerRepository.types';
import { VerificationStoreRepository } from '../../src/repositories/verification-evidence/VerificationStoreRepository';
import { ledgerGate } from '../../src/workflows/verification-evidence/run-verify/verification-service/record-assembly-service/VerificationGates';

export const verificationService: ComponentManifest = {
	schemaVersion: 1,
	id: 'service.verification-gates',
	uid: 'u_fkuot3slc7',
	kind: 'service',
	title: 'VerificationGates',
	responsibility: 'Guards registry identities and append-only budget history.',
	responsibilityOrigin: 'declared',
	status: 'active',
	owns: {
		source: [
			'src/workflows/verification-evidence/run-verify/verification-service/record-assembly-service/VerificationGates.ts'
		],
		symbols: ['registryGate', 'ledgerGate']
	},
	contract: { origin: 'declared', inputs: [], outputs: [], errors: [] },
	dependencies: [],
	runtime: {
		kind: 'module',
		entry:
			'src/workflows/verification-evidence/run-verify/verification-service/record-assembly-service/VerificationGates.ts',
		targets: [
			{
				kind: 'module',
				entry:
					'src/workflows/verification-evidence/run-verify/verification-service/record-assembly-service/VerificationGates.ts'
			}
		]
	},
	scenarios: [],
	budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
};

export const previewUnit: ComponentManifest = {
	...verificationService,
	id: 'reports.component.evidence-grid',
	kind: 'component',
	title: 'Evidence grid',
	preview: {
		scenario: 'reports.scenario.desktop',
		state: 'loaded',
		viewport: 'desktop'
	}
};

const recordId = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

const sourceCommit = '1111111111111111111111111111111111111111';

const sourceTree = '2222222222222222222222222222222222222222';

function exampleVerificationRecord(): VerificationRecord {
	return {
		schemaVersion: 1,
		id: recordId,
		repository: '/example/project',
		source: { commit: sourceCommit, tree: sourceTree, base: null },
		profile: {
			id: 'linux-x64-node22',
			platform: 'linux',
			arch: 'x64',
			cpu: 'Fixture CPU',
			cores: 1,
			memoryBytes: 1073741824,
			runtime: 'node 22 fixture'
		},
		startedAt: '2026-11-15T09:00:00.000Z',
		finishedAt: '2026-11-15T09:00:01.000Z',
		status: 'passed',
		components: [],
		measurements: [],
		impact: {
			runtime: 'module',
			expanded: false,
			changed: [],
			units: { direct: [], indirect: [], added: [], removed: [] },
			uncertain: []
		},
		tests: [],
		scenarios: [],
		budgets: { status: 'passed', findings: [] },
		reasons: { status: 'passed', missing: [] },
		failures: []
	};
}

function exampleBudgetEvent(): BudgetEvent {
	return {
		type: 'baseline',
		unit: 'reports.component.evidence-grid',
		record: { id: recordId, commit: sourceCommit, tree: sourceTree },
		reviewer: 'reviewer@example.test',
		reason: 'Record the reviewed bundle-size baseline.',
		at: '2026-11-15T09:00:00.000Z',
		metrics: { bundleBytes: 32768 },
		performance: []
	};
}

function collectLedgerCases(store: VerificationStoreRepository, event: BudgetEvent) {
	const base: LedgerRead = { text: '', events: [], errors: [] };
	const cited: LedgerRead = { text: `${JSON.stringify(event)}\n`, events: [event], errors: [] };
	const wrongTreeEvent: BudgetEvent = {
		...event,
		record: { ...event.record, tree: '3333333333333333333333333333333333333333' }
	};
	const wrongTree: LedgerRead = {
		text: `${JSON.stringify(wrongTreeEvent)}\n`,
		events: [wrongTreeEvent],
		errors: []
	};
	const rewritten = {
		base: { text: 'previous approved baseline\n', events: [], errors: [] },
		head: {
			text: 'rewritten baseline\n',
			events: [],
			errors: ['budget ledger line 1 is malformed']
		}
	};
	const stored = { record: { id: recordId, commit: sourceCommit, tree: sourceTree } };
	const calls = [
		{ name: 'an empty ledger', ledger: { base, head: base } },
		{
			name: 'an appended baseline citing its stored commit and tree',
			ledger: { base, head: cited }
		},
		{
			name: 'an appended baseline citing a different stored tree',
			ledger: { base, head: wrongTree }
		},
		{ name: 'ledger text that rewrites its base', ledger: rewritten }
	];
	return calls.map(({ name, ledger }) => ({
		name,
		input: { ledger, store: stored },
		output: ledgerGate(ledger, store)
	}));
}

export async function runLedgerGateExamples(directory: string) {
	const store = new VerificationStoreRepository(directory);
	const record = exampleVerificationRecord();
	await store.save(record, store.directoryFor(sourceCommit, record.startedAt));
	return collectLedgerCases(store, exampleBudgetEvent());
}

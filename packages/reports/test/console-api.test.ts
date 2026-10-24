import { expect } from '../../../test/verificationExpect';
import { measureWorkload } from '../../../test/support/measureWorkload';
import { afterAll, beforeAll, test, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ConsoleAgentService } from '../src/services/ConsoleAgentService';
import { recordedRepo, binding, page, git } from '../../desktop/test/recorded-evidence-fixture';
import type { Recorded } from '../../desktop/test/recorded-evidence-fixture';
import type { EntityDetail } from '../../desktop/src/models/development-tooling/Desktop.types';
import type {
	EntityEvidenceResult,
	EvidenceArtifactResult
} from '../../desktop/src/models/verification-evidence/DesktopEvidence.types';

const site = vi.hoisted(() => ({ root: process.cwd() }));
vi.mock('../src/utils/reports-media/reportSite', () => ({ reportSite: () => site }));
let fixture: Recorded;
let client: ConsoleAgentService;
beforeAll(async () => {
	fixture = await recordedRepo();
	site.root = fixture.root;
	client = new ConsoleAgentService();
	await client.open();
}, 240000);
afterAll(async () => {
	client?.close();
	await fixture?.repo.dispose();
});

test(
	'the real local API bridge returns committed source and hash-bound recorded screenshot bytes',
	() =>
		measureWorkload('reports.service.console-agent', 'local-api-recorded-reads', async () => {
			const query = {
				entityId: page,
				branch: 'verified',
				commit: fixture.commits.changed,
				mode: 'current' as const
			};
			const detail = (await client.call('entity', {
				entityId: page,
				commit: query.commit
			})) as EntityDetail;
			const path = detail.sources[0];
			const source = (await client.call('source', { ...query, path })) as { text: string };
			expect(source.text).toBe(
				execFileSync('git', ['show', `${query.commit}:${path}`], {
					cwd: fixture.root,
					encoding: 'utf8'
				})
			);
			const result = (await client.call('evidence', query)) as EntityEvidenceResult;
			const capture = result.evidence.after.captures.find(
				(entry) => entry.capture.kind === 'screenshot'
			)!;
			const artifact = (await client.call(
				'artifact',
				binding(result, query, capture)
			)) as EvidenceArtifactResult;
			expect(artifact.bytes).toBeInstanceOf(Uint8Array);
			expect(createHash('sha256').update(artifact.bytes).digest('hex')).toBe(
				capture.capture.sha256
			);
			expect(artifact.mediaType).toBe('image/png');
		}),
	60000
);

test(
	'the real local API bridge saves the proposed contract through planning validation',
	() =>
		measureWorkload('reports.service.console-agent', 'local-api-contract-definition', () =>
			measureWorkload(
				'desktop.function.development-tooling-ipc-payload-plan-payload',
				'local-api-contract-definition',
				async () => {
					await client.call('snapshot', { branch: null, commit: null });
					const contract = {
						inputs: [{ name: 'total', type: 'number', description: 'Amount to format.' }],
						outputs: [{ name: 'text', type: 'string' }],
						errors: ['Invalid total']
					};
					const plan = (await measureWorkload(
						'desktop.function.ipc-payload',
						'local-api-contract-definition',
						() =>
							client.call('createPlan', {
								category: 'functions',
								title: 'Format totals',
								goal: 'Format a total',
								contract
							})
					)) as EntityDetail;
					expect(plan.contract.inputs).toEqual(contract.inputs);
					expect(plan.contract.outputs).toEqual(contract.outputs);
					expect(plan.contract.errors.map((error) => error.name)).toEqual(contract.errors);
					expect(git(fixture.root, 'status', '--porcelain')).toBe('');
				}
			)
		),
	60000
);

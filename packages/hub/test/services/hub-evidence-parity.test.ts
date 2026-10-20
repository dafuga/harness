import { expect, test } from 'vitest';
import { BudgetService } from '../../../../src/services/budget-service/BudgetService';
import { mediaPlace } from '../../../../src/services/history-media-service/mediaPlace';
import { recordView } from '../../../../src/utils/recordView';
import { revisionRegistry } from '../../../../src/utils/revision-registry/revisionRegistry';
import { revisionSummary } from '../../../../src/utils/revisionSummary';
import { recordedAnswer } from '../../../desktop/src/utils/recorded-answer/recordedAnswer';
import { recordedScope } from '../../../desktop/src/utils/recordedScope';
import type { HarnessRevision } from '../../../reports/src/models/Harness.types';
import { explorerVerdict } from '../../../reports/src/utils/explorer-verdict/explorerVerdict';
import { asked, evidenceFixture, read, type EvidenceFixture } from '../support/evidenceFixture';
import { blobId } from '../support/evidenceGit';
import { clock, page, scenarios, units, type Stored } from '../support/evidenceRecords';

type Held = { stored: Stored; pointer: EvidenceFixture['pointers']['first'] };

/** One commit as the local backend holds it, from the same data and the same pure functions. */
function local(f: EvidenceFixture, commit: string, held: Held) {
	const { record } = held.stored;
	const all = [f.records.first, f.records.second];
	const origin = (id: string) => all.find((item) => item.record.id === id);
	const view = recordView(record, {
		valid: true,
		problems: [],
		resolve: (capture, from) => {
			const bytes = origin(from)?.files.get(capture.path);
			return mediaPlace(bytes && Buffer.from(bytes), capture, 'not stored');
		},
		origins: (id) => origin(id)?.record.tests
	});
	const files = f.git.commits.get(commit)?.files as Map<string, Uint8Array>;
	const blobs = new Map([...files].map(([path, bytes]) => [path, blobId(bytes)]));
	const { units: reached, changed, uncertain } = record.impact;
	const fresh = record.scenarios.filter((item) => item.status !== 'referenced');
	const detail = {
		commit,
		registry: revisionRegistry(units, scenarios, blobs, new BudgetService().baselines([], units)),
		comparison: {
			...{ base: record.source.base, record: record.id, units: reached, changed, uncertain },
			scenarios: fresh.map((item) => item.id)
		},
		sourceImpact: null,
		records: [view],
		explanations: commit === f.commits.changed ? [f.noted.explanation] : []
	};
	const { id, status } = record;
	const attached = [{ record: id, status, valid: true, problems: [], evidence: held.pointer }];
	return {
		detail: detail as unknown as HarnessRevision,
		judged: revisionSummary({ records: attached }, [view])
	};
}

for (const entity of [page, clock])
	test(`the hub answers for ${entity} with what the local functions give for the same data`, async () => {
		const f = evidenceFixture();
		const { root, changed, tip } = f.commits;
		const query = asked(changed, 'main', 'commit', entity);
		const result = await read(f, query);
		const head = local(f, changed, { stored: f.records.second, pointer: f.pointers.second });
		const parent = local(f, root, { stored: f.records.first, pointer: f.pointers.first });
		const revision = {
			...{ commit: changed, parents: [root], subject: 'feat: changed' },
			...{ author: 'Harness Fixture', committedAt: '2026-10-12T08:00:00Z' }
		};
		const kind = units.find((unit) => unit.id === entity)?.kind;
		const scope = recordedScope(query, { tip, kind, revision, judged: head.judged, legacy: [] });
		const expected = recordedAnswer({
			scope,
			identity: result.identity,
			revisions: { head: head.detail, parent: parent.detail }
		});
		expect(result).toEqual(expected);
		const shown = result.evidence.after.detail as HarnessRevision;
		expect(explorerVerdict(shown.registry.units[0], shown)).toEqual({
			passed: true,
			label: 'Full coverage passed',
			reasons: []
		});
	});

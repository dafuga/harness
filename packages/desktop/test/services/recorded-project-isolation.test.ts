import { beforeEach, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { RecordedEvidenceService } from '../../src/services/RecordedEvidenceService';
import { sampleDetail, sampleScope, head, feed } from '../recorded-sample';
import type { ProjectSessionService } from '../../src/services/ProjectSessionService';
import type {
	EntityEvidenceResult,
	EvidenceArtifactResult
} from '../../src/models/DesktopEvidence.types';

const io = vi.hoisted(() => ({
	reads: [] as string[],
	wait: Promise.resolve(),
	release: () => {}
}));
const bytes = new TextEncoder().encode('fixture runtime output');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const pins = {
	notesRevision: 'e'.repeat(40),
	evidenceRevision: 'f'.repeat(40),
	digest: '1'.repeat(64)
};
vi.mock('../../src/adapters/EvidenceRefsAdapter', () => ({
	notesRef: 'refs/notes/harness',
	evidenceRef: 'refs/heads/harness-evidence',
	/** Stands in for the adapter of one repository: `new` gives what this function returns. */
	EvidenceRefsAdapter: function (root: string) {
		const read = async (which: 'current' | 'pinned') => {
			io.reads.push(`${root}:${which}`);
			await io.wait;
			return pins;
		};
		return { current: () => read('current'), pinned: () => read('pinned') };
	}
}));
vi.mock('../../src/adapters/PinnedHistoryAdapter', () => ({
	PinnedHistoryAdapter: class {
		constructor(private root: string) {}
		async facts() {
			return { ...sampleScope(feed).summary, parents: [] };
		}
		async revision() {
			io.reads.push(`${this.root}:revision`);
			const detail = sampleDetail(head);
			const capture = detail.records[0].scenarios[1].states[0].captures[0];
			capture.sha256 = sha256;
			return {
				detail,
				facts: { ...sampleScope(feed).summary, parents: [], subject: this.root },
				judged: { coverage: 'verified', gaps: [], records: [] },
				legacy: []
			};
		}
		async files() {
			io.reads.push(`${this.root}:files`);
			return new Map([[`evidence/${head}/output.bin`, bytes]]);
		}
	}
}));
vi.mock('../../src/utils/gitRead', () => ({
	gitRead: async (root: string) => {
		io.reads.push(`${root}:tree`);
		return '2'.repeat(40);
	}
}));

beforeEach(() => {
	io.reads.length = 0;
	io.wait = new Promise<void>((resolve) => {
		io.release = resolve;
	});
});
function fixture() {
	let selected = 'A';
	const context = (id: string) => ({
		root: id,
		source: {
			revision: async () => {
				io.reads.push(`${id}:source`);
				return { commit: head, tip: head };
			}
		}
	});
	const session = {
		get projectId() {
			return selected;
		},
		assertProject(id?: string) {
			if (id && id !== selected) throw new Error('Project switched');
		},
		requireProject() {
			return context(selected);
		}
	} as unknown as ProjectSessionService;
	const query = Object.freeze({
		projectId: 'A',
		entityId: feed,
		commit: head,
		branch: 'main',
		mode: 'current' as const
	});
	return {
		service: new RecordedEvidenceService(session),
		query,
		switch: () => {
			selected = 'B';
		}
	};
}
for (const operation of ['evidence', 'artifact'] as const) {
	for (const switching of [false, true]) {
		it(`${operation}: ${switching ? 'switch while refs await must retain A or reject' : 'unchanged A succeeds'}`, async () => {
			const f = fixture();
			const request =
				operation === 'evidence'
					? f.service.evidence(f.query)
					: f.service.artifact(
							Object.freeze({
								...f.query,
								side: 'after' as const,
								recordId: 'record-aaaa',
								scenarioId: 'feed-run',
								state: 'filled',
								evidenceId: 'kept',
								viewport: null,
								sha256,
								...pins
							})
						);
			expect(io.reads).toEqual([`A:${operation === 'evidence' ? 'current' : 'pinned'}`]);
			if (switching) f.switch();
			io.release();
			const result = await request.then(
				(value) => ({ value }),
				(error) => ({ error })
			);
			if ('error' in result) {
				expect(switching, String(result.error)).toBe(true);
				return;
			}
			if (operation === 'evidence') {
				expect((result.value as EntityEvidenceResult).identity.projectId).toBe('A');
				expect((result.value as EntityEvidenceResult).scope.summary.subject).toBe('A');
			} else {
				expect((result.value as EvidenceArtifactResult).sha256).toBe(sha256);
				expect((result.value as EvidenceArtifactResult).bytes).toEqual(bytes);
			}
			expect(
				io.reads.filter((read) => read.startsWith('B:')),
				'a successful A request must never use B context'
			).toEqual([]);
		});
	}
}

import type {
	Scenario,
	Files,
	Test,
	Drafted,
	Stored,
	VerificationLine
} from './evidenceRecords.types';
import type { EvidencePointer, HistoryNote } from '../../../../src/core/historyTypes';
import type { Capture, VerificationRecord } from '../../../../src/core/verificationTypes';
import { evidenceManifest } from '../../../../src/services/evidence-attach-service/evidenceManifest';
import { lfsPointer, lfsStored } from '../../../../src/utils/lfsPointer';
import { sealRecord } from '../../../../src/utils/sealRecord';
import { json, sha256 } from './evidenceSource';

export { clock, json, page, png, scenarios, sha256, sourceFiles, units } from './evidenceSource';
const utf8 = (text: string) => new TextEncoder().encode(text);

const stated = (path: string, bytes: Uint8Array) => ({
	path,
	sha256: sha256(bytes),
	bytes: bytes.length
});

/** A screenshot of the page as one commit built it. */
export function screenshot(commit: string, bytes: Uint8Array): Capture {
	return {
		evidence: 'screens',
		kind: 'screenshot',
		state: 'default',
		viewport: 'desktop',
		status: 'passed',
		...stated('captures/titles-default-desktop.png', bytes),
		mediaType: 'image/png',
		capturedAt: '2026-10-12T08:00:00Z',
		server: { buildId: 'fixture-build', revision: commit }
	};
}

export function output(bytes: Uint8Array): Capture {
	return {
		evidence: 'output',
		kind: 'output',
		state: 'default',
		status: 'passed',
		...stated('captures/clock.txt', bytes),
		mediaType: 'text/plain',
		capturedAt: '2026-10-12T08:00:00Z'
	};
}

export function ran(commit: string, id: string, capture: Capture): Scenario {
	const states = [{ id: 'default', coverage: 'required' as const, captures: [capture] }];
	return { id, status: 'passed', testedRevision: commit, states };
}

export function check(id: string, files: Files): Test {
	const path = `logs/${id.replace(':', '-')}.log`;
	const log = utf8(`${id} passed\n`);
	files.set(path, log);
	return {
		id,
		kind: 'e2e',
		runner: 'playwright',
		target: id,
		status: 'passed',
		durationMs: 5,
		log: stated(path, log)
	};
}

export function sealed(draft: Drafted): VerificationRecord {
	const { base } = draft;
	const linked = base ? { base: base.commit, baseRecord: base.record } : { base: null };
	const units = { direct: draft.direct, indirect: [], added: [], removed: [] };
	return sealRecord({
		schemaVersion: 1,
		repository: 'fixture/harness',
		source: { ...draft.source, ...linked },
		profile: {
			id: 'fixture',
			platform: 'test',
			arch: 'any',
			cpu: 'any',
			cores: 1,
			memoryBytes: 1,
			runtime: 'bun'
		},
		startedAt: '2026-10-12T07:59:00Z',
		finishedAt: draft.finishedAt,
		status: 'passed',
		components: [],
		measurements: [],
		impact: { runtime: 'module', expanded: false, changed: [], units, uncertain: [] },
		tests: draft.tests,
		scenarios: draft.scenarios,
		budgets: { status: 'passed', findings: [] },
		reasons: { status: 'passed', entries: [], missing: [] },
		gates: { tests: 'passed', scenarios: 'passed', budgets: 'passed', reasons: 'passed' },
		failures: []
	});
}

/** A record with its files as they are committed: the manifest beside it, and media in LFS. */
export function stored(record: VerificationRecord, files: Files): Stored {
	const text = json(record);
	const manifest = json(evidenceManifest(record, Buffer.from(text)));
	const tree: Files = new Map([
		['manifest.json', manifest],
		['record.json', text]
	]);
	const lfs: Files = new Map();
	for (const [path, bytes] of files) {
		const media = lfsStored(path);
		if (media) lfs.set(sha256(bytes), bytes);
		tree.set(
			path,
			media ? utf8(lfsPointer({ sha256: sha256(bytes), bytes: bytes.length })) : bytes
		);
	}
	return { record, files, tree, lfs, manifest: sha256(manifest) };
}

export function verification(item: Stored, evidence: EvidencePointer): VerificationLine {
	const { id, status, source, finishedAt } = item.record;
	return {
		schemaVersion: 1,
		kind: 'verification',
		record: id,
		status,
		profile: item.record.profile.id,
		finishedAt,
		source: { commit: source.commit, tree: source.tree, base: source.base },
		evidence
	};
}

export type { Drafted, Stored, VerificationLine } from './evidenceRecords.types';

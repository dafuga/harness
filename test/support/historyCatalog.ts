import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { expect } from 'vitest';
import { CatalogRepository } from '../../src/repositories/git-source-history/CatalogRepository';
import type { BuiltRevision } from '../../src/services/explorer-ui/revision-detail-service/RevisionDetailService';
import { compactRevision } from '../../src/cli/program/history-index-service/historySnapshots';
import {
	historySeries,
	unitGrowth
} from '../../src/cli/program/history-index-service/historySeries';
import { revisionSummary } from '../../src/utils/development-tooling/revisionSummary';

export function assertCatalogRevision(out: string, commit: string) {
	const db = new DatabaseSync(join(out, 'catalog.sqlite'), { readOnly: true });
	try {
		const unit = new CatalogRepository(db, false)
			.entities({ commit })
			.find((unit) => unit.id === 'function.slugify');
		expect(unit?.sourceMeasurements?.length).toBeGreaterThan(0);
		expect(
			unit?.sourceMeasurements?.every((item) => item.testedRevision === commit),
			'catalog measurements retain the selected commit even when its source tree is shared'
		).toBe(true);
	} finally {
		db.close();
	}
}

/** Index aggregation must not retain already-written media or logs while preserving its facts. */
export function assertCompactHistorySummary() {
	const full = historySummaryFixture();
	const compact = compactRevision(full, new Map());
	expect(
		JSON.stringify(compact).includes('discarded-history-payload'),
		'large written payloads must not remain in the aggregation working set'
	).toBe(false);
	expect(revisionSummary(compact.status, compact.detail.records)).toEqual(
		revisionSummary(full.status, full.detail.records)
	);
	expect(unitGrowth(compact.sound)).toEqual(unitGrowth(full.sound));
	expect(historySeries(compact.sound, compact.detail.regressions)).toEqual(
		historySeries(full.sound, full.detail.regressions)
	);
	expect(compact.sound.map((record) => record.profile)).toEqual(
		full.sound.map((record) => record.profile)
	);
	expect(compact.detail.regressions?.map((proof) => [proof.loop, proof.gap])).toEqual(
		full.detail.regressions?.map((proof) => [proof.loop, proof.gap])
	);
}

function historySummaryFixture(): BuiltRevision {
	const commit = 'a'.repeat(40),
		marker = 'discarded-history-payload'.repeat(100);
	const measurements = historyMeasurements(commit);
	const record = {
		id: 'record',
		profile: fixtureProfile,
		measurements,
		tests: [{ log: marker }],
		scenarios: [{ payload: marker }]
	};
	const view = {
		id: 'record',
		profile: 'profile',
		finishedAt: '2026-01-01T00:00:00Z',
		source: { base: null },
		tests: [{ output: marker }]
	};
	const point = {
		id: 'focused',
		commit,
		status: 'passed',
		command: 'fixture',
		assertion: 'fixture',
		finishedAt: '2026-01-01T00:00:00Z',
		output: marker,
		captures: [{ payload: marker }],
		measurements
	};
	return {
		status: {
			commit,
			verified: true,
			problems: [],
			records: [{ record: 'record', status: 'passed', valid: true, problems: [] }]
		},
		sound: [record],
		ledger: [],
		detail: {
			commit,
			records: [view],
			sourceImpact: null,
			explanations: [],
			registry: {
				available: true,
				units: [{ id: 'service.fixture', version: 'v1', payload: marker }]
			},
			regressions: [
				{ loop: 'focused', units: ['service.fixture'], red: null, green: point },
				{ loop: 'historical-gap', units: [], red: null, gap: 'Original evidence missing' }
			]
		}
	} as unknown as BuiltRevision;
}

const fixtureProfile = {
	id: 'profile',
	platform: 'fixture',
	arch: 'arm64',
	cpu: 'fixture',
	cores: 1,
	memoryBytes: 1,
	runtime: 'fixture'
};

function historyMeasurements(commit: string) {
	return [
		{
			unit: 'service.fixture',
			metric: 'source-bytes',
			unitOfMeasure: 'bytes',
			value: 12,
			testedRevision: commit,
			workload: null,
			profile: null
		},
		{
			unit: 'service.fixture',
			metric: 'latency-ms',
			unitOfMeasure: 'ms',
			value: 3,
			testedRevision: commit,
			workload: 'sample',
			profile: 'profile',
			method: 'fixture',
			target: 'module'
		}
	];
}

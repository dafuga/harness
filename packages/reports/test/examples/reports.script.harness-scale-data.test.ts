import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	generatedFailures,
	generatedUnits,
	writeScaleData
} from '../../scripts/harness-scale-data';
import {
	FailedRevisionRecordNotFoundError,
	SlugifyTemplateNotFoundError
} from '../../scripts/harness-scale-data.types';
import type { Unit, Detail } from '../../scripts/harness-scale-data.types';
import type { Case } from './reports.script.harness-scale-data.test.types';

const UNIT_ID = 'reports.script.harness-scale-data';
const MAP = '0123456789abcdef0123456789abcdef01234567';
const FAILED = '89abcdef0123456789abcdef0123456789abcdef';
const COMMITS = { map: MAP, failed: FAILED };
const roots: string[] = [];

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function unit(id: string): Unit {
	return {
		id,
		title: id,
		responsibility: `Example unit ${id}.`,
		dependencies: [],
		owns: { source: [`src/${id}.ts`], symbols: [id] },
		scenarios: [],
		helpers: [
			{
				name: 'slugify',
				source: 'src/slugify.ts',
				inputs: [{ name: 'slugify.text', type: 'string' }]
			}
		]
	};
}

/** Writes a made-up synthetic history into a new temporary folder and returns its paths. */
function seedHistory(mapIds: string[], failedStatus: string): { from: string; to: string } {
	const root = mkdtempSync(join(tmpdir(), 'harness-scale-data-'));
	roots.push(root);
	const revisions = join(root, 'source', 'revisions');
	mkdirSync(revisions, { recursive: true });
	const map: Detail = {
		registry: { units: mapIds.map(unit), graph: { edges: [] } },
		records: [{ status: 'passed', failures: [] }]
	};
	const failed: Detail = {
		registry: { units: [], graph: { edges: [] } },
		records: [{ status: failedStatus, failures: ['function.slugify: example failure'] }]
	};
	writeFileSync(join(revisions, `${MAP}.json`), JSON.stringify(map));
	writeFileSync(join(revisions, `${FAILED}.json`), JSON.stringify(failed));
	return { from: join(root, 'source'), to: join(root, 'scale') };
}

function readDetail(to: string, commit: string): Detail {
	return JSON.parse(readFileSync(join(to, 'revisions', `${commit}.json`), 'utf8')) as Detail;
}

async function rejection(run: () => Promise<void>): Promise<Error & { name: string }> {
	let error: unknown;
	await run().catch((caught: unknown) => {
		error = caught;
	});
	expect(error).toBeInstanceOf(Error);
	return error as Error & { name: string };
}

function record(state: string, symbol: string, cases: Case[]): void {
	recordExampleCases(
		{ unitId: UNIT_ID, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

test('Adds the generated units and their edges to the map', async () => {
	const paths = seedHistory(['function.slugify'], 'failed');
	await writeScaleData(paths.from, paths.to, COMMITS);
	const detail = readDetail(paths.to, MAP);
	const ids = detail.registry.units.map((item) => item.id);
	const edges = detail.registry.graph.edges;
	expect(ids).toHaveLength(generatedUnits + 1);
	expect(ids[1]).toBe('function.generated-000');
	expect(edges).toHaveLength(720);
	expect(edges[0]).toEqual({
		from: 'function.generated-120',
		to: 'function.generated-000',
		via: 'import'
	});
	record('adds-the-generated-units-and-their-edges-to-the-map', 'writeScaleData', [
		{
			name: 'adds 480 generated units and 720 edges to the map',
			input: { mapUnits: ['function.slugify'], failedStatus: 'failed', commits: COMMITS },
			output: { units: ids.length, edges: edges.length, firstEdge: edges[0] }
		}
	]);
});

test('Adds one generated failure per unit to the failed record', async () => {
	const paths = seedHistory(['function.slugify'], 'failed');
	await writeScaleData(paths.from, paths.to, COMMITS);
	const failures = readDetail(paths.to, FAILED).records[0]?.failures ?? [];
	expect(failures).toHaveLength(generatedFailures.length + 1);
	expect(failures[0]).toBe('function.slugify: example failure');
	expect(failures.slice(1)).toEqual(generatedFailures);
	record('adds-one-generated-failure-per-unit-to-the-failed-record', 'writeScaleData', [
		{
			name: 'appends 480 generated failures after the existing failure',
			input: { mapUnits: ['function.slugify'], failedStatus: 'failed', commits: COMMITS },
			output: { failures: failures.length, first: failures[0], last: failures.at(-1) }
		}
	]);
});

test('Exports the fixed generated unit count and failure list', () => {
	expect(generatedUnits).toBe(480);
	expect(generatedFailures).toHaveLength(480);
	expect(generatedFailures[0]).toBe(
		'function.generated-000: no baseline is established; a reviewer must establish one'
	);
	expect(generatedFailures.at(-1)).toContain('function.generated-479:');
	record('exports-the-fixed-generated-unit-count-and-failure-list', 'generatedFailures', [
		{
			name: 'exports 480 generated IDs from 000 to 479',
			input: {},
			output: {
				generatedUnits,
				failures: generatedFailures.length,
				first: generatedFailures[0],
				last: generatedFailures.at(-1)
			}
		}
	]);
});

test('Rejects a failed revision without a failed record', async () => {
	const paths = seedHistory(['function.slugify'], 'passed');
	const error = await rejection(() => writeScaleData(paths.from, paths.to, COMMITS));
	expect(error).toBeInstanceOf(FailedRevisionRecordNotFoundError);
	expect(error.message).toBe(`the synthetic history has no failed record at ${FAILED}`);
	record('rejects-a-failed-revision-without-a-failed-record', 'writeScaleData', [
		{
			name: 'throws when the failed revision has no failed record',
			input: { mapUnits: ['function.slugify'], failedStatus: 'passed', commits: COMMITS },
			error: { name: error.name, message: error.message }
		}
	]);
});

test('Rejects a map without the function.slugify template', async () => {
	const paths = seedHistory(['function.trim'], 'failed');
	const error = await rejection(() => writeScaleData(paths.from, paths.to, COMMITS));
	expect(error).toBeInstanceOf(SlugifyTemplateNotFoundError);
	expect(error.message).toBe('the synthetic history has no function.slugify to copy');
	record('rejects-a-map-without-the-function-slugify-template', 'writeScaleData', [
		{
			name: 'throws when the map registry has no function.slugify unit',
			input: { mapUnits: ['function.trim'], failedStatus: 'failed', commits: COMMITS },
			error: { name: error.name, message: error.message }
		}
	]);
});

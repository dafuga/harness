import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	measurementLocation,
	entitySummaryFacts
} from '../../src/components/explorer-ui/entitySummaryFacts';
import type { SummaryFact } from '../../src/components/explorer-ui/entitySummaryFacts.types';

type Measure = Parameters<typeof entitySummaryFacts>[0];
type Row = Measure['performance'][number];
type Size = Measure['size'][number];

const navigation: Row = {
	workload: 'Open entity panel',
	metric: 'Navigation',
	target: 'chromium-headless',
	profile: 'ci-4-core',
	value: '182 ms',
	tolerance: '3%',
	over: false
};
const heap: Row = { ...navigation, metric: 'Heap used', value: '96 MB' };
const p95: Row = {
	workload: 'Load entity graph',
	metric: 'p95 latency',
	target: '',
	profile: 'ci-2-core',
	value: '1.4 s',
	tolerance: '12%',
	over: true
};
const unmeasuredHeap: Row = {
	workload: 'Open entity panel',
	metric: 'Heap used',
	target: '',
	profile: '',
	value: 'Not measured',
	note: 'Nothing was measured for this run.',
	tolerance: '5%',
	over: false
};
const scriptBundle: Size = {
	label: 'Script bundle',
	value: '412 KB',
	target: 'browser',
	note: 'Gzip size is not included.'
};
const serverBundle: Size = { label: 'Server bundle', value: '1.2 MB', target: 'node' };
const sourceMap: Size = {
	label: 'Source map',
	value: 'Not measured',
	target: 'browser',
	note: 'The build did not emit a source map.'
};
const typesSize: Size = {
	label: 'Types',
	value: 'Not measured',
	target: 'none',
	note: 'No output-size metric applies.'
};

test('Compact facts list size rows then latency and memory', () => {
	const measure: Measure = { size: [scriptBundle, serverBundle], performance: [navigation, heap] };
	const facts = entitySummaryFacts(measure, true);
	const expected: SummaryFact[] = [
		{ label: 'Script bundle', value: '412 KB', title: 'Gzip size is not included.', className: '' },
		{ label: 'Server bundle', value: '1.2 MB', className: '' },
		{ label: 'Latency', value: '182 ms', className: '' },
		{ label: 'Memory', value: '96 MB', className: '' }
	];
	expect(facts).toEqual(expected);
	recordExampleCases(
		{
			unitId: 'reports.function.explorer-ui-entity-summary-facts',
			symbol: 'entitySummaryFacts',
			state: 'compact-facts-list-size-rows-then-latency-and-memory',
			evidence: 'examples-cases',
			file: 'compact-facts-list-size-rows-then-latency-and-memory.json'
		},
		[
			{
				name: 'compact view of a browser and node build with navigation and heap rows',
				input: { measure, compact: true },
				output: facts
			}
		]
	);
});

test('Detailed facts describe the only performance row', () => {
	const measure: Measure = { size: [], performance: [p95] };
	const facts = entitySummaryFacts(measure, false);
	const expected: SummaryFact[] = [
		{ label: 'Workload', value: 'Load entity graph', className: '' },
		{ label: 'Environment', value: 'ci-2-core', className: '' },
		{ label: 'p95 latency', value: '1.4 s', className: '' },
		{ label: 'Tolerance', value: '12% · above the 5% policy', className: 'over' }
	];
	expect(facts).toEqual(expected);
	recordExampleCases(
		{
			unitId: 'reports.function.explorer-ui-entity-summary-facts',
			symbol: 'entitySummaryFacts',
			state: 'detailed-facts-describe-the-only-performance-row',
			evidence: 'examples-cases',
			file: 'detailed-facts-describe-the-only-performance-row.json'
		},
		[
			{
				name: 'detailed view of one looser-than-policy latency row without a target',
				input: { measure, compact: false },
				output: facts
			}
		]
	);
});

test('Empty performance adds unmeasured latency and memory', () => {
	const measure: Measure = { size: [typesSize, sourceMap], performance: [] };
	const facts = entitySummaryFacts(measure, false);
	const expected: SummaryFact[] = [
		{
			label: 'Source map',
			value: 'Not measured',
			title: 'The build did not emit a source map.',
			note: 'The build did not emit a source map.',
			className: 'unmeasured'
		},
		{ label: 'Latency', value: 'Not measured', className: 'unmeasured' },
		{ label: 'Memory', value: 'Not measured', className: 'unmeasured' }
	];
	expect(facts).toEqual(expected);
	recordExampleCases(
		{
			unitId: 'reports.function.explorer-ui-entity-summary-facts',
			symbol: 'entitySummaryFacts',
			state: 'empty-performance-adds-unmeasured-latency-and-memory',
			evidence: 'examples-cases',
			file: 'empty-performance-adds-unmeasured-latency-and-memory.json'
		},
		[
			{
				name: 'no performance rows and a source map that was not measured, types skipped',
				input: { measure, compact: false },
				output: facts
			}
		]
	);
});

test('Several performance rows add no detailed facts', () => {
	const measure: Measure = { size: [serverBundle], performance: [navigation, heap] };
	const facts = entitySummaryFacts(measure, false);
	const expected: SummaryFact[] = [{ label: 'Server bundle', value: '1.2 MB', className: '' }];
	expect(facts).toEqual(expected);
	recordExampleCases(
		{
			unitId: 'reports.function.explorer-ui-entity-summary-facts',
			symbol: 'entitySummaryFacts',
			state: 'several-performance-rows-add-no-detailed-facts',
			evidence: 'examples-cases',
			file: 'several-performance-rows-add-no-detailed-facts.json'
		},
		[
			{
				name: 'detailed view with two performance rows keeps only the size rows',
				input: { measure, compact: false },
				output: facts
			}
		]
	);
});

test('Measurement location joins target and profile or dashes', () => {
	const locations = [navigation, p95, unmeasuredHeap].map((row) => measurementLocation(row));
	expect(locations).toEqual(['chromium-headless · ci-4-core', 'ci-2-core', '—']);
	recordExampleCases(
		{
			unitId: 'reports.function.explorer-ui-entity-summary-facts',
			symbol: 'measurementLocation',
			state: 'measurement-location-joins-target-and-profile-or-dashes',
			evidence: 'examples-cases',
			file: 'measurement-location-joins-target-and-profile-or-dashes.json'
		},
		[
			{ name: 'both target and profile are set', input: navigation, output: locations[0] },
			{ name: 'only the profile is set', input: p95, output: locations[1] },
			{ name: 'neither target nor profile is set', input: unmeasuredHeap, output: locations[2] }
		]
	);
});

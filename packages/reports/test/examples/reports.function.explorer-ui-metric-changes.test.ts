import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { metricChanges } from '../../src/utils/explorer-ui/metricChanges';

const measuredBefore = {
	size: [
		{ label: 'Source size', value: '48.3 KB', rawValue: 48300, unitOfMeasure: 'bytes' },
		{
			label: 'Emitted size · process (native)',
			target: 'process',
			value: '2.4 MB',
			rawValue: 2400000,
			unitOfMeasure: 'bytes'
		},
		{ label: 'Complexity', value: '17', rawValue: 17 }
	],
	performance: [
		{
			workload: 'explorer open',
			metric: 'Warm latency per call',
			target: 'process',
			profile: 'linux-x64-ci',
			value: '184 ms',
			rawValue: 184,
			unitOfMeasure: 'ms',
			tolerance: '5%',
			over: false
		},
		{
			workload: 'explorer open',
			metric: 'Benchmark process peak RSS',
			target: 'process',
			profile: 'linux-x64-ci',
			value: '38.2 MB',
			rawValue: 38200000,
			unitOfMeasure: 'bytes',
			tolerance: '10%',
			over: true
		}
	]
};

const measuredAfter = {
	size: [
		{ label: 'Source size', value: '52.1 KB', rawValue: 52100, unitOfMeasure: 'bytes' },
		{
			label: 'Emitted size · process (native)',
			target: 'process',
			value: '2.4 MB',
			rawValue: 2388000,
			unitOfMeasure: 'bytes'
		},
		{ label: 'Complexity', value: '19', rawValue: 19 }
	],
	performance: [
		{
			workload: 'explorer open',
			metric: 'Warm latency per call',
			target: 'process',
			profile: 'linux-x64-ci',
			value: '201 ms',
			rawValue: 201,
			unitOfMeasure: 'ms',
			tolerance: '5%',
			over: false
		},
		{
			workload: 'explorer open',
			metric: 'Benchmark process peak RSS',
			target: 'process',
			profile: 'linux-x64-ci',
			value: '40.9 MB',
			rawValue: 40900000,
			unitOfMeasure: 'bytes',
			tolerance: '10%',
			over: true
		}
	]
};

const unmeasuredBefore = {
	size: [
		{ label: 'Source size', value: 'Not measured', rawValue: null, unitOfMeasure: 'bytes' },
		{
			label: 'Emitted size',
			target: 'none',
			value: 'Not measured',
			rawValue: null,
			unitOfMeasure: 'bytes'
		},
		{ label: 'Complexity', value: 'Not measured', rawValue: null }
	],
	performance: [
		{
			workload: 'explorer open',
			metric: 'Warm latency per call',
			target: '',
			profile: '',
			value: 'Not measured',
			rawValue: null,
			tolerance: '5%',
			over: false
		},
		{
			workload: 'explorer open',
			metric: 'Benchmark process peak RSS',
			target: '',
			profile: '',
			value: 'Not measured',
			rawValue: null,
			tolerance: '10%',
			over: true
		}
	]
};

const unmeasuredAfter = {
	size: [
		{ label: 'Source size', value: 'Not measured', rawValue: null, unitOfMeasure: 'bytes' },
		{
			label: 'Emitted size · process (native)',
			target: 'process',
			value: 'Not measured',
			rawValue: null,
			unitOfMeasure: 'bytes'
		},
		{ label: 'Complexity', value: 'Not measured', rawValue: null }
	],
	performance: [
		{
			workload: 'explorer open',
			metric: 'Warm latency per call',
			target: 'process',
			profile: 'linux-arm64-ci',
			value: '151 ms',
			rawValue: 151,
			unitOfMeasure: 'ms',
			tolerance: '5%',
			over: false
		},
		{
			workload: 'explorer open',
			metric: 'Benchmark process peak RSS',
			target: 'process',
			profile: '',
			value: 'Not measured',
			rawValue: null,
			tolerance: '10%',
			over: true
		}
	]
};

test('Compares overview rows for equal profiles', () => {
	const changed = metricChanges(measuredBefore, measuredAfter);
	const unchanged = metricChanges(measuredBefore, measuredBefore);
	expect(changed).toEqual([
		{
			key: 'size:Source size:',
			label: 'Source size',
			before: '48.3 KB',
			after: '52.1 KB',
			change: '+3.8 KB'
		},
		{
			key: 'size:Emitted size · process (native):process',
			label: 'Emitted size · process (native)',
			before: '2.4 MB',
			after: '2.4 MB',
			change: '−12 KB'
		},
		{ key: 'size:Complexity:', label: 'Complexity', before: '17', after: '19', change: '+2' },
		{
			key: 'performance:Latency',
			label: 'Latency',
			before: '184 ms',
			after: '201 ms',
			change: '+17 ms'
		},
		{
			key: 'performance:Memory',
			label: 'Memory',
			before: '38.2 MB',
			after: '40.9 MB',
			change: '+2.7 MB'
		}
	]);
	expect(unchanged.map((row) => row.change)).toEqual([
		'No change',
		'No change',
		'No change',
		'No change',
		'No change'
	]);
	recordExampleCases(
		{
			unitId: 'reports.function.explorer-ui-metric-changes',
			symbol: 'metricChanges',
			state: 'compares-overview-rows-for-equal-profiles',
			evidence: 'examples-cases',
			file: 'compares-overview-rows-for-equal-profiles.json'
		},
		[
			{
				name: 'measured profiles compared across a release',
				input: { before: measuredBefore, after: measuredAfter },
				output: changed
			},
			{
				name: 'same measured profile compared with itself',
				input: { before: measuredBefore, after: measuredBefore },
				output: unchanged
			}
		]
	);
});

test('Marks missing or changed evidence without zero deltas', () => {
	const profileChanged = metricChanges(measuredBefore, unmeasuredAfter);
	const bothUnmeasured = metricChanges(unmeasuredBefore, unmeasuredAfter);
	expect(profileChanged).toEqual([
		{
			key: 'size:Source size:',
			label: 'Source size',
			before: '48.3 KB',
			after: 'Not measured',
			change: 'Not comparable'
		},
		{
			key: 'size:Emitted size · process (native):process',
			label: 'Emitted size · process (native)',
			before: '2.4 MB',
			after: 'Not measured',
			change: 'Not comparable'
		},
		{
			key: 'size:Complexity:',
			label: 'Complexity',
			before: '17',
			after: 'Not measured',
			change: 'Not comparable'
		},
		{
			key: 'performance:Latency',
			label: 'Latency',
			before: '184 ms',
			after: '151 ms',
			change: 'Profile changed',
			beforeContext: 'explorer open · process · linux-x64-ci',
			afterContext: 'explorer open · process · linux-arm64-ci'
		},
		{
			key: 'performance:Memory',
			label: 'Memory',
			before: '38.2 MB',
			after: 'Not measured',
			change: 'Not comparable'
		}
	]);
	expect(bothUnmeasured.map((row) => row.change)).toEqual([
		'Not comparable',
		'Not comparable',
		'Not comparable',
		'Not comparable',
		'Not comparable'
	]);
	recordExampleCases(
		{
			unitId: 'reports.function.explorer-ui-metric-changes',
			symbol: 'metricChanges',
			state: 'marks-missing-or-changed-evidence-without-zero-deltas',
			evidence: 'examples-cases',
			file: 'marks-missing-or-changed-evidence-without-zero-deltas.json'
		},
		[
			{
				name: 'earlier measured profile against a later profile with a different latency host',
				input: { before: measuredBefore, after: unmeasuredAfter },
				output: profileChanged
			},
			{
				name: 'both profiles unmeasured',
				input: { before: unmeasuredBefore, after: unmeasuredAfter },
				output: bothUnmeasured
			}
		]
	);
});

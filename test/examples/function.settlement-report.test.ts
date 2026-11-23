import type { Entry } from './function.settlement-report.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { settlementReport } from '../../src/utils/reports-media/run-isolated/settlementReport';
import { unknownSettlement } from '../../src/utils/reports-media/settlementReport';
import type { Judged } from '../../src/utils/reports-media/settlementReport.types';

const COMMAND = { pid: 47110, started: 'Sat Nov 14 21:46:58 2026' };
const OWN = "the command's own";
const HANDED = 'vetted service, vouched for, left the command, adopted by the system';
const UNKNOWN_REASONS = [
	'the process table could not be read in time',
	'the process table did not include the check itself'
];

function judged(entry: Entry): Judged {
	return {
		pid: entry.pid,
		started: entry.started,
		parent: COMMAND.pid,
		group: COMMAND.pid,
		origin: COMMAND,
		proven: true,
		verdict: { standing: entry.standing, reason: entry.reason, executable: entry.executable }
	};
}

function meta(state: string, symbol: string) {
	return {
		unitId: 'function.settlement-report',
		symbol,
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

const node = judged({
	pid: 48213,
	started: 'Sat Nov 14 21:47:09 2026',
	standing: 'private',
	reason: OWN,
	executable: '/usr/local/bin/node'
});
const sleep = judged({
	pid: 48377,
	started: 'Sat Nov 14 21:47:12 2026',
	standing: 'private',
	reason: OWN,
	executable: '/bin/sleep'
});
const ibtoold = judged({
	pid: 48902,
	started: 'Sat Nov 14 21:47:31 2026',
	standing: 'delegated',
	reason: HANDED,
	executable: '/Applications/Xcode.app/Contents/Developer/usr/bin/ibtoold'
});
const ref = (item: Judged) => ({ pid: item.pid, started: item.started });

test('Settlement lists stopped and still running processes', () => {
	const asked = [node, sleep];
	const last = [sleep];
	const result = settlementReport(asked, last);

	expect(result).toEqual({
		survivors: [ref(node), ref(sleep)],
		stopped: 1,
		resisted: 1,
		unknown: false,
		report:
			"\n[harness] process 48377 (started Sat Nov 14 21:47:12 2026) /bin/sleep: signalled but still running; the check fails: the command's own\n" +
			'[harness] process 48213 (started Sat Nov 14 21:47:09 2026) /usr/local/bin/node: stopped: left behind by the command\n'
	});
	recordExampleCases(
		meta('settlement-lists-stopped-and-still-running-processes', 'settlementReport'),
		[
			{
				name: 'one asked process stopped, one signalled process still running',
				input: { asked, last },
				output: result
			}
		]
	);
});

test('Settlement hands delegated processes over unchanged', () => {
	const last = [ibtoold];
	const result = settlementReport([], last);

	expect(result).toEqual({
		survivors: [],
		stopped: 0,
		resisted: 0,
		unknown: false,
		report:
			'\n[harness] process 48902 (started Sat Nov 14 21:47:31 2026) /Applications/Xcode.app/Contents/Developer/usr/bin/ibtoold: handed over to the system: vetted service, vouched for, left the command, adopted by the system\n'
	});
	recordExampleCases(
		meta('settlement-hands-delegated-processes-over-unchanged', 'settlementReport'),
		[
			{
				name: 'delegated process left by the command is handed over and not counted',
				input: { asked: [], last },
				output: result
			}
		]
	);
});

test('Settlement with a custom signal check', () => {
	const last = [sleep];
	const result = settlementReport([], last, () => false);

	expect(result).toEqual({
		survivors: [ref(sleep)],
		stopped: 0,
		resisted: 0,
		unknown: false,
		report:
			"\n[harness] process 48377 (started Sat Nov 14 21:47:12 2026) /bin/sleep: left running, not signalled; the check fails: the command's own\n"
	});
	recordExampleCases(meta('settlement-with-a-custom-signal-check', 'settlementReport'), [
		{
			name: 'running process the signal check does not report as signalled',
			input: { asked: [], last },
			output: result
		}
	]);
});

test('Unknown settlement fails the check with its reason', () => {
	const [first] = UNKNOWN_REASONS;
	const result = unknownSettlement(first);

	expect(result).toEqual({
		survivors: [],
		stopped: 0,
		resisted: 0,
		unknown: true,
		report:
			'\n[harness] the process table could not be read in time: nothing more was signalled, what the command left is unknown, and the check fails\n'
	});
	recordExampleCases(
		meta('unknown-settlement-fails-the-check-with-its-reason', 'unknownSettlement'),
		UNKNOWN_REASONS.map((why) => ({ name: why, input: why, output: unknownSettlement(why) }))
	);
});

import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { ReportCommand } from '../../src/commands/reports-media/ReportCommand';

const unitId = 'reports.command.report';
const usage =
	'Usage: report <begin|record|finalize|import|serve|stop|cleanup|sync-storage> [options]';
const recordData = '{"id":"unit-tests","title":"Unit tests","status":"passed"}';

async function rejectionOf(argv: string[]): Promise<string> {
	try {
		await new ReportCommand().run(argv);
	} catch (error) {
		return (error as Error).message;
	}
	throw new Error('run resolved instead of rejecting');
}

function meta(state: string) {
	return { unitId, symbol: 'run', state, evidence: 'examples-cases', file: `${state}.json` };
}

test('Rejects an unknown or empty operation with the usage error', async () => {
	const unknownArgv = ['explode', '--project', '/workspace/checkout-app'];
	const unknown = await rejectionOf(unknownArgv);
	const empty = await rejectionOf([]);

	expect(unknown).toBe(usage);
	expect(empty).toBe(usage);
	recordExampleCases(meta('rejects-an-unknown-or-empty-operation-with-the-usage-error'), [
		{ name: 'unrecognized first item', input: { argv: unknownArgv }, error: unknown },
		{ name: 'empty argv', input: { argv: [] }, error: empty }
	]);
});

test('Rejects a record without a run id', async () => {
	const argv = ['record', '--kind', 'check', '--data', recordData];
	const message = await rejectionOf(argv);

	expect(message).toBe('--run is required');
	recordExampleCases(meta('rejects-a-record-without-a-run-id'), [
		{ name: 'check record with data but no --run', input: { argv }, error: message }
	]);
});

test('Rejects begin with a mode other than feature or suite', async () => {
	const argv = [
		'begin',
		'--project',
		'/workspace/checkout-app',
		'--title',
		'Checkout flow',
		'--mode',
		'hotfix',
		'--environment',
		'staging'
	];
	const message = await rejectionOf(argv);

	expect(message).toBe('Project, title and valid mode are required');
	recordExampleCases(meta('rejects-begin-with-a-mode-other-than-feature-or-suite'), [
		{ name: 'mode hotfix is not a valid mode', input: { argv }, error: message }
	]);
});

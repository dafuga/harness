import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { ReportCommandService } from '../../src/services/reports-media/report-command-service/ReportCommandService';

test('Rejects an unsupported report operation', async () => {
	const input = ['unknown-operation'];
	let error: unknown;
	try {
		await new ReportCommandService().execute(input);
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(Error);
	const result = error as Error;
	expect(result.message).toContain('Usage: report');
	recordExampleCases(
		{
			unitId: 'reports.service.report-command',
			symbol: 'execute',
			state: 'rejects-an-unsupported-report-operation',
			evidence: 'examples-cases',
			file: 'rejects-an-unsupported-report-operation.json'
		},
		[
			{
				name: 'Unknown operation returns the documented usage error',
				input: { argv: input },
				error: { name: result.name, message: result.message }
			}
		]
	);
});

import { ReportCommandService } from '../services/ReportCommandService';
try {
	const result = await new ReportCommandService().execute(process.argv.slice(2));
	if ('id' in result)
		console.log(
			JSON.stringify({ run: result.id, state: 'state' in result ? result.state : undefined })
		);
	else console.log(JSON.stringify(result));
	if ('errors' in result && result.errors.length) process.exitCode = 1;
} catch (error) {
	console.error(error instanceof Error ? error.message : 'Report command failed');
	process.exitCode = 1;
}

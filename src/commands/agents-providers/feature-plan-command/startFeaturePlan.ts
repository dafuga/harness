import type { ModuleTaskServerService } from '../../../services/agents-providers/ModuleTaskServerService';

/** Keep queue-only retries distinct from an explicitly requested, approval-scoped worker batch. */
export async function startFeaturePlan(
	feature: string,
	options: { digest: string; worker?: string; parallelism?: string; json?: boolean },
	server: Pick<ModuleTaskServerService, 'submitApproved'> &
		Partial<Pick<ModuleTaskServerService, 'runApproved'>>,
	output: (text: string) => void
): Promise<void> {
	const request = { feature, expectedDigest: options.digest };
	if (options.worker === undefined) {
		if (options.parallelism !== undefined) throw new Error('Parallelism requires a worker.');
		const result = await server.submitApproved(request);
		output(
			options.json
				? JSON.stringify(result, null, 2)
				: `Submitted ${feature}: ${result.created.length} created, ${result.reused.length} reused.`
		);
		return;
	}
	if (options.parallelism !== undefined && !/^[1-8]$/.test(options.parallelism))
		throw new Error('Parallelism must be an integer from 1 to 8.');
	if (!server.runApproved) throw new Error('Approval-scoped worker is unavailable.');
	const controller = new AbortController();
	const abort = () => controller.abort(new Error('Approved task dispatch interrupted.'));
	process.on('SIGINT', abort);
	process.on('SIGTERM', abort);
	try {
		const result = await server.runApproved(request, {
			worker: options.worker,
			parallelism: Number(options.parallelism ?? '1'),
			signal: controller.signal
		});
		output(
			options.json
				? JSON.stringify(result, null, 2)
				: `Dispatched ${feature}: ${JSON.stringify(result.results)}`
		);
	} finally {
		process.off('SIGINT', abort);
		process.off('SIGTERM', abort);
	}
}

// @harness-uid u_xfnlgckxod
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { dockerDaemon } from '../../../adapters/agents-providers/managed-provider-docker-adapter/dockerControl';
import { recoverLaunches } from '../../../adapters/agents-providers/managed-provider-docker-adapter/dockerLaunchJournal';

/** Reuse the Docker adapter's engine, supervisor, volume and container ownership checks. */
export async function reapHygieneProviderDocker(directory: string) {
	try {
		return await recoverProviderDocker(join(directory, 'provider-docker'));
	} catch {
		return 'managed Docker task workspace';
	}
}

async function recoverProviderDocker(root: string) {
	const scopes = await readdir(root, { withFileTypes: true }).catch((error) => {
		if ((error as { code?: string }).code === 'ENOENT') return [];
		throw error;
	});
	for (const scope of scopes) {
		if (!scope.isDirectory() || !/^[a-f0-9]{64}$/.test(scope.name)) continue;
		const journal = join(root, scope.name);
		if (!(await readdir(journal)).length) continue;
		await recoverLaunches(journal, await dockerDaemon(), AbortSignal.timeout(30_000));
		if ((await readdir(journal)).length) return 'managed Docker task workspace';
	}
	return undefined;
}

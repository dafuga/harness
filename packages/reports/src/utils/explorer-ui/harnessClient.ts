import { ModuleDataSnapshotValidator } from '../../../../../src/validators/development-tooling/ModuleDataSnapshotValidator';
import { formatModuleDataFailure } from '../../../../../src/helpers/git-source-history/formatModuleDataFailure';
import type { HarnessClient } from './harnessClient.types';
import type { ProjectActivity } from '../../../../../src/core/activityTypes';
import type { StoredSide } from '../../../../../src/utils/sideImpact';
import type { HarnessIndex, HarnessRevision } from '../../models/explorer-ui/Harness.types';

/**
 * Fetches console data on demand from the protected endpoints. The index is one request; a
 * revision's detail is fetched only when that revision is looked at, and media only when shown.
 */
export function harnessClient(base: string, fetcher?: typeof fetch): HarnessClient {
	// Each screen of the explorer is a page of its own: they share what one of them has read.
	const shared = fetcher ? undefined : clients.get(base);
	if (shared) return shared;
	const client = reading(base, fetcher ?? fetch);
	if (!fetcher) clients.set(base, client);
	return client;
}

const clients = new Map<string, HarnessClient>();

function reading(base: string, fetcher: typeof fetch): HarnessClient {
	const cache = new Map<string, Promise<unknown>>();
	const load = <Result>(path: string): Promise<Result> => {
		const pending =
			cache.get(path) ??
			fetcher(`${base}/data/${path}`).then((response) => {
				if (!response.ok) throw new Error(`${path} could not be loaded (${response.status})`);
				return response.json() as Promise<unknown>;
			});
		cache.set(path, pending);
		pending.catch(() => cache.delete(path));
		return pending as Promise<Result>;
	};
	return {
		index: () => load<HarnessIndex>('index.json'),
		revision: async (commit) => {
			const revision = await load<HarnessRevision>(`revisions/${commit}.json`);
			const metadata = revision.moduleData;
			if (metadata?.required) {
				if (metadata.commit !== commit) {
					cache.delete(`revisions/${commit}.json`);
					throw new Error(
						'Module metadata belongs to a different revision; run harness validate --write.'
					);
				}
				const coverage = new ModuleDataSnapshotValidator().validate({
					declarations: revision.registry.units,
					registry: revision.registry,
					modules: metadata.modules,
					issues: metadata.issues,
					relationships: metadata.relationships
				});
				if (metadata.committed && !coverage.valid) {
					cache.delete(`revisions/${commit}.json`);
					throw new Error(
						`Incomplete module data: ${coverage.errors.join(' ')} Run harness validate --write.`
					);
				}

				const failure = metadata.committed
					? formatModuleDataFailure(metadata)
					: 'Missing committed module data. Run harness validate --write.';
				if (failure) {
					cache.delete(`revisions/${commit}.json`);
					throw new Error(failure);
				}
			}
			return revision;
		},
		side: (path) => load<StoredSide>(path),
		activity: () => load<ProjectActivity>('activity.json')
	};
}

export type { HarnessClient } from './harnessClient.types';

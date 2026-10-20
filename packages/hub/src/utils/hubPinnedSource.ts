import type { HubSourceContext } from './hubSource';
import { hubFail } from './hubJson';

/** Only an internally attested immutable commit; never resolve a moving ref here. */
export async function hubPinnedSource(
	base: HubSourceContext,
	commit: string
): Promise<HubSourceContext> {
	if (!/^[a-f0-9]{40}$/.test(commit)) return hubFail('invalid-evidence-revision');
	const revision = await base.source.resolve(base.repository, commit);
	if (revision.commit !== commit) return hubFail('invalid-evidence-revision');
	return {
		source: base.source,
		repository: base.repository,
		cache: base.cache,
		commit,
		entries: await base.source.tree(base.repository, commit),
		// Keep the requesting source tree and pinned notes/evidence in every cache identity.
		identity: { ...base.identity, requestedRef: commit }
	};
}

export { hubEvidencePath } from '../services/hub-attached-service/hubPinnedSource';

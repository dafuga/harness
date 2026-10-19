import type { HubSourceContext } from './hubSource';

/** An immutable design has one introduction. Rewrites or gaps do not attest a comparison. */
export async function hubArtifactCommit(
	context: HubSourceContext,
	path: string
): Promise<string | null> {
	if (!context.source.historyPage) return null;
	const history = await context.source.historyPage(context.repository, {
		commit: context.commit,
		paths: [path],
		page: 1,
		perPage: 2
	});
	return history.complete && history.commits.length === 1 ? history.commits[0].hash : null;
}

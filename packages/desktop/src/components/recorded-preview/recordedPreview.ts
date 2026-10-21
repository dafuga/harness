import type { RecordedThumbnail, PreviewState } from '../../utils/recordedPreview';
import type { Workspace } from '../../lib/stores/workspace.svelte';
import type { EntityEvidenceQuery, EntityEvidenceResult } from '../../models/DesktopEvidence.types';
import { artifactBytes } from './artifactBytes';
import { artifactQuery } from '../../utils/artifactQuery';
import { evidenceQuery } from '../../utils/evidenceQuery';

type PreviewPick = Required<Omit<RecordedThumbnail, 'source'>>;

const empty = (status: PreviewState['status'], reason = ''): PreviewState => ({
	status,
	url: '',
	caption: '',
	reason
});

function sameScope(result: EntityEvidenceResult, scope: EntityEvidenceQuery): void {
	if (result.scope.commit !== scope.commit || result.scope.location.entity !== scope.entityId)
		throw new Error('The screenshot answer belongs to another entity or commit.');
	if (scope.projectId && result.identity.projectId !== scope.projectId)
		throw new Error('The screenshot answer belongs to another project.');
	if (result.identity.sourceCommit !== scope.commit)
		throw new Error('The screenshot identity belongs to another commit.');
}

function declared(thumb: RecordedThumbnail): PreviewPick | null {
	if (thumb.scenario || thumb.state || thumb.viewport) {
		if (!thumb.scenario || !thumb.state || !thumb.viewport)
			throw new Error('The screenshot binding is incomplete.');
		return { scenario: thumb.scenario, state: thumb.state, viewport: thumb.viewport };
	}
	return null;
}

/** Older manifests can still name their exact page in the scenario's recorded state contract. */
function binding(
	result: EntityEvidenceResult,
	scope: EntityEvidenceQuery,
	thumb: RecordedThumbnail
): PreviewPick | null {
	const explicit = declared(thumb);
	if (explicit) return explicit;
	const scenario = result.evidence.after.detail?.registry.scenarios.find((item) =>
		item.states.some((state) => state.units?.includes(scope.entityId))
	);
	const state = scenario?.states.find(
		(item) => item.coverage === 'required' && item.units?.includes(scope.entityId)
	);
	if (!scenario || !state) return null;
	const shot = scenario.evidence?.find(
		(item) => item.kind === 'screenshot' && item.states.includes(state.id)
	);
	const views = scenario.viewports.filter((item) => shot?.viewports.includes(item.id));
	const viewport = views.find((item) => item.id === 'desktop') ?? views[0];
	return viewport ? { scenario: scenario.id, state: state.id, viewport: viewport.id } : null;
}

/** A page explicitly selects its state; another capture never fills a missing one. */
function selected(
	result: EntityEvidenceResult,
	scope: EntityEvidenceQuery,
	thumbnail: RecordedThumbnail
) {
	sameScope(result, scope);
	const thumb = binding(result, scope, thumbnail);
	if (!thumb) return null;
	const found = result.evidence.after.captures.find(
		(item) =>
			item.scenario === thumb.scenario &&
			item.state === thumb.state &&
			item.capture.viewport === thumb.viewport &&
			item.capture.kind === 'screenshot' &&
			item.usable &&
			item.capture.media !== null
	);
	if (!found) return null;
	const query = artifactQuery(result, scope, 'after', found);
	if (!query) return null;
	const origin = found.current ? scope.commit : found.inheritedFrom;
	if (!origin) return null;
	return {
		query,
		caption: `Screenshot · ${thumb.state.replaceAll('-', ' ')} · ${origin.slice(0, 7)}${found.inheritedFrom ? ' · inherited' : ''}`
	};
}

/** Reads through the existing evidence port; stale reads and corrupt bytes never paint a card. */
export function recordedPreview(
	workspace: Workspace,
	entityId: string,
	thumbnail: RecordedThumbnail,
	apply: (state: PreviewState) => void
): () => void {
	const scope = evidenceQuery(workspace, entityId),
		bridge = workspace.bridge;
	let disposed = false,
		url = '';
	apply(empty('loading'));
	if (scope && bridge?.evidence) {
		void bridge
			.evidence(scope)
			.then(async (result) => {
				if (disposed) return;
				const pick = selected(result, scope, thumbnail);
				if (!pick) return apply(empty('missing', 'This state has no usable recorded screenshot.'));
				const { bytes, mediaType } = await artifactBytes(bridge, pick.query);
				if (disposed) return;
				if (!['image/png', 'image/jpeg'].includes(mediaType))
					throw new Error('The recorded bytes are not a screenshot.');
				url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mediaType }));
				apply({ status: 'ready', url, caption: pick.caption, reason: '' });
			})
			.catch((cause: unknown) => {
				if (!disposed)
					apply(empty('error', cause instanceof Error ? cause.message : String(cause)));
			});
	} else apply(empty('missing', 'Recorded screenshots cannot be read on this connection.'));
	return () => {
		disposed = true;
		if (url) URL.revokeObjectURL(url);
	};
}

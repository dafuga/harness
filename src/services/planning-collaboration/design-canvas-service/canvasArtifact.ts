// @harness-uid u_ozmtfxnnar
import type { DesignCanvasData } from '../../../../packages/reports/src/utils/planning-collaboration/designCanvas.types';
import { designsRoot } from '../../../../packages/reports/src/utils/planning-collaboration/canvasManifest';
import type { TrackerArtifact } from '../../../utils/projects-sessions/trackerPlanning.types';

import type { Source } from './canvasArtifact.types';

/**
 * A planning stage's artifact with this canvas on it. What the stage already holds is kept; only
 * this canvas's own pages and links are replaced, so attaching again after a change is safe.
 */
export function canvasArtifact(
	canvas: DesignCanvasData,
	source: Source,
	existing: TrackerArtifact = {}
): TrackerArtifact {
	const folder = `${designsRoot}/${canvas.name}`;
	const prefix = `${canvas.title} · `;
	const pages = canvas.boards.map((board) => ({
		name: prefix + board.title,
		links: [
			{
				label: `${board.title} artboard (${board.width}x${board.height})`,
				url: `${source.repository}/blob/${source.commit}/${folder}/${board.file}`
			}
		]
	}));
	const folderUrl = `${source.repository}/tree/${source.commit}/${folder}`;
	const links = [{ label: prefix + 'committed canvas', url: folderUrl }];
	if (source.viewer)
		links.unshift({
			label: prefix + 'open canvas',
			url: viewerUrl(source.viewer, canvas.name, source.branch)
		});
	return {
		...existing,
		pages: [...(existing.pages ?? []).filter((p) => !p.name.startsWith(prefix)), ...pages],
		links: [...(existing.links ?? []).filter((l) => !l.label.startsWith(prefix)), ...links]
	};
}

/** `viewer` is a Hub project's address, `https://hub/projects/<id>`. */
function viewerUrl(viewer: string, canvas: string, branch: string): string {
	return `${viewer.replace(/\/+$/, '')}/designs/${canvas}?branch=${encodeURIComponent(branch)}`;
}

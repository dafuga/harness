// @harness-uid u_nfctcgnv7g
import { stableJson } from '../../../utils/development-tooling/stableJson';
import { clipDigest, createClipInputContext, readClipInput } from './clipInputFiles';
import { clipInputClosure } from './clipInputClosure';
import type { VideoManifest } from '../../../utils/verification-evidence/videoClipSchema.types';
import type { ClipInputContext } from './clipInputs.types';
import type { VideoSlot } from '../VideoEvidenceService.types';

/** Hash a complete dependency proof, without tying clip bytes to playlist order or Git HEAD. */
export function clipInputHash(
	root: string | ClipInputContext,
	manifest: VideoManifest,
	clip: VideoManifest['clips'][number],
	viewport: string
): string {
	const context = typeof root === 'string' ? createClipInputContext(root) : root;
	const closure = clipInputClosure(context, clip);
	const graphs = manifest.graphs
		.filter((graph) => graph.clips.includes(clip.id))
		.map((graph) => ({
			id: graph.id,
			unit: graph.unit,
			initial: graph.initial,
			terminals: graph.terminals.filter((id) => clip.states.includes(id)),
			states: graph.states.filter((state) => clip.states.includes(state.id)),
			edges: graph.edges.filter((edge) => clip.edges.includes(edge.id))
		}));
	return clipDigest(
		stableJson({
			clip,
			viewport: manifest.viewports.find((item) => item.id === viewport),
			graphs,
			inputs: [...closure.files].sort().map((path) => [path, readClipInput(context, path).sha256]),
			contracts: [...closure.contracts].sort(([a], [b]) => a.localeCompare(b)),
			reasons: [...closure.reasons].sort(),
			recipe: [
				'dependency-closure-v2',
				'playwright-chromium',
				'native-jpeg-sample-previous-h264-yuv420p-30fps-v1',
				context.tool,
				process.platform,
				process.arch
			]
		})
	);
}

export function clipInputSlot(
	context: ClipInputContext,
	manifest: VideoManifest,
	clip: VideoManifest['clips'][number],
	viewport: string
): VideoSlot {
	const inputHash = clipInputHash(context, manifest, clip, viewport),
		closure = clipInputClosure(context, clip);
	return {
		unit: clip.unit,
		clipId: clip.id,
		viewport,
		inputHash,
		dependencies: [...closure.files].sort(),
		reasons: [...closure.reasons].sort()
	};
}

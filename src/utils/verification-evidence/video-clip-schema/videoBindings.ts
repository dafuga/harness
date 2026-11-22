// @harness-uid u_o2djhpwgs7
import type { RefinementCtx } from 'zod';
import type { VideoManifest, VideoGraph, VideoClip } from '../videoClipSchema.types';

/** Check identities and checkpoint relationships, independently of executable scripts. */
export function videoBindings(manifest: VideoManifest, context: RefinementCtx): void {
	const issues: string[] = [];
	const viewportIds = new Set(manifest.viewports.map((viewport) => viewport.id));
	const clips = new Map(manifest.clips.map((clip) => [clip.id, clip]));
	for (const clip of manifest.clips) issues.push(...clipIssues(clip, viewportIds));
	for (const graph of manifest.graphs) {
		issues.push(...graphIssues(graph));
		for (const id of graph.clips) {
			const clip = clips.get(id);
			if (!clip) issues.push(`${graph.id}: unknown clip ${id}`);
			else issues.push(...clipGraphIssues(clip, graph));
		}
	}
	for (const playlist of manifest.playlists)
		if (playlist.clips.some((id) => !clips.has(id)))
			issues.push(`${playlist.id}: unknown playlist clip`);
	for (const message of issues) context.addIssue({ code: 'custom', message });
}

function graphIssues(graph: VideoGraph): string[] {
	const states = new Set(graph.states.map((state) => state.id));
	const errors: string[] = [];
	if (![graph.initial, ...graph.terminals].every((state) => states.has(state)))
		errors.push(`${graph.id}: unknown checkpoint`);
	if (graph.edges.some((edge) => !states.has(edge.from) || !states.has(edge.to)))
		errors.push(`${graph.id}: unknown edge endpoint`);
	const reached = new Set<string>(),
		pending = [graph.initial];
	while (pending.length) {
		const state = pending.pop()!;
		if (reached.has(state)) continue;
		reached.add(state);
		pending.push(...graph.edges.filter((edge) => edge.from === state).map((edge) => edge.to));
	}
	if (graph.states.some((state) => !reached.has(state.id)))
		errors.push(`${graph.id}: unreachable required state`);
	return errors;
}

function clipGraphIssues(clip: VideoClip, graph: VideoGraph): string[] {
	const states = new Set(graph.states.map((state) => state.id));
	const edges = new Set(graph.edges.map((edge) => edge.id));
	const errors: string[] = [];
	if (clip.unit !== graph.unit) errors.push(`${clip.id}: graph and clip owners differ`);
	if ([clip.entry, clip.exit, ...clip.states].some((state) => !states.has(state)))
		errors.push(`${clip.id}: incompatible graph checkpoint`);
	if (clip.edges.some((edge) => !edges.has(edge))) errors.push(`${clip.id}: unknown graph edge`);
	return errors;
}

function clipIssues(clip: VideoClip, viewportIds: Set<string>): string[] {
	const issues: string[] = [];
	if (clip.viewports.some((viewport) => !viewportIds.has(viewport)))
		issues.push(`${clip.id}: unknown viewport`);
	if (clip.checkpoints?.some((point) => !clip.viewports.includes(point.viewport)))
		issues.push(`${clip.id}: checkpoint viewport must be declared for this clip`);
	if (![clip.entry, clip.exit].every((state) => clip.states.includes(state)))
		issues.push(`${clip.id}: checkpoints must be asserted clip states`);
	return issues;
}

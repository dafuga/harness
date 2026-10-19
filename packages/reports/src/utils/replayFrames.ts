import type { Evidence } from '../models/Report.types';
import { evidenceMedia } from './evidenceMedia';
export const FRAME_SECONDS = 3;
export const REPLAY_SPEEDS = [0.25, 0.5, 1, 2, 4, 8, 16];
export interface ReplayFrame {
	item: Evidence;
	scene: number | null;
	index: number;
	start: number;
	duration: number;
}
export function replayStart(frames: ReplayFrame[]) {
	return Math.max(
		frames.findIndex((frame) => frame.scene !== null),
		0
	);
}
export function replayFrames(items: Evidence[]): ReplayFrame[] {
	return items
		.map((item, index) => ({ item, index }))
		.filter(
			({ item }) => !item.missing && item.phase !== 'before' && evidenceMedia(item) === 'image'
		)
		.sort((a, b) => (a.item.order ?? a.index) - (b.item.order ?? b.index) || a.index - b.index)
		.map(({ item }, index) => ({
			item,
			index,
			scene: sceneNumber(item.title),
			start: index * FRAME_SECONDS,
			duration: FRAME_SECONDS
		}));
}
function sceneNumber(title: string) {
	const match = title.match(/^Scene\s+(\d+)\b/i);
	return match ? Number(match[1]) : null;
}

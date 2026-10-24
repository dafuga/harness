import type { ReplayFrame } from '../../../utils/reports-media/replayFrames';
import { replayStart } from './replayFrames';

/** @pure Return distinct numbered scenes in playback order. */
export function replayScenes(frames: ReplayFrame[]): number[] {
	return [...new Set(frames.flatMap((frame) => (frame.scene === null ? [] : [frame.scene])))].sort(
		(left, right) => left - right
	);
}

/** @pure Retain the selected frame by identity, with the same bounded fallback index. */
export function replayCursorIndex(
	frames: ReplayFrame[],
	cursor: { id: string | null; index: number }
): number {
	const found = frames.findIndex((frame) => frame.item.id === cursor.id);
	const start = cursor.id === null ? replayStart(frames) : cursor.index;
	return found >= 0 ? found : Math.min(start, Math.max(frames.length - 1, 0));
}

/** @pure Select the translated playback notice for the current state. */
export function replayNotice(
	state: { exporting: boolean; atEnd: boolean; live: boolean; playing: boolean },
	translate: (key: string) => string
): string {
	if (state.exporting) return translate('replay.preparing');
	if (!state.atEnd) return '';
	if (state.live) return state.playing ? translate('replay.waiting') : '';
	return translate('replay.ended');
}

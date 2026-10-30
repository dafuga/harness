import type { PreviewCases } from './shared';

/** Distinct replay controls states keep playback, selection and unavailable controls visible. */
export function replayControlsVariant(props: PreviewCases[string], variant: string) {
	if (variant === 'playing') return { ...props, playing: true, elapsed: 6 };
	if (variant === 'middle-frame') return { ...props, index: 1, elapsed: 6 };
	if (variant === 'final-frame') return { ...props, index: 2, elapsed: 15 };
	if (variant === 'single-frame')
		return { ...props, count: 1, index: 0, total: 5, elapsed: 5, scene: null, scenes: [] };
	if (variant === 'scene-unselected') return { ...props, scene: null };
	if (variant === 'no-scenes') return { ...props, scene: null, scenes: [] };
	if (variant === 'fullscreen') return { ...props, fullscreen: true };
	if (variant === 'speed-2x') return { ...props, speed: 2 };
	return ['speed-open', 'scene-open'].includes(variant) ? props : null;
}

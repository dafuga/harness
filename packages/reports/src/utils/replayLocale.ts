import { addMessages } from 'svelte-i18n';
let registered = false;
// Replay strings sit beside the report dictionary under `replay.*`; safe to call repeatedly.
export function replayLocale() {
	if (registered) return;
	registered = true;
	addMessages('en', {
		replay: {
			heading: 'Gameplay replay',
			subtitle:
				'Screenshot replay, not continuous video. Original captures in recorded order, {seconds}s each.',
			recording: 'Recording',
			complete: 'Capture complete',
			emptyTitle: 'Waiting for the first capture',
			emptyBody: 'Screenshots appear here as the game is played.',
			player: 'Replay player',
			transport: 'Playback',
			play: 'Play replay',
			pause: 'Pause replay',
			previous: 'Previous frame',
			next: 'Next frame',
			timeline: 'Replay timeline',
			timelineValue: 'Frame {frame} of {count}: {title}',
			time: '{elapsed} / {total}',
			speed: 'Playback speed',
			speedValue: '{speed, number}×',
			scene: 'Jump to scene',
			noScene: 'No scene',
			sceneValue: 'Scene {scene}',
			frameCount: 'Frame {frame} of {count}',
			latest: 'Jump to latest',
			fullscreen: 'Full screen',
			exitFullscreen: 'Exit full screen',
			loading: 'Loading screenshot…',
			error: 'This screenshot could not be loaded.',
			retry: 'Retry',
			skip: 'Skip frame',
			waiting: 'Waiting for the next capture…',
			ended: 'End of replay. Play to start again.',
			download: 'Download MP4',
			downloadHint:
				'Silent MP4 of these screenshots in order, {seconds}s per frame. Preparing it can take a few seconds.',
			preparing: 'Preparing MP4… this can take a few seconds.'
		}
	});
}

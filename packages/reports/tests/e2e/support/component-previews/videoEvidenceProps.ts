import { videoItem } from '../../../../test/components/verification-evidence/videoEvidenceFixture';
export const videoEvidenceProps = {
	item: {
		...videoItem,
		file: '/media/video-player-fixture.mp4',
		durationSeconds: 1,
		video: {
			...videoItem.video!,
			frameRate: 30,
			frameCount: 30,
			poster: { ...videoItem.video!.poster, url: undefined }
		}
	}
};

/** Deliberately incomplete preview of modular paths, separate from verification evidence. */
export const videoGraphNavigationProps = {
	library: {
		graphs: [],
		playlists: [
			{ id: 'search-match', clips: ['match'] },
			{ id: 'search-empty', clips: ['empty'] }
		],
		discoveryGaps: [{ unit: 'page.platforms', reason: 'Status filtering awaits inventory.' }]
	},
	coverage: [
		{
			graph: 'platform-search',
			states: 1,
			edges: 0.5,
			clips: 0.5,
			complete: false,
			missing: ['mobile/search-empty']
		}
	]
};

import { frameFlags } from '../../../../test/components/verification-evidence/videoEvidenceFixture';
import { videoPlayerVariantProps } from './videoPlayerVariantProps';
import { videoGraphVariantProps } from './videoGraphVariantProps';
import type { PreviewProps } from './shared.types';

export const videoPlayerStates = [
	'empty-asset-base',
	'without-initial-flags',
	'with-initial-flags',
	'initial-flags-none',
	'initial-flags-one',
	'initial-flags-many',
	'failed',
	'error',
	'empty',
	'none',
	'one',
	'many'
];
export const videoGraphStates = [
	'empty-library',
	'library-none',
	'library-one',
	'library-many',
	'graphs',
	'playlists',
	'without-coverage',
	'with-coverage',
	'coverage-none',
	'coverage-one',
	'coverage-many',
	'without-selected',
	'with-selected',
	'empty-selected',
	'empty',
	'none',
	'one',
	'many'
];
export const videoCatalogVariants = {
	'reports.component.verification-evidence-video-evidence': videoPlayerStates,
	'reports.component.verification-evidence-video-graph-navigation': videoGraphStates
};

export function videoFixtureFlags(variant: string) {
	const flags = videoFlags(variant);
	return flags.map((flag) => ({ ...flag, atSeconds: flag.frameNumber / 30 }));
}

function videoFlags(variant: string) {
	if (!variant) return [{ ...frameFlags[0], frameNumber: 5 }];
	if (['initial-flags-one', 'one'].includes(variant)) return frameFlags.slice(0, 1);
	if (['initial-flags-many', 'with-initial-flags', 'many'].includes(variant)) return frameFlags;
	return [];
}

export function videoCatalogProps(id: string, variant: string): PreviewProps | null {
	if (id === 'reports.component.verification-evidence-video-evidence')
		return videoPlayerVariantProps(variant, videoFixtureFlags(variant));
	if (id === 'reports.component.verification-evidence-video-graph-navigation')
		return videoGraphVariantProps(variant);
	return null;
}

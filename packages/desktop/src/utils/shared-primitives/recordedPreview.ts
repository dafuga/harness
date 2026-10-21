import type { Thumbnail } from '../../models/development-tooling/Desktop.types';

export type RecordedThumbnail = Extract<Thumbnail, { source: 'recorded' }>;

export interface PreviewState {
	status: 'loading' | 'ready' | 'missing' | 'error';
	url: string;
	caption: string;
	reason: string;
}

export { recordedPreview } from '../../components/shared-primitives/recorded-preview/recordedPreview';

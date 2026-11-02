import { audioComparisonPreMount } from './audioComparisonPreMount';
import { uploadComparisonPreMount } from './uploadComparisonPreMount';
import { uploadAudioPreMount } from './uploadAudioPreMount';

export async function previewMountMarkup(id: string, variant: string) {
	if (variant !== 'pre-mount') return '';
	if (id === 'reports.component.audio-comparison') return audioComparisonPreMount();
	if (id === 'reports.component.upload-comparison') return uploadComparisonPreMount();
	if (id === 'reports.component.upload-audio') return uploadAudioPreMount();
	return '';
}

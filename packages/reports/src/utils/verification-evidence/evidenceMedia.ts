import type { Evidence } from '../../models/reports-media/Report.types';
const mimes: Record<string, string> = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
	'.wav': 'audio/wav',
	'.mp3': 'audio/mpeg',
	'.m4a': 'audio/mp4',
	'.ogg': 'audio/ogg',
	'.mp4': 'video/mp4',
	'.pdf': 'application/pdf',
	'.zip': 'application/zip',
	'.html': 'text/html'
};
export function mediaMime(file: string) {
	return mimes[file.slice(file.lastIndexOf('.')).toLowerCase()] || 'application/octet-stream';
}
export function evidenceMedia(item: Pick<Evidence, 'mediaType' | 'file'>): 'image' | 'audio' {
	return (
		item.mediaType ||
		(mediaMime(item.file).startsWith('audio/') || item.file.startsWith('data:audio/')
			? 'audio'
			: 'image')
	);
}

export { formatDuration } from '../../helpers/strings/formatDuration';

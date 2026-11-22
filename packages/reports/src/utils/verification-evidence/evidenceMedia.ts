// @harness-uid u_nyfobmqpe6
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
export function evidenceMedia(
	item: Pick<Evidence, 'mediaType' | 'file' | 'mimeType'>
): 'image' | 'audio' | 'video' {
	if (item.mediaType) return item.mediaType;
	for (const kind of ['audio', 'video'] as const)
		if (
			(item.mimeType || mediaMime(item.file)).startsWith(kind + '/') ||
			item.file.startsWith('data:' + kind + '/')
		)
			return kind;
	return 'image';
}

export { formatDuration } from '../../helpers/strings/formatDuration';

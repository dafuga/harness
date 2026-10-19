/** A process owns the preview slot until it exits; this endpoint can only read its status. */
export interface PreviewOwner {
	protocol: 'harness-preview-v1';
	identity: string;
	url: string | null;
	pid: number;
}

export const previewOwnerPort = 47840;

export const previewOwnerPath = '/__harness_preview__';

export { previewOwner } from '../services/preview-server-service/previewOwner';

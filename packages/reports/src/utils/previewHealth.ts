/** Private health protocol between the supervisor and the exact worker it spawned. */
export interface PreviewHealth {
	protocol: 'harness-worker-v1';
	pid: number;
	errors: number;
	busy: boolean;
}

export const path = '/__harness_worker__';

export { closePreviewSessions, previewHealth } from '../lib/initialize-preview/previewHealth';
export { readPreviewHealth } from '../lib/preview-node/preview-worker-service/previewHealth';

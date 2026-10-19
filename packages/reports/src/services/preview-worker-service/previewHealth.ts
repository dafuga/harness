import { PreviewHealth, path } from '../../utils/previewHealth';

export async function readPreviewHealth(url: string, token: string): Promise<PreviewHealth> {
	const response = await fetch(url + path, {
		headers: { 'x-harness-worker': token },
		signal: AbortSignal.timeout(750),
		redirect: 'error'
	});
	const health = (await response.json()) as PreviewHealth;
	if (!response.ok || health.protocol !== 'harness-worker-v1') throw new Error('Worker not ready.');
	return health;
}

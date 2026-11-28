import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { featureDeliveryDuration } from '../../src/utils/projects-sessions/featureDelivery';
import { deliveryProcess } from './deliveryProcess';

const maxVideoBytes = 64 * 1024 * 1024;

export async function recordDelivery(command: string[]) {
	const env = Object.fromEntries(
		Object.entries(process.env).filter(
			([key, value]) =>
				value !== undefined && /^(?:PATH|HOME|USER|LOGNAME|TMPDIR|HEADLESS_RUN_[A-Z_]+)$/.test(key)
		)
	) as Record<string, string>;
	const run = await deliveryProcess(['headless-run', '--', ...command], env);
	const directory = /^headless-run:.*Artifacts: (\/[^\r\n]+)$/m.exec(run.stderr)?.[1];
	if (run.code !== 0 || !directory)
		throw new Error(
			directory
				? `Headless recording failed. Artifacts at ${directory}`
				: 'Headless recording failed'
		);
	return probeDelivery(join(directory, 'feature-delivery.webm'));
}

export async function probeDelivery(path: string) {
	await assertVideoFile(path);
	return { bytes: await readFile(path), durationSeconds: await duration(path) };
}

async function assertVideoFile(path: string) {
	const file = await lstat(path).catch(() => null);
	if (!file?.isFile() || !file.size || file.size > maxVideoBytes)
		throw new Error('Expected a nonempty feature video under 64 MiB');
}

async function duration(path: string) {
	const probe = await deliveryProcess([
		'ffprobe',
		'-v',
		'error',
		'-select_streams',
		'v:0',
		'-show_entries',
		'stream=codec_type:format=duration,format_name',
		'-of',
		'json',
		path
	]);
	if (probe.code !== 0) throw new Error('The recorded feature video could not be opened');
	const value = JSON.parse(probe.stdout);
	if (!value.streams?.some(({ codec_type }: { codec_type?: string }) => codec_type === 'video'))
		throw new Error('The recording has no video track');
	if (!value.format?.format_name?.split(',').includes('webm'))
		throw new Error('The headless recording must be WebM');
	return featureDeliveryDuration.parse(Number(value.format?.duration));
}

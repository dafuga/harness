// @harness-uid u_pmptujoqui
import { open } from 'node:fs/promises';
import type { HomeProviderReadings } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import { homeProviders } from '$reports/lib/projects-sessions/hub-home/homeProviderPayload';
import { noProviders } from '$reports/lib/projects-sessions/hub-home/homeTrackerProjection';

const every = 5 * 60 * 1000;

async function readTelemetry(file: string, byteLimit: number): Promise<unknown> {
	const handle = await open(file, 'r');
	try {
		const stat = await handle.stat();
		if (!stat.isFile() || stat.size > byteLimit) return null;
		return JSON.parse(await handle.readFile({ encoding: 'utf8' }));
	} finally {
		await handle.close();
	}
}

async function readExternal(file: string | undefined): Promise<HomeProviderReadings> {
	if (!file) return noProviders;
	try {
		return homeProviders.parse(await readTelemetry(file, 240 * 1024));
	} catch {
		return noProviders;
	}
}

export function createHomeProviderReader(file?: string) {
	let lastRead = -Infinity;
	let cached: HomeProviderReadings = noProviders;
	return async (now: number): Promise<HomeProviderReadings> => {
		if (now - lastRead < every) return cached;
		lastRead = now;
		cached = await readExternal(file);
		return cached;
	};
}

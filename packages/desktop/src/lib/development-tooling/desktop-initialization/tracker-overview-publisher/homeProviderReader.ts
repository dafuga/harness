// @harness-uid u_pmptujoqui
import { open } from 'node:fs/promises';
import type {
	HomeProviderReadings,
	HomeSubscription
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import { homeProviders } from '$reports/lib/projects-sessions/hub-home/homeProviderPayload';
import type { QuotaSource } from './codexQuotaSource.types';
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

/** Live readings win over the owner file for the same provider; either alone is enough to answer. */
function withLive(external: HomeProviderReadings, live: HomeSubscription[]): HomeProviderReadings {
	if (!live.length) return external;
	const providers = new Set(live.map((entry) => entry.provider));
	const kept = (external.quota ?? []).filter((entry) => !providers.has(entry.provider));
	return { ...external, quota: [...live, ...kept] };
}

/**
 * Reads the owner file and, when given, live sources such as the Codex CLI. A source that fails
 * keeps its last good reading, which the Hub treats as unknown once it is an hour old.
 */
export function createHomeProviderReader(file?: string, sources: QuotaSource[] = []) {
	let lastRead = -Infinity;
	let cached: HomeProviderReadings = noProviders;
	const last = new Map<QuotaSource, HomeSubscription>();
	return async (now: number): Promise<HomeProviderReadings> => {
		if (now - lastRead < every) return cached;
		lastRead = now;
		const [external] = await Promise.all([
			readExternal(file),
			...sources.map(async (source) => {
				const reading = await source(now).catch(() => null);
				if (reading) last.set(source, reading);
			})
		]);
		cached = withLive(external, [...last.values()]);
		return cached;
	};
}

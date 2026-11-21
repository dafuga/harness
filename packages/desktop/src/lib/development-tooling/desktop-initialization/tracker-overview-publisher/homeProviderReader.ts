// @harness-uid u_pmptujoqui
import { open, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type {
	HomeProviderReadings,
	HomeSubscription
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import {
	homeProviders,
	homeSubscriptionPayload
} from '$reports/lib/projects-sessions/hub-home/homeProviderPayload';
import { noProviders } from '$reports/lib/projects-sessions/hub-home/homeTrackerProjection';
import { readCodexUsage } from './homeCodexUsage';

const every = 5 * 60 * 1000;
const day = 24 * 60 * 60 * 1000;

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

async function codexHistory(reading: HomeSubscription, file: string, now: number) {
	const prior = homeSubscriptionPayload.safeParse(
		await readTelemetry(file, 12 * 1024).catch(() => null)
	);
	const history = prior.success && prior.data.id === reading.id ? prior.data.history : [];
	const at = reading.readAt.slice(0, 10);
	const since = new Date(now - day * 6).toISOString().slice(0, 10);
	const fresh = history.filter((sample) => sample.day >= since && sample.day < at);
	const weekly = reading.limits.find((limit) => limit.label === 'Weekly');
	const next = {
		...reading,
		history: weekly ? [...fresh, { day: at, used: 100 - weekly.left }] : fresh
	};
	const tmp = file + '.' + randomUUID() + '.tmp';
	await writeFile(tmp, JSON.stringify(next), { mode: 0o600 });
	await rename(tmp, file);
	return next;
}

export function createHomeProviderReader(options: { file?: string; codexHistoryFile?: string }) {
	let lastRead = -Infinity;
	let cached: HomeProviderReadings = noProviders;
	return async (now: number): Promise<HomeProviderReadings> => {
		if (now - lastRead < every) return cached;
		lastRead = now;
		const external = await readExternal(options.file);
		const file = options.codexHistoryFile;
		const reading = file ? await readCodexUsage(now).catch(() => undefined) : null;
		const prior =
			reading === undefined ? cached.quota?.find((sub) => sub.provider === 'codex') : null;
		const codex =
			reading && file ? await codexHistory(reading, file, now).catch(() => reading) : prior;
		const quota = (external.quota ?? []).filter((sub) => sub.id !== codex?.id);
		cached = {
			routines: external.routines,
			quota: codex || external.quota ? [...quota, ...(codex ? [codex] : [])].slice(0, 20) : null
		};
		return cached;
	};
}

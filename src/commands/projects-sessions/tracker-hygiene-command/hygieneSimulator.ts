// @harness-uid u_spkeodq5z6
import { HygieneError } from './HygieneError';
import { execFile } from 'node:child_process';
import { basename } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { beginResource, markResource, saveResource } from './hygieneLedger';

const exec = promisify(execFile);
const udidPattern = z.string().uuid();
const simulatorName = (entry: string) => 'Harness run ' + basename(entry);

export async function openHygieneSimulator(source: string) {
	if (process.env.HARNESS_TRACKER_NODE === 'harbor-mbp-2')
		throw new HygieneError('Simulator work belongs on the primary Mac.');
	udidPattern.parse(source);
	const entry = beginResource({ kind: 'simulator' });
	const udid = udidPattern.parse(await simctl(['clone', source, simulatorName(entry)]));
	saveResource(entry, { kind: 'simulator', udid });
	try {
		await simctl(['boot', udid]);
		return { resource: basename(entry), udid };
	} finally {
		markResource(entry, 'ready');
	}
}

export async function closeHygieneSimulator(entry: string, udid?: string) {
	const name = simulatorName(entry);
	const devices = await simulators();
	const match = devices.find((device) => (udid ? device.udid === udid : device.name === name));
	if (!match) return;
	if (match.name !== name) throw new HygieneError('Simulator clone ownership changed.');
	await simctl(['shutdown', match.udid]).catch(() => undefined);
	await simctl(['delete', match.udid]).catch(() => undefined);
	if ((await simulators()).some((device) => device.udid === match.udid))
		throw new HygieneError('Simulator clone is still present.');
}

async function simulators() {
	const { devices } = z
		.object({
			devices: z.record(
				z.string(),
				z.array(
					z.object({
						name: z.string(),
						udid: udidPattern
					})
				)
			)
		})
		.parse(JSON.parse(await simctl(['list', 'devices', '-j'])));
	return Object.values(devices).flat();
}

async function simctl(args: string[]) {
	if (process.platform !== 'darwin')
		throw new HygieneError('Run-owned iOS simulators require macOS.');
	return (
		await exec('/usr/bin/xcrun', ['simctl', ...args], { timeout: 25_000, maxBuffer: 2 ** 20 })
	).stdout.trim();
}

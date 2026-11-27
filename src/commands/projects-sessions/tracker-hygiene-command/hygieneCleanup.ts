import { existsSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { z } from 'zod';
import { markResource, readResource, writeHygieneJson } from './hygieneLedger';
import { closeHygieneBrowser } from './hygieneBrowser';
import { closeHygieneContainer } from './hygieneContainer';
import { closeHygieneSimulator } from './hygieneSimulator';
import { closeHygieneProcess } from './hygieneProcess';
import { reapHygieneProviderDocker } from './hygieneProviderDocker';
import { waitForHygiene } from './hygieneChild';

export async function sweepHygiene(directory: string) {
	markResource(directory, 'closing');
	const entries = readdirSync(directory, { withFileTypes: true }).filter(
		(item) => item.isDirectory() && z.string().uuid().safeParse(item.name).success
	);
	const outcomes = [await reapHygieneProviderDocker(directory)];
	for (let index = 0; index < entries.length; index += 4) {
		const batch = entries.slice(index, index + 4);
		outcomes.push(
			...(await Promise.all(batch.map(({ name }) => sweepResource(join(directory, name)))))
		);
	}
	const remaining = outcomes.filter((entry): entry is string => Boolean(entry));
	writeHygieneJson(join(directory, 'cleanup.json'), { remaining });
	return remaining;
}

export async function sweepResource(entry: string) {
	let kind = 'unverified resource';
	try {
		if (existsSync(join(entry, 'closed'))) return;
		const settled = await waitForHygiene(
			() => existsSync(join(entry, 'ready')) || existsSync(join(entry, 'closed')),
			3000
		);
		if (existsSync(join(entry, 'closed'))) return;
		const resource = readResource(entry);
		kind = resource.kind;
		try {
			await reapResource(entry, resource);
		} finally {
			// A creation request may still be in flight. Keep the receipt for a later sweep.
			if (!settled) throw new Error('Creation was not confirmed before cleanup.');
		}
		markResource(entry, 'closed');
	} catch {
		return kind + ' ' + basename(entry);
	}
}

function reapResource(entry: string, resource: ReturnType<typeof readResource>) {
	switch (resource.kind) {
		case 'tab':
		case 'window':
			return closeHygieneBrowser(resource.browser, entry, resource.target);
		case 'container':
			return closeHygieneContainer(entry, resource.host, resource.daemon);
		case 'simulator':
			return closeHygieneSimulator(entry, resource.udid);
		case 'process':
			return closeHygieneProcess(entry, resource.pid, resource.start);
	}
}

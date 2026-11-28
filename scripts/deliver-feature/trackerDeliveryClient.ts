// @harness-uid u_m5yc6knrj4
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TrackerItem } from '../../src/repositories/projects-sessions/TrackerItemReadRepository.types';
import type { TrackerArtifact } from '../../src/utils/projects-sessions/trackerPlanning.types';
import { deliveryProcess } from './deliveryProcess';
import { ExpectedCliError } from '../../src/core/errors';

export const trackerDeliveryClient = {
	async readItem(id: string): Promise<TrackerItem> {
		return JSON.parse(await tracker(['show', id, '--json']));
	},
	async attach(id: string, artifact: TrackerArtifact) {
		const directory = await mkdtemp(join(tmpdir(), 'tracker-feature-video-'));
		try {
			const filename = join(directory, 'artifact.json');
			await writeFile(filename, JSON.stringify(artifact), { mode: 0o600 });
			await tracker(['artifact', id, 'build', filename, '--merge-links']);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	},
	async record(id: string, note: string, complete: boolean) {
		await tracker(complete ? ['done', id, '--note', note] : ['note', id, note]);
	}
};

async function tracker(args: string[]) {
	const run = await deliveryProcess(['tracker', ...args]);
	if (run.code !== 0) throw new ExpectedCliError(`Tracker ${args[0]} failed`);
	return run.stdout;
}

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ReportRepository } from '../src/repositories/ReportRepository';
import { audioFixture } from './audioFixture';
export async function audioPairFixture(root: string) {
	const store = new ReportRepository(root);
	const run = await store.begin({
		project: '/tmp/audio-comparison',
		title: 'Audio comparison review',
		mode: 'feature',
		environment: 'Synthetic 220 Hz Before and 440 Hz After tones; website playback only'
	});
	for (const phase of ['before', 'after'] as const) {
		const path = join(store.directory(run.id), phase + '.wav');
		await writeFile(path, audioFixture(6, phase === 'before' ? 220 : 440));
		await store.record(run.id, {
			kind: 'evidence',
			data: {
				id: phase,
				title: 'Paired recording',
				category: 'Audio comparison',
				path,
				phase,
				comparison: 'voice',
				status: phase === 'before' ? 'failed' : 'passed',
				source: phase === 'before' ? 'Synthetic original microphone' : 'Synthetic later microphone',
				note: 'Transport demonstration only; not an Élan classifier result.',
				transcript: phase === 'before' ? 'Low synthetic tone' : 'High synthetic tone',
				capturedAt: phase === 'before' ? '2026-09-29T10:00:00Z' : '2026-09-30T10:00:00Z'
			}
		});
	}
	return { store, run };
}

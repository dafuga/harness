import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ReportRepository } from '../src/repositories/ReportRepository';
import { audioFixture } from './audioFixture';
export async function publicationFixture() {
	const root = await mkdtemp(join(tmpdir(), 'report-publication-'));
	const repository = new ReportRepository(root);
	const report = await repository.begin({
		project: '/tmp/speech',
		title: 'Failed speech test',
		mode: 'feature',
		environment: 'fixture',
		revision: 'a'.repeat(40)
	});
	const directory = repository.directory(report.id);
	const source = join(directory, 'original.wav');
	await writeFile(source, audioFixture());
	await repository.record(report.id, {
		kind: 'evidence',
		data: {
			id: 'clip',
			title: 'Rejected sound',
			category: 'Speech',
			status: 'failed',
			path: source
		}
	});
	await repository.seal(report.id);
	await mkdir(join(directory, 'exports'));
	for (const [file, bytes] of [
		['index.html', '<html><body>Failed speech test</body></html>'],
		['report.pdf', 'PDF fixture'],
		['report.zip', 'ZIP fixture']
	])
		await writeFile(join(directory, 'exports', file), bytes);
	await writeFile(join(directory, 'assets', 'unregistered.wav'), 'not authorized for publication');
	const run = await repository.finish(report.id, {
		html: 'index.html',
		pdf: 'report.pdf',
		zip: 'report.zip'
	});
	return { root, repository, run };
}

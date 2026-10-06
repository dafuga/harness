import { readFile, mkdir, writeFile, mkdtemp } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import type { ReportRepository } from '../repositories/ReportRepository';
import { registeredAsset } from './reportAssets';
import { mediaMime } from './evidenceMedia';
import { reportRetention } from './reportRetention';
export interface PublicationFile {
	path: string;
	bytes: Buffer;
	mime: string;
	sha256: string;
}
export interface PublicationBundle {
	id: string;
	directory: string;
	digest: string;
	revision?: string;
	files: PublicationFile[];
}
export async function reportPublication(repository: ReportRepository, id: string) {
	const report = await repository.get(id);
	if (reportRetention(report))
		throw new Error('Report expired after 30 days; publication is unavailable');
	if (report.state !== 'finalized' || !report.exports)
		throw new Error('Publish requires a finalized report with exports');
	if (report.evidence.some((item) => item.missing))
		throw new Error('Cannot publish missing evidence');
	const source = repository.directory(id);
	const files: PublicationFile[] = [];
	for (const [kind, name] of Object.entries(report.exports)) {
		const path = await registeredAsset(
			join(source, 'exports'),
			name,
			Object.values(report.exports)
		);
		const expected = { html: 'index.html', pdf: 'report.pdf', zip: 'report.zip' }[kind];
		if (name !== expected) throw new Error('Invalid publication export name');
		files.push(publicationFile(name, await readFile(path)));
	}
	for (const file of new Set(report.evidence.map((item) => item.file))) {
		const path = await registeredAsset(
			join(source, 'assets'),
			file,
			report.evidence.map((item) => item.file)
		);
		const asset = publicationFile(`assets/${file}`, await readFile(path));
		if (!file.startsWith(asset.sha256 + '.'))
			throw new Error('Evidence bytes do not match their content hash');
		files.push(asset);
	}
	return stagePublication(repository, { id, files, revision: report.revision });
}
function publicationFile(path: string, bytes: Buffer): PublicationFile {
	return {
		path,
		bytes,
		mime: mediaMime(path),
		sha256: createHash('sha256').update(bytes).digest('hex')
	};
}
async function stagePublication(
	repository: ReportRepository,
	input: Pick<PublicationBundle, 'id' | 'files' | 'revision'>
) {
	const base = join(repository.root, 'publication-staging');
	await mkdir(base, { recursive: true, mode: 0o700 });
	const directory = await mkdtemp(join(base, input.id + '-'));
	for (const file of input.files) {
		if (file.bytes.length > 25 * 1024 * 1024)
			throw new Error('A Pages publication asset exceeds 25 MiB');
		const path = join(directory, file.path);
		await mkdir(dirname(path), { recursive: true, mode: 0o700 });
		await writeFile(path, file.bytes, { mode: 0o600 });
	}
	const digest = createHash('sha256')
		.update(JSON.stringify(input.files.map(({ path, sha256 }) => ({ path, sha256 }))))
		.digest('hex');
	await writeFile(
		join(directory, '_headers'),
		'/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  X-Robots-Tag: noindex, nofollow\n' +
			input.files
				.map(
					(file) =>
						`/${file.path === 'index.html' ? '' : file.path}\n  Content-Type: ${file.mime}\n`
				)
				.join(''),
		{ mode: 0o600 }
	);
	return { ...input, directory, digest };
}

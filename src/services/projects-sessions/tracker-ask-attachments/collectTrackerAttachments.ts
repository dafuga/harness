import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { parseTrackerAttachmentWord } from '../../../utils/projects-sessions/parseTrackerAttachmentWord';
import type { TrackerAttachmentInput } from '../../../utils/projects-sessions/trackerAttachment.types';
import type { TrackerAttachmentWords } from './collectTrackerAttachments.types';
import { githubAttachmentReader } from './githubAttachmentReader';
import type { TrackerAttachmentReader } from './githubAttachmentReader.types';
import { snapshotRepositoryDocument } from './snapshotRepositoryDocument';

/** Turn `--spec`, `--doc` and `--design` words into the snapshots sent with a flag. */
export async function collectTrackerAttachments(
	words: TrackerAttachmentWords,
	reader: TrackerAttachmentReader = githubAttachmentReader
): Promise<TrackerAttachmentInput[]> {
	const specs = (words.spec ?? []).map((word) => repositoryAttachment('spec', word, reader));
	const documents = (words.doc ?? []).map((word) =>
		parseTrackerAttachmentWord(word)
			? repositoryAttachment('doc', word, reader)
			: localAttachment(word)
	);
	const designs = (words.design ?? []).map((url) =>
		Promise.resolve<TrackerAttachmentInput>({ kind: 'design', title: 'Design canvas', url })
	);
	return Promise.all([...specs, ...documents, ...designs]);
}

async function repositoryAttachment(
	kind: 'spec' | 'doc',
	word: string,
	reader: TrackerAttachmentReader
): Promise<TrackerAttachmentInput> {
	const source = parseTrackerAttachmentWord(word);
	if (!source) throw new TypeError(`--${kind} takes owner/repo#PR:path/to/file.md[@commit]`);
	try {
		const ref = source.ref ?? (await reader.head(source.repo, source.pr ?? 0));
		const document = await snapshotRepositoryDocument({ ...source, ref }, reader);
		return { kind, title: basename(source.path), ...source, ref, ...document };
	} catch (error) {
		const reason = error instanceof Error ? error.message.split('\n')[0] : 'unknown error';
		throw new TypeError(`could not read ${word} from GitHub (is gh signed in?): ${reason}`);
	}
}

async function localAttachment(path: string): Promise<TrackerAttachmentInput> {
	if (!/\.(?:md|markdown|txt)$/i.test(path))
		throw new TypeError('--doc takes a .md or .txt file, or owner/repo#PR:path');
	const markdown = await readFile(path, 'utf8').catch(() => {
		throw new TypeError(`could not read the document ${basename(path)}`);
	});
	return { kind: 'doc', title: basename(path), markdown };
}

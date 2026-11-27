import { expect, test } from 'vitest';
import { nativeTrackerArgs } from '../../../src/commands/projects-sessions/tracker-command/nativeTrackerRequest';
import { collectTrackerAttachments } from '../../../src/services/projects-sessions/tracker-ask-attachments/collectTrackerAttachments';
import { phoneAskAttachments } from '../../../src/services/projects-sessions/tracker-phone-replica-service/phoneAskAttachments';
import { parseTrackerAttachmentWord } from '../../../src/utils/projects-sessions/parseTrackerAttachmentWord';
import {
	readTrackerAttachment,
	storedTrackerAttachments
} from '../../../src/utils/projects-sessions/storedTrackerAttachments';
import {
	trackerMarkdownImages,
	trackerRepositoryImage
} from '../../../src/utils/projects-sessions/trackerMarkdownImages';

const spec = 'acme/widgets#7:specifications/service.md';
const flag = (question: string, ...extra: string[]) =>
	nativeTrackerArgs([
		'flag',
		'item1',
		question,
		'--option',
		'Approve=Build it',
		'--option',
		'Hold=Wait',
		'--recommend',
		'1',
		...extra
	]);

test('a spec review flag is refused until the spec is attached', () => {
	expect(() => flag('Approve the service spec?')).toThrow(/--spec/);
	expect(() => flag('The spec is ready for review.')).toThrow(/--spec/);
	for (const extra of [['--spec', spec], ['--doc', 'notes.md'], ['--not-spec-review']])
		expect(() => flag('Approve the service spec?', ...extra)).not.toThrow();
	expect(() => flag('Deploy the build now?')).not.toThrow();
});

test('a spec word names a repository file by pull request or commit', () => {
	expect(parseTrackerAttachmentWord(`${spec}@353b5a044adc`)).toEqual({
		repo: 'acme/widgets',
		pr: 7,
		path: 'specifications/service.md',
		ref: '353b5a044adc'
	});
	for (const bad of ['acme/widgets:file.md', 'file.md', 'acme/widgets#7:../x.md'])
		expect(parseTrackerAttachmentWord(bad)).toBeNull();
});

test('the snapshot pins the pull request head and inlines only repository images', async () => {
	const markdown =
		'# Service\n![flow](../docs/flow.png)\n![web](https://example.com/a.png)\n```\n![code](no.png)\n```\n';
	const read: string[] = [];
	const [attachment] = await collectTrackerAttachments(
		{ spec: [spec] },
		{
			head: async () => 'abcdef1234567890',
			file: async (_repo, path, ref) => {
				read.push(`${path}@${ref}`);
				return Buffer.from(path.endsWith('.md') ? markdown : 'png');
			}
		}
	);
	expect(read).toEqual([
		'specifications/service.md@abcdef1234567890',
		'docs/flow.png@abcdef1234567890'
	]);
	expect(attachment).toMatchObject({ kind: 'spec', pr: 7, ref: 'abcdef1234567890', markdown });
	expect(Object.keys(attachment.images ?? {})).toEqual(['../docs/flow.png']);
});

test('image names never leave the repository', () => {
	expect(trackerMarkdownImages('<img src="a.svg"> ![b](<b.png> "t")')).toEqual(['b.png', 'a.svg']);
	expect(trackerRepositoryImage('docs/a.md', '../../secret.png')).toBeNull();
	expect(trackerRepositoryImage('docs/a.md', 'file:///etc/a.png')).toBeNull();
	expect(trackerRepositoryImage('docs/a.md', 'notes.env')).toBeNull();
	expect(trackerRepositoryImage('docs/a.md', 'broken%zz.png')).toBeNull();
});

test('stored documents round trip, refuse oversize text and detect changes', () => {
	const stored = storedTrackerAttachments([
		{ kind: 'doc', title: 'plan.md', markdown: '# Plan' },
		{ kind: 'design', title: 'Canvas', url: 'https://example.com/canvas' }
	]);
	const listing = JSON.parse(stored.attachments ?? '[]');
	expect(listing.map((entry: { bytes: number }) => entry.bytes)).toEqual([6, 0]);
	expect(stored.attachments).not.toContain('# Plan');
	expect(readTrackerAttachment(stored, listing[0].id)?.markdown).toBe('# Plan');
	expect(readTrackerAttachment(stored, listing[1].id)).toBeNull();
	expect(() => storedTrackerAttachments([{ kind: 'spec', title: 'x.md' }])).toThrow(/text/);
	const huge = { kind: 'doc', title: 'x.md', markdown: 'a'.repeat(200_001) };
	expect(() => storedTrackerAttachments([huge])).toThrow(/markdown/);
});

test('the phone carries a document only while it fits one replica page', () => {
	const image = `data:image/png;base64,${'A'.repeat(70_000)}`;
	const fits = storedTrackerAttachments([
		{ kind: 'spec', title: 'a.md', markdown: '# A', images: { 'a.png': image } },
		{ kind: 'doc', title: 'b.md', markdown: 'b'.repeat(70_000) }
	]);
	const [first, second] = phoneAskAttachments(fits).attachments ?? [];
	expect(first.content).toEqual({ markdown: '# A' });
	expect(second.content).toBeUndefined();
	expect(second.title).toBe('b.md');
});

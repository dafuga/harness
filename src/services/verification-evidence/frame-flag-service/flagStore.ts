// @harness-uid u_zhz7hjx43x
import { defaultAttachedReader, inspectFrameClip } from './flagMedia';
import type { ResolutionClip, ResolutionReader } from './flagStore.types';
import { notesRef } from '../../../core/git-source-history/historyTypes';
import { LfsAdapter } from '../../../adapters/git-source-history/LfsAdapter';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { EvidenceBranchRepository } from '../../../repositories/verification-evidence/evidence-branch-repository/EvidenceBranchRepository';
import { lfsPointer, parseLfsPointer } from '../../../utils/verification-evidence/lfsPointer';
import {
	boundClip,
	frameHash,
	parseFlagJson,
	resolutionSchema,
	sameFrameSlot,
	storedFlagSchema
} from './flagSchema';
import type {
	FrameClip,
	FrameClipReader,
	FrameFlag,
	FrameResolution,
	StoredFrameFlag
} from '../FrameFlagService.types';

export async function storeFrameFlag(
	root: string,
	flag: StoredFrameFlag,
	png: Buffer
): Promise<FrameFlag> {
	const lfs = new LfsAdapter(root),
		object = await lfs.store(png);
	const retained = await lfs.read(object.sha256);
	if (!retained?.equals(png)) throw new ExpectedCliError('Retained frame LFS integrity failed.');
	const path = `video-feedback/${flag.clip.sha256}/${flag.id}`;
	const stored = await new EvidenceBranchRepository(root).add(
		path,
		[
			{ path: 'flag.json', content: { bytes: JSON.stringify(flag) + '\n' } },
			{ path: 'frame.png', content: { bytes: lfsPointer(object) } }
		],
		'feat: retain exact video frame feedback',
		'flag.json'
	);
	return { ...flag, evidence: { commit: stored.commit, path } };
}

/** Reconstruct flags and resolution standing solely from one immutable evidence snapshot. */
export async function readFrameFlags(
	root: string,
	reader?: FrameClipReader,
	unit?: string
): Promise<FrameFlag[]> {
	const repository = new EvidenceBranchRepository(root),
		tip = await repository.tip();
	if (!tip) return [];
	const paths = [...(await repository.tree.list(tip, ['video-feedback/'])).keys()].filter((path) =>
		path.startsWith('video-feedback/')
	);
	const pinned = { evidence: tip, notes: (await repository.tree.tip(notesRef)) ?? null };
	const clips = new Map<string, Promise<ResolutionClip>>();
	const load: ResolutionReader = (reference) => {
		const key = JSON.stringify(reference);
		let found = clips.get(key);
		if (!found) {
			found = (async () => {
				const clip = boundClip(
					reference,
					reader ? await reader(reference) : await defaultAttachedReader(reference, root, pinned)
				);
				inspectFrameClip(clip);
				return {
					sha256: clip.sha256,
					inputHash: clip.inputHash,
					capturedAt: clip.capturedAt,
					addressedFlags: clip.addressedFlags
				};
			})();
			if (clips.size >= 64) clips.delete(clips.keys().next().value!);
			clips.set(key, found);
		}
		return found;
	};
	const flags: FrameFlag[] = [];
	for (const path of paths.filter((path) => path.endsWith('/flag.json')))
		flags.push(await readFlag(repository, tip, path));
	if (new Set(flags.map((flag) => flag.id)).size !== flags.length)
		throw new ExpectedCliError('Duplicate frame flag identities in retained evidence.');
	for (const path of paths.filter((path) => path.endsWith('/resolution.json')))
		await applyResolution(repository, tip, path, { flags, load, unit });
	for (const path of paths) validateEvidencePath(path, flags);
	return flagsForOwner(flags, unit);
}

async function readFlag(
	repository: EvidenceBranchRepository,
	tip: string,
	path: string
): Promise<FrameFlag> {
	const metadata = parseFlagJson(storedFlagSchema, await repository.tree.read(tip, path));
	const directory = `video-feedback/${metadata.clip.sha256}/${metadata.id}`;
	if (path !== `${directory}/flag.json`)
		throw new ExpectedCliError('Corrupt frame flag path binding.');
	const pointer = await repository.tree.read(tip, `${directory}/frame.png`);
	const object = pointer && parseLfsPointer(pointer.toString('utf8'));
	if (object?.sha256 !== metadata.frame.sha256 || object.bytes !== metadata.frame.bytes)
		throw new ExpectedCliError('Retained frame LFS pointer/hash is corrupt.');
	const added = await repository.tree.git.run([
		'log',
		'--diff-filter=A',
		'--format=%H',
		tip,
		'--',
		path
	]);
	const commit = added.split('\n').filter(Boolean).at(-1);
	if (!commit) throw new ExpectedCliError('Missing immutable frame flag history.');
	return { ...metadata, evidence: { commit, path: directory } };
}

async function applyResolution(
	repository: EvidenceBranchRepository,
	tip: string,
	path: string,
	context: { flags: FrameFlag[]; load: ResolutionReader; unit?: string }
): Promise<void> {
	const { flags, load } = context;
	const event = parseFlagJson(resolutionSchema, await repository.tree.read(tip, path));
	const flag = flags.find((candidate) => candidate.id === event.flag);
	if (!flag || path !== resolutionPath(flag, event))
		throw new ExpectedCliError('Corrupt frame resolution identity or path.');
	if (
		!event.addressedFlags.includes(flag.id) ||
		!sameFrameSlot(flag.clip, event.replacement) ||
		flag.clip.record === event.replacement.record
	)
		throw new ExpectedCliError('Frame resolution does not explicitly address its owning flag.');
	for (const id of event.addressedFlags) addressedFlag(flags, id, event);
	if (context.unit && flag.clip.unit !== context.unit) return;
	const clip = await load(event.replacement);
	validateReplacement(clip, event, flags);
	flag.status = 'resolved';
}

function validateReplacement(
	clip: ResolutionClip,
	event: FrameResolution,
	flags: FrameFlag[]
): void {
	if (
		clip.sha256 !== event.replacement.sha256 ||
		clip.inputHash !== event.replacement.inputHash ||
		JSON.stringify([...clip.addressedFlags].sort()) !==
			JSON.stringify([...event.addressedFlags].sort())
	)
		throw new ExpectedCliError('Frame resolution differs from its verified attached replacement.');
	for (const id of event.addressedFlags) {
		const addressed = addressedFlag(flags, id, event);
		if (Date.parse(clip.capturedAt) <= Date.parse(addressed.createdAt))
			throw new ExpectedCliError('Frame resolution replacement must be newer than its flag.');
	}
}

function addressedFlag(flags: FrameFlag[], id: string, event: FrameResolution): FrameFlag {
	const flag = flags.find((candidate) => candidate.id === id);
	if (!flag || !sameFrameSlot(flag.clip, event.replacement))
		throw new ExpectedCliError('Frame resolution cites unknown or wrong-owner flags.');
	return flag;
}

function validateEvidencePath(path: string, flags: FrameFlag[]): void {
	const owner = flags.find((flag) => path.startsWith(`${flag.evidence.path}/`));
	if (!owner) throw new ExpectedCliError('Orphaned frame feedback evidence.');
	const tail = path.slice(owner.evidence.path.length + 1);
	if (
		tail !== 'flag.json' &&
		tail !== 'frame.png' &&
		!/^resolutions\/[a-f0-9]{64}\/resolution\.json$/.test(tail)
	)
		throw new ExpectedCliError('Unknown or malformed frame feedback evidence file.');
}

function resolutionPath(flag: FrameFlag, event: FrameResolution): string {
	return `${flag.evidence.path}/resolutions/${frameHash(JSON.stringify(event))}/resolution.json`;
}

export async function storeFrameResolution(
	root: string,
	flag: FrameFlag,
	clip: FrameClip
): Promise<void> {
	const event: FrameResolution = {
		schemaVersion: 1,
		flag: flag.id,
		replacement: {
			record: clip.record,
			revision: clip.revision,
			unit: clip.unit,
			clipId: clip.clipId,
			viewport: clip.viewport,
			sha256: clip.sha256,
			inputHash: clip.inputHash
		},
		addressedFlags: [...clip.addressedFlags].sort()
	};
	const path = resolutionPath(flag, event).replace(/\/resolution\.json$/, '');
	await new EvidenceBranchRepository(root).add(
		path,
		[{ path: 'resolution.json', content: { bytes: JSON.stringify(event) + '\n' } }],
		'fix: record addressed video frame feedback',
		'resolution.json'
	);
}

function flagsForOwner(flags: FrameFlag[], unit?: string): FrameFlag[] {
	return unit ? flags.filter((flag) => flag.clip.unit === unit) : flags;
}

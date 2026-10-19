import { planIdentity } from './planIdentity';
import { planImageCodec as decode } from './planImageCodec';
import { randomUUID } from 'node:crypto';
import type {
	AddDesignInput,
	ApproveDesignInput,
	DesignImageInput,
	ReadImageInput
} from '../models/PlanningBridge.types';
import type {
	DesignImage,
	DesignOption,
	DesignVersion,
	ApprovalRecord
} from '../models/Planning.types';
import { approvable, heldBy, planOptions } from './planOptions';
import type { Git } from './planGit';
import { imageBlob, revision } from './planGit';
import { planRead, approvalMatches } from './planRead';
import { clean, commitFiles, type Files } from './planWrite';
import { fail, hash, json, now, planData } from './planData';
import { contractHash, filename, region, slug, text, version } from './planValidate';
function imageFiles(
	images: DesignImageInput[],
	base: string,
	files: Files,
	prefix: string
): DesignImage[] {
	return images.map((image) => {
		slug(image.state);
		if (!['desktop', 'tablet', 'mobile', 'diagram'].includes(image.viewport))
			fail('invalid-input', 'Invalid viewport');
		const file = `${prefix}${image.state}-${image.viewport}.png`;
		if (files[`${base}/${file}`]) fail('invalid-input', 'Duplicate image');
		const size = decode(image.bytes);
		files[`${base}/${file}`] = image.bytes;
		return {
			file,
			sha256: hash(image.bytes),
			state: image.state,
			viewport: image.viewport,
			bytes: image.bytes.length,
			...size,
			mediaType: 'image/png',
			content: 'present'
		};
	});
}
export async function readImage(git: Git, input: ReadImageInput) {
	version(input.version);
	filename(input.file);
	const rev = await revision(git, input.revision);
	const plan = await planRead(git, rev, input.unitId);
	const design = plan.versions.find((v) => v.version === input.version);
	const image = design?.images.find((i) => i.file === input.file);
	if (!design || !image) fail('not-found', 'Image not found');
	const held = heldBy(design, image.file, input.option);
	if (input.sha256 && input.sha256 !== image.sha256)
		fail('artifact-tampered', 'Image hash mismatch');
	const bytes = await imageBlob(git, rev, `${plan.path}/designs/${input.version}/${input.file}`);
	if (hash(bytes) !== image.sha256) fail('artifact-tampered', 'Image hash mismatch');
	const dimensions = decode(bytes);
	if (
		dimensions.width !== image.width ||
		dimensions.height !== image.height ||
		bytes.length !== image.bytes
	)
		fail('artifact-tampered', 'Image dimensions mismatch');
	return {
		...image,
		unitId: input.unitId,
		version: input.version,
		bytes: new Uint8Array(bytes),
		commit: design.commit,
		...held
	};
}
function validateContent(
	input: AddDesignInput,
	category: string,
	images: DesignImage[],
	options?: DesignOption[]
): void {
	const visual = ['page', 'shell', 'component'].includes(category);
	if (options && !visual) fail('invalid-input', 'Only a visual plan has design options');
	// A function is planned in notes and cases. Earlier versions that hold an image are still read.
	if (category === 'function' && images.length)
		fail('invalid-image', 'A function plan holds notes, not images');
	if (!images.length && (!input.notes || visual))
		fail('invalid-image', 'A visual design needs images; headless designs need notes');
	if (input.notes !== undefined) text(input.notes);
}
export async function planDesign(git: Git, input: AddDesignInput) {
	const path = await planIdentity(git, await revision(git), input.unitId);
	await clean(git, path);
	const rev = await revision(git);
	const plan = await planRead(git, rev, input.unitId);
	if (input.expectedLatest !== undefined && input.expectedLatest !== plan.latestVersion)
		fail('stale-version', 'Latest version changed');
	text(input.prompt);
	text(input.generator?.provider);
	text(input.generator?.model);
	const contract = input.contract ?? plan.contract;
	const digest = contractHash(contract);
	const version = `v${String(plan.versions.length + 1).padStart(3, '0')}`;
	const base = `${path}/designs/${version}`;
	const files: Files = {};
	const write = (list: DesignImageInput[], prefix: string) => imageFiles(list, base, files, prefix);
	const { images, ...grouped } = planOptions(input, base, files, write);
	validateContent(input, plan.category, images, grouped.options);
	if (input.revises) await validateSource(git, input);
	const prompt = { file: 'prompt.md', sha256: hash(input.prompt) };
	files[`${base}/prompt.md`] = input.prompt;
	const notes = input.notes ? { file: 'notes.md', sha256: hash(input.notes) } : null;
	if (notes) files[`${base}/notes.md`] = input.notes!;
	const value = {
		unitId: input.unitId,
		version,
		createdAt: now(),
		generator: input.generator,
		prompt,
		notes,
		baseRevision: await revision(git, input.baseRevision),
		images,
		contract,
		contractHash: digest,
		revises: input.revises ?? null,
		...grouped
	};
	files[`${base}/design.json`] = json(value);
	files[`${path}/.gitattributes`] = 'designs/**/*.png filter=lfs diff=lfs merge=lfs -text\n';
	const committed = await commitFiles(git, files, `feat: add ${input.unitId} design ${version}`);
	return { ...committed, value: { ...value, commit: committed.commit } as DesignVersion };
}
async function validateSource(git: Git, input: AddDesignInput): Promise<void> {
	const source = input.revises!;
	region(source.region);
	await readImage(git, {
		unitId: input.unitId,
		version: source.version,
		file: source.file,
		sha256: source.imageSha256,
		option: source.option,
		revision: input.baseRevision
	});
	if (source.threadId) {
		const plan = await planRead(git, await revision(git, input.baseRevision), input.unitId);
		const thread = plan.threads.find((t) => t.id === source.threadId);
		if (
			!thread?.anchor ||
			planData({ ...thread.anchor, state: undefined, viewport: undefined }) !==
				planData({
					version: source.version,
					file: source.file,
					imageSha256: source.imageSha256,
					region: region(source.region),
					option: source.option,
					state: undefined,
					viewport: undefined
				})
		)
			fail('invalid-input', 'Source thread does not bind image');
	}
}
export async function approve(git: Git, input: ApproveDesignInput) {
	const path = await planIdentity(git, await revision(git), input.unitId);
	await clean(git, path);
	const plan = await planRead(git, await revision(git), input.unitId);
	text(input.reviewer);
	const latest = plan.versions.at(-1);
	if (!latest || latest.version !== input.version)
		fail('stale-version', 'Only latest design can be approved');
	const bound = approvable(latest, input.option);
	if (!bound) fail('approval-mismatch', 'Approval does not name an option of the current design');
	const value = {
		id: randomUUID(),
		unitId: input.unitId,
		version: input.version,
		...(input.option !== undefined ? { option: input.option } : {}),
		images: input.images,
		notesSha256: input.notesSha256 ?? null,
		contractHash: input.contractHash,
		reviewer: input.reviewer,
		approvedAt: now()
	};
	if (!Array.isArray(input.images) || !approvalMatches(value as ApprovalRecord, latest))
		fail('approval-mismatch', 'Approval does not bind exact current design');
	for (const image of bound)
		await readImage(git, { unitId: input.unitId, version: latest.version, file: image.file });
	const committed = await commitFiles(
		git,
		{ [`${path}/designs/approvals/${value.id}.json`]: json(value) },
		`feat: approve ${input.unitId} ${input.version}`
	);
	return { ...committed, value: { ...value, commit: committed.commit, current: true } };
}

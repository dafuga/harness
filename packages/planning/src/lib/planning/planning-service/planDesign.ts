import { readImage } from '../../../utils/plan-design/readImage';
import { planIdentity } from '../../../utils/planIdentity';
import { planImageCodec as decode } from '../../../utils/planImageCodec';
import { randomUUID } from 'node:crypto';
import type {
	AddDesignInput,
	ApproveDesignInput,
	DesignImageInput
} from '../../../models/PlanningBridge.types';
import type {
	DesignImage,
	DesignOption,
	DesignVersion,
	ApprovalRecord
} from '../../../models/Planning.types';
import { approvable } from '../../../utils/planOptions';
import { planOptions } from './planOptions';
import type { Git } from '../../../utils/planGit';
import { revision } from '../../../utils/planGit';
import { planRead, approvalMatches } from '../../../utils/plan-read/planRead';
import { clean, commitFiles, type Files } from '../../../utils/plan-write/clean';
import { fail, hash, json, now, planData } from '../../../utils/planData';
import { contractHash, region, slug, text } from '../../../utils/planValidate';

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

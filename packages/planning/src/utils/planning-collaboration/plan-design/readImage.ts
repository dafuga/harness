// @harness-uid u_ylixwcfuzh
import { planImageCodec as decode } from '../planImageCodec';
import type {
	ReadImageInput,
	ReadImagesInput
} from '../../../models/planning-collaboration/PlanningBridge.types';
import type { DesignVersion } from '../../../models/planning-collaboration/Planning.types';
import { heldBy } from './heldBy';
import type { Git } from '../planGit';
import { imageBlob, revision } from '../planGit';
import { planRead } from '../plan-read/planRead';
import { fail, hash } from '../planData';
import { filename } from '../planValidate';
import { version } from './version';
import type { ImageContent } from '../../../models/planning-collaboration/PlanningView.types';
import type { DesignImage } from '../../../models/planning-collaboration/Planning.types';

async function imageVersion(git: Git, input: Omit<ReadImageInput, 'file'>) {
	version(input.version);
	const rev = await revision(git, input.revision);
	const plan = await planRead(git, rev, input.unitId);
	const design = plan.versions.find((v) => v.version === input.version);
	if (!design) fail('not-found', 'Image not found');
	return { design, rev, path: plan.path };
}

async function fromVersion(
	git: Git,
	{ design, rev, path }: { design: DesignVersion; rev: string; path: string },
	input: ReadImageInput
) {
	filename(input.file);
	const image = design.images.find((i) => i.file === input.file);
	if (!image) fail('not-found', 'Image not found');
	const held = heldBy(design, image.file, input.option);
	if (input.sha256 && input.sha256 !== image.sha256)
		fail('artifact-tampered', 'Image hash mismatch');
	const bytes = await imageBlob(git, rev, `${path}/designs/${input.version}/${input.file}`);
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

export async function readImage(
	git: Git,
	input: ReadImageInput
): Promise<ImageContent & Pick<DesignImage, 'content'>> {
	version(input.version);
	filename(input.file);
	return fromVersion(git, await imageVersion(git, input), input);
}

export async function readImages(git: Git, input: ReadImagesInput) {
	if (!Array.isArray(input.hashes)) fail('invalid-input', 'Image hashes must be an array');
	const stored = await imageVersion(git, input);
	const images = [];
	for (const sha256 of input.hashes) {
		const image = stored.design.images.find((item) => item.sha256 === sha256);
		if (!image) fail('not-found', 'Image not found');
		images.push(await fromVersion(git, stored, { ...input, file: image.file, sha256 }));
	}
	return images;
}

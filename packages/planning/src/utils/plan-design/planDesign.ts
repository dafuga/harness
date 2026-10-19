import { planImageCodec as decode } from '../planImageCodec';
import type { ReadImageInput } from '../../models/PlanningBridge.types.ts';
import { heldBy } from './planOptions';
import type { Git } from '../planGit';
import { imageBlob, revision } from '../planGit';
import { planRead } from '../plan-read/planRead';
import { fail, hash } from '../planData';
import { filename } from '../planValidate';
import { version } from './planValidate';

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

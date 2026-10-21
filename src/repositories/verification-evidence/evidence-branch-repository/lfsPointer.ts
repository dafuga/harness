import { mediaExtensions } from '../../../utils/verification-evidence/lfsPointer';

/** The `.gitattributes` of the evidence branch, so ordinary LFS clients see the same files. */
export function lfsAttributes(): string {
	const rules = mediaExtensions.flatMap((extension) => [extension, extension.toUpperCase()]);
	return rules.map((extension) => `*.${extension} filter=lfs diff=lfs merge=lfs -text\n`).join('');
}

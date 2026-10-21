import type { ThreadTarget } from '../../../utils/explorer-ui/threadAnchor';

export function sameImage(left: ThreadTarget | null, right: ThreadTarget): boolean {
	return Boolean(
		left?.imageSha256 && left.imageSha256 === right.imageSha256 && left.version === right.version
	);
}

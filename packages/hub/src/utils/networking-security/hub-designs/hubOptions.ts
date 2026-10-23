import type { Options } from './hubOptions.types';
import { hubFail } from '../../development-tooling/hubJson';
import type { HubDesign } from '../../development-tooling/hubSchemas';

/**
 * Whether the options keep what planning enforces when it writes them: directions that differ
 * once trimmed and case-folded, and no picture, by its hash, held by two different options.
 */
function distinct(options: Options): boolean {
	const directions = new Set(options.map((option) => option.direction.trim().toLowerCase()));
	const holder = new Map<string, string>();
	const shared = options.some((option) =>
		option.images.some((image) => {
			const held = holder.get(image.sha256) ?? option.id;
			holder.set(image.sha256, option.id);
			return held !== option.id;
		})
	);
	return directions.size === options.length && !shared;
}

/**
 * Refuses stored design options that do not divide the images of their version exactly, as
 * planning does: ids o1 to oN in order, and every image claimed once, by one option, with its
 * exact hash. Hosted records are untrusted, so the writer's rules are checked too. A version
 * without options is a single design and passes as it always did.
 */
export function hubOptions(value: HubDesign): HubDesign {
	if (!value.options) return value;
	const held = new Map(value.images.map((image) => [image.file, image.sha256]));
	// A file listed twice collapses in the map; planning never writes one file twice.
	if (held.size !== value.images.length) hubFail();
	const seen = new Set<string>();
	const claim = (image: { file: string; sha256: string }) => {
		const fresh = held.get(image.file) === image.sha256 && !seen.has(image.file);
		seen.add(image.file);
		return fresh;
	};
	const exact = value.options.every(
		(option, at) => option.id === `o${at + 1}` && option.images.every(claim)
	);
	if (!exact || seen.size !== held.size || !distinct(value.options)) hubFail();
	return value;
}

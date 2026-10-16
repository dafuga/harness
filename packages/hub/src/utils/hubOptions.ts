import { hubFail } from './hubJson';
import { hubRead } from './hubSource';
import type { HubSourceContext } from './hubSource';
import type { HubDesign } from './hubSchemas';
import type { DesignOptionInfo, DesignRevision } from '../../../desktop/src/models/Desktop.types';

type Options = NonNullable<HubDesign['options']>;

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

/** The option holding a file, as a field of its image; nothing in a single design. */
export function hubImageOption(value: HubDesign, file: string): { option?: string } {
	const option = value.options?.find((item) => item.images.some((image) => image.file === file));
	return option ? { option: option.id } : {};
}

/** The options of a version as the desktop reads them, each prompt read by its exact hash. */
export async function hubOptionInfos(
	context: HubSourceContext,
	base: string,
	value: HubDesign
): Promise<{ options?: DesignOptionInfo[] }> {
	if (!value.options) return {};
	const text = async (file: { file: string; sha256: string } | null) =>
		file ? new TextDecoder().decode(await hubRead(context, base + file.file, file.sha256)) : null;
	const options = await Promise.all(
		value.options.map(async (option) => ({
			id: option.id,
			direction: option.direction,
			prompt: await text(option.prompt),
			revisedPrompt: option.revisedPrompt,
			generator: `${option.generator.provider} · ${option.generator.model}`,
			imageHashes: option.images.map((image) => image.sha256)
		}))
	);
	return { options };
}

/** The exact earlier image a version revises, as the desktop names it; nothing when none. */
export function hubRevision(value: HubDesign): { revises?: DesignRevision } {
	const source = value.revises;
	if (!source) return {};
	const { version, imageSha256, region, threadId } = source;
	const option = source.option ? { option: source.option } : {};
	return { revises: { version, imageSha256, region, threadId, ...option } };
}

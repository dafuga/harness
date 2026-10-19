import { hubRead } from "../hubSource";
import type { HubSourceContext } from "../hubSource";
import type { HubDesign } from "../hubSchemas";
import type { DesignOptionInfo, DesignRevision } from "../../../../desktop/src/models/Desktop.types.ts";

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

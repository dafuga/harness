import type { AddDesignInput, DesignImageInput } from '../models/PlanningBridge.types';
import type {
	AgentRef,
	DesignImage,
	DesignOption,
	DesignVersion,
	ImageBinding,
	StoredFile
} from '../models/Planning.types';
import { fail, hash } from './planData';
import { filename, text } from './planValidate';
import type { Files } from './planWrite';

/** Writes the images of a design with each file name under `prefix`, answering what it wrote. */
export type WriteImages = (images: DesignImageInput[], prefix: string) => DesignImage[];
const most = 10;
const id = (at: number) => `o${at + 1}`;
const binding = ({ file, sha256 }: ImageBinding): ImageBinding => ({ file, sha256 });

/**
 * The images and options of a design input. A single design is written as it always was. Options
 * are written apart under their own file prefix, must differ in direction and share no image, and
 * flat images given beside them must be exactly the union of theirs.
 */
export function planOptions(input: AddDesignInput, base: string, files: Files, write: WriteImages) {
	if (input.options === undefined) {
		if (!Array.isArray(input.images)) fail('invalid-input', 'Images must be an array');
		return { images: write(input.images, '') };
	}
	const given = input.options;
	if (!Array.isArray(given) || given.length < 1 || given.length > most)
		fail('invalid-input', `Design options must number 1 to ${most}`);
	const images: DesignImage[] = [];
	const options = given.map((option, at): DesignOption => {
		text(option?.direction);
		if (option.direction.length > 2000) fail('invalid-input', 'A design option direction is long');
		if (!Array.isArray(option.images) || !option.images.length)
			fail('invalid-input', 'Each design option needs images');
		const own = write(option.images, `${id(at)}-`);
		images.push(...own);
		return {
			id: id(at),
			direction: option.direction,
			prompt: promptFile(option.prompt, `${id(at)}-prompt.md`, base, files),
			revisedPrompt: option.revisedPrompt ?? null,
			generator: provenance(option.generator ?? input.generator),
			images: own.map(binding)
		};
	});
	distinct(options);
	if (input.images !== undefined) union(input.images, images);
	return { images, options };
}
function promptFile(prompt: unknown, file: string, base: string, files: Files): StoredFile | null {
	if (prompt === undefined) return null;
	text(prompt);
	files[`${base}/${file}`] = prompt;
	return { file, sha256: hash(prompt) };
}
function provenance(generator: AgentRef): AgentRef {
	text(generator?.provider);
	text(generator.model);
	return { provider: generator.provider, model: generator.model };
}
function distinct(options: DesignOption[]): void {
	const directions = new Set(options.map((option) => option.direction.trim().toLowerCase()));
	if (directions.size !== options.length)
		fail('invalid-input', 'Design options need distinct directions');
	for (const option of options) {
		if (option.revisedPrompt !== null) text(option.revisedPrompt);
		const own = new Set(option.images.map((image) => image.sha256));
		const others = options.filter((other) => other !== option).flatMap((other) => other.images);
		if (others.some((image) => own.has(image.sha256)))
			fail('invalid-input', 'Design options repeat an image');
	}
}
function union(flat: DesignImageInput[], images: DesignImage[]): void {
	if (!Array.isArray(flat)) fail('invalid-input', 'Images must be an array');
	const key = (state: string, viewport: string, sha256: string) => `${state} ${viewport} ${sha256}`;
	const given = flat.map((image) => key(image.state, image.viewport, hash(image.bytes))).sort();
	const held = images.map((image) => key(image.state, image.viewport, image.sha256)).sort();
	if (given.join('\n') !== held.join('\n'))
		fail('invalid-input', 'Images must be the union of the design options');
}

/** Refuses stored options that do not divide the images of their version exactly among them. */
export function checkOptions(version: DesignVersion): void {
	if (version.options === undefined) return;
	const held = new Map(version.images.map((image) => [image.file, image.sha256]));
	const seen = new Set<string>();
	// Each file of the version is claimed once, by one binding with its exact hash.
	const claim = (image: ImageBinding) => {
		const fresh = held.get(image.file) === image.sha256 && !seen.has(image.file);
		seen.add(image.file);
		return fresh;
	};
	const options = Array.isArray(version.options) ? version.options : [];
	const exact = options.every(
		(option, at) => option.id === id(at) && option.images.length > 0 && option.images.every(claim)
	);
	if (!exact || !options.length || options.length > most || seen.size !== held.size)
		fail('artifact-tampered', 'Design options do not match the images');
	for (const option of options) {
		text(option.direction);
		provenance(option.generator);
		if (option.revisedPrompt !== null) text(option.revisedPrompt);
		if (option.prompt) filename(option.prompt.file);
	}
}
/** The option of a version that holds this file; undefined in a single design. */
export function optionOf(version: DesignVersion, file: string): string | undefined {
	return version.options?.find((option) => option.images.some((image) => image.file === file))?.id;
}
/** The option holding `file`, as a field of the image; refused when the caller named another. */
export function heldBy(version: DesignVersion, file: string, wanted?: string): { option?: string } {
	const option = optionOf(version, file);
	if (wanted !== undefined && wanted !== option) fail('not-found', 'Image not found');
	return option ? { option } : {};
}
/** What approving `option` binds: that option's images, or every image of a single design. */
export function approvable(version: DesignVersion, option?: string): ImageBinding[] | null {
	if (!version.options) return option === undefined ? version.images.map(binding) : null;
	return version.options.find((item) => item.id === option)?.images ?? null;
}

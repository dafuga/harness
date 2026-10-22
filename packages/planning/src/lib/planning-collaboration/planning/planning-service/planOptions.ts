import type { WriteImages } from '../../../../utils/planning-collaboration/planOptions';
import {
	most,
	id,
	provenance,
	binding
} from '../../../../utils/planning-collaboration/planOptions';
import type {
	AddDesignInput,
	DesignImageInput
} from '../../../../models/planning-collaboration/PlanningBridge.types';
import type {
	DesignImage,
	DesignOption,
	StoredFile
} from '../../../../models/planning-collaboration/Planning.types';
import { fail, hash } from '../../../../utils/planning-collaboration/planData';
import { text } from '../../../../utils/planning-collaboration/planValidate';
import type { Files } from '../../../../utils/planning-collaboration/plan-write/clean';

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

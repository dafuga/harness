import { id, most, provenance } from '../planOptions';
import type {
	DesignVersion,
	ImageBinding
} from '../../../models/planning-collaboration/Planning.types';
import { fail } from '../planData';
import { filename, text } from '../planValidate';

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

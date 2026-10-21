import { optionOf } from '../planOptions';
import type { DesignVersion } from '../../../models/planning-collaboration/Planning.types';
import { fail } from '../planData';

/** The option holding `file`, as a field of the image; refused when the caller named another. */
export function heldBy(version: DesignVersion, file: string, wanted?: string): { option?: string } {
	const option = optionOf(version, file);
	if (wanted !== undefined && wanted !== option) fail('not-found', 'Image not found');
	return option ? { option } : {};
}

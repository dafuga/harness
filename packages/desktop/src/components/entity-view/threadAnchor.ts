import { designOption } from '../../utils/threadAnchor';
import type { DesignVersion } from '../../models/Desktop.types.ts';

/** The option to show of the version named among an entity's versions. */
export function versionOption(versions: DesignVersion[], version: string, wanted = ''): string {
	return designOption(
		versions.find((item) => item.version === version),
		wanted
	);
}

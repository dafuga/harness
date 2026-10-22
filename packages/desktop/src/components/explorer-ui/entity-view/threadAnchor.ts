import { designOption } from '../../../utils/explorer-ui/threadAnchor';
import type { DesignVersion } from '../../../models/development-tooling/Desktop.types';

/** The option to show of the version named among an entity's versions. */
export function versionOption(versions: DesignVersion[], version: string, wanted = ''): string {
	return designOption(
		versions.find((item) => item.version === version),
		wanted
	);
}

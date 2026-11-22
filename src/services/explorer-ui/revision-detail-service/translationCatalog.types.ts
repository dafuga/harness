// @harness-uid u_gndb6l2t6f
import type { TranslationRow } from '../../../core/explorer-ui/Translation.types';

export interface TranslationScan {
	rows: Map<string, TranslationRow>;
	locales: Set<string>;
	gaps: string[];
	consumers: Map<string, Set<string>>;
}

/** A JSON resource path that is not repository-relative or that would leave the repository. */
export class ResourcePathError extends Error {
	override name = 'ResourcePathError';
}

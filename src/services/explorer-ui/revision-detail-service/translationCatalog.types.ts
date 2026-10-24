import type { TranslationRow } from '../../../core/explorer-ui/Translation.types';

export interface TranslationScan {
	rows: Map<string, TranslationRow>;
	locales: Set<string>;
	gaps: string[];
	consumers: Map<string, Set<string>>;
}

import english from '../../../../src/utils/reports-media/report-locale/en.json' with { type: 'json' };
import french from '../../../../src/utils/reports-media/report-locale/fr.json' with { type: 'json' };
import type { ExplorerScreenProps } from '../../../../src/models/explorer-ui/ExplorerScreen.types';
import type { TranslationCatalog } from '../../../../../../src/core/explorer-ui/Translation.types';
export const translationData: TranslationCatalog = {
	locales: ['en', 'fr', 'de'],
	gaps: [],
	rows: Object.entries(english)
		.map(([key, en]) => ({
			scope: 'packages/reports',
			key,
			values: {
				en,
				fr: french[key as keyof typeof french],
				...(key === 'listenAndCompare' ? { de: 'Anhören und vergleichen' } : {})
			},
			sources: ['packages/reports/src/utils/reports-media/report-locale/en.json'],
			usedBy: []
		}))
		.sort((a, b) => a.key.localeCompare(b.key))
};
export function translationPreview(host: ExplorerScreenProps): ExplorerScreenProps {
	return {
		...host,
		head: { ...host.head, translations: translationData },
		route: { ...host.route, screen: 'translations', entity: undefined }
	};
}

import type { PreviewCases, PreviewProps } from './shared';
import { functionCardVariant } from './reportFunctionCardVariants';
import { explorerUsageVariant } from './reportExplorerUsageVariants';
import { usageLinkVariant } from './reportUsageLinkVariants';
import { entityStatesVariant } from './reportEntityStatesVariants';
import { configValueVariant } from './configValueTreeVariants';
import { catalogItemsVariant } from './catalogItemsVariants';
import { dependenciesVariant } from './reportDependenciesVariants';
import { platformDetailsVariant } from './reportPlatformDetailsVariants';
import { platformsVariant } from './reportPlatformsVariants';
import { translationsVariant } from './reportTranslationsVariants';
import { moduleVariant } from './reportModuleVariants';
import { permissionsVariant } from './reportPermissionsVariants';

const explorerVariants = new Map<
	string,
	(props: PreviewProps, variant: string) => PreviewProps | null
>([
	['reports.component.explorer-function-card', functionCardVariant],
	['reports.component.explorer-usage', explorerUsageVariant],
	['reports.component.explorer-usage-link', usageLinkVariant],
	['reports.component.entity-states', entityStatesVariant],
	['reports.component.explorer-ui-config-value-tree', configValueVariant],
	['reports.component.explorer-catalog-items', catalogItemsVariant],
	['reports.component.explorer-dependencies-screen', dependenciesVariant],
	['reports.component.explorer-ui-explorer-platform-details', platformDetailsVariant],
	['reports.component.explorer-ui-explorer-platforms', platformsVariant],
	['reports.component.explorer-ui-explorer-translations-screen', translationsVariant],
	['reports.component.networking-security-explorer-permissions-screen', permissionsVariant]
]);

/** Explorer fixtures keep each screen, card and relationship presentation separate. */
export function explorerVariantProps(id: string, props: PreviewCases[string], variant: string) {
	const configured = explorerVariants.get(id);
	if (configured) return configured(props, variant);
	return id.startsWith('reports.component.module-system-explorer-module')
		? moduleVariant(id, props, variant)
		: null;
}

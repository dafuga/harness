import type { PreviewCases } from './shared';
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

/** Explorer fixtures keep each screen, card and relationship presentation separate. */
export function explorerVariantProps(id: string, props: PreviewCases[string], variant: string) {
	if (id === 'reports.component.explorer-function-card') return functionCardVariant(props, variant);
	if (id === 'reports.component.explorer-usage') return explorerUsageVariant(props, variant);
	if (id === 'reports.component.explorer-usage-link') return usageLinkVariant(props, variant);
	if (id === 'reports.component.entity-states') return entityStatesVariant(props, variant);
	if (id === 'reports.component.explorer-ui-config-value-tree')
		return configValueVariant(props, variant);
	if (id === 'reports.component.explorer-catalog-items') return catalogItemsVariant(props, variant);
	if (id === 'reports.component.explorer-dependencies-screen')
		return dependenciesVariant(props, variant);
	if (id === 'reports.component.explorer-ui-explorer-platform-details')
		return platformDetailsVariant(props, variant);
	if (id === 'reports.component.explorer-ui-explorer-platforms')
		return platformsVariant(props, variant);
	if (id === 'reports.component.explorer-ui-explorer-translations-screen')
		return translationsVariant(props, variant);
	if (id.startsWith('reports.component.module-system-explorer-module'))
		return moduleVariant(id, props, variant);
	if (id === 'reports.component.networking-security-explorer-permissions-screen')
		return permissionsVariant(props, variant);
	return null;
}

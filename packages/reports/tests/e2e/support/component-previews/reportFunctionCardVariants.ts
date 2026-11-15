import { consumerModels } from '../../../../test/entityClassFixtures';
import { explorerEntities } from '../../../../src/utils/explorer-ui/explorerEntities';
import { entityCatalog, type CatalogRow } from '../../../../src/utils/entityCatalog';
import { entities, entity, reading, shown } from './explorerData';
import type { PreviewCases } from './shared';
import { usageLinkVariant } from './reportUsageLinkVariants';

/** The legacy card delegates real nonvisual entity rows to the shared module card. */
export function functionCardVariant(props: PreviewCases[string], variant: string) {
	const row = props.row as CatalogRow;
	if (variant === 'usage-open') return usageLinkVariant(props, 'visual-open');
	if (variant === 'no-usage') return { ...props, row: { ...row, usedIn: [] } };
	if (variant === 'many-usage') return { ...props, row: { ...row, usedIn: entities.slice(0, 4) } };
	if (variant === 'service')
		return { ...props, row: entityCatalog(entities, 'services', reading.relations)[0] };
	if (variant === 'model') {
		const model = consumerModels(entity.unit)[0];
		const head = {
			...shown.head,
			registry: { ...shown.head.registry, units: [...shown.head.registry.units, model] }
		};
		const rows = entityCatalog(explorerEntities(head), 'models', reading.relations);
		return { ...props, row: rows[0] };
	}
	return null;
}

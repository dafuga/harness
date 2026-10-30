import type { PreviewCases } from './shared';
import type { CatalogRow } from '../../../../src/utils/explorer-ui/entityCatalog.types';
import { picture } from './reportData';
import { commits, entities, entity, helperRows, reading, shown } from './explorerData';
import { entityCatalog } from '../../../../src/utils/entityCatalog';
import { explorerEntities } from '../../../../src/utils/explorerEntities';
import { explorerRelations } from '../../../../src/utils/explorerRelations';
import { withApis } from '../../../../test/entityApiFixtures';
import { routeIds, routeUnits } from './routeUnits';
import { usageLinkVariant } from './reportUsageLinkVariants';

/** Distinct visual, page and nonvisual rows of the shared module card. */
export function moduleCardVariant(props: PreviewCases[string], variant: string) {
	if (variant === 'missing') return { ...props, shot: null };
	if (variant === 'image-error')
		return { ...props, shot: { ...picture, file: 'preview-invalid-image.svg' } };
	if (variant === 'function') return { ...props, row: helperRows[0] };
	if (variant === 'usage-open') {
		const usage = usageLinkVariant(props, 'visual-open');
		return { ...usage, shot: { ...picture, file: `/media/${picture.file}` } };
	}
	if (['api', 'api-no-methods'].includes(variant)) return apiCard(props, variant);
	if (['no-usage', 'many-usage'].includes(variant)) {
		const row = props.row as CatalogRow;
		const usedIn =
			variant === 'no-usage'
				? []
				: entities.filter((item) => item.id !== row.entity.id).slice(0, 4);
		return { ...props, row: { ...row, usedIn } };
	}
	if (['page', 'page-missing', 'layout', 'layout-missing'].includes(variant))
		return visualCard(props, variant);
	if (variant === 'unlinked') {
		const unit = { ...entity.unit, id: 'app.style.orders', kind: 'style', title: 'Orders styles' };
		const support = { id: unit.id, role: 'Style sheet', name: unit.title, unit };
		return {
			...props,
			row: { support, id: unit.id, name: unit.title, usedIn: [entity], opens: null }
		};
	}
	return null;
}

function visualCard(props: PreviewCases[string], variant: string) {
	if (variant.startsWith('page')) {
		const row = entityCatalog(entities, 'pages', reading.relations)[0];
		const shot =
			variant === 'page' ? { ...picture, file: 'synthetic-orders-page-input.svg' } : null;
		return { ...props, row, category: 'pages', shot };
	}
	const layout = routeUnits.find((unit) => unit.id === routeIds.shell)!;
	const head = {
		...shown.head,
		registry: { ...shown.head.registry, units: [...shown.head.registry.units, layout] }
	};
	const row = entityCatalog(explorerEntities(head), 'layouts', (id) =>
		explorerRelations(head, id)
	)[0];
	const shot = variant === 'layout' ? { ...picture, file: 'synthetic-layout-input.svg' } : null;
	return { ...props, row, category: 'layouts', shot };
}

function apiCard(props: PreviewCases[string], variant: string) {
	const head = withApis({ ...shown.head, commit: commits.tip });
	const row = entityCatalog(explorerEntities(head), 'apis', (id) =>
		explorerRelations(head, id)
	).find((item) => item.name === '/api/orders')!;
	if (variant === 'api') return { ...props, row, category: 'apis' };
	const unit = { ...row.entity.unit, owns: { ...row.entity.unit.owns, symbols: [] } };
	return { ...props, row: { ...row, entity: { ...row.entity, unit } }, category: 'apis' };
}

import type { ExplorerScreenProps } from '../../../../src/models/explorer-ui/ExplorerScreen.types';
import type { TranslationCatalog } from '../../../../../../src/core/explorer-ui/Translation.types';
import { permissionProfiles } from '../../../../../../test/support/permissionProfiles';
import { platformFixture } from '../../../../test/platformFixture';
import { ids } from '../../../../test/entityUnits';
import { dependencyPreview } from './dependencies';
import { moduleData, modulePreview } from './modules';

const translations: TranslationCatalog = {
	locales: ['en', 'fr'],
	gaps: [],
	rows: [
		['title', 'Orders', 'Commandes'],
		['ready', 'Ready to ship', 'Prête à expédier'],
		['total', 'Order total', 'Total de la commande']
	].map(([key, en, fr]) => ({
		scope: 'orders',
		key,
		values: { en, fr },
		sources: ['src/locales/orders.en.json', 'src/locales/orders.fr.json'],
		usedBy: [ids.list]
	}))
};

/** Named sections receive the same populated declarations their dedicated previews use. */
export function populatedExplorerContent(host: ExplorerScreenProps, variant: string) {
	if (variant === 'dependencies') return dependencyPreview(host);
	if (variant === 'modules') {
		const library = modulePreview(host);
		return { ...library, head: { ...library.head, modules: moduleData } };
	}
	if (variant === 'permissions')
		return catalogHost(
			host,
			{ ...host.route, screen: 'permissions', entity: undefined },
			{ permissions: permissionProfiles }
		);
	if (variant === 'translations')
		return catalogHost(
			host,
			{ ...host.route, screen: 'translations', entity: undefined },
			{ translations }
		);
	if (variant === 'platforms')
		return catalogHost(
			host,
			{ ...host.route, category: 'platforms', entity: undefined },
			{ platforms: platformFixture }
		);
	return null;
}

function catalogHost(
	host: ExplorerScreenProps,
	route: ExplorerScreenProps['route'],
	catalog: Partial<ExplorerScreenProps['head']>
): ExplorerScreenProps {
	return {
		...host,
		route,
		head: { ...host.head, ...catalog },
		scope: { ...host.scope, location: route }
	};
}

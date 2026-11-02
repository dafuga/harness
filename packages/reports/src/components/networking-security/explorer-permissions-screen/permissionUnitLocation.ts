// @harness-uid u_asbsxwjzma
import type { ExplorerLocation } from '../../../models/explorer-ui/Explorer.types';
import type { ExplorerPermissionsScreenProps } from '../ExplorerPermissionsScreen.types';

export function permissionUnitLocation(
	host: Pick<ExplorerPermissionsScreenProps, 'entities' | 'route'>,
	id: string
): ExplorerLocation | null {
	const entity = host.entities.find((item) => item.id === id);
	const { branch, commit } = host.route;
	return entity ? { branch, commit, category: entity.category, entity: id } : null;
}

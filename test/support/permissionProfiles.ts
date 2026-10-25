import type { PermissionCatalog } from '../../src/services/networking-security/PermissionCatalogService.types';
/** Invented application profiles; no production identity or authorization is represented. */
export const permissionProfiles: PermissionCatalog = {
	gaps: [],
	profiles: [
		{
			schemaVersion: 1,
			id: 'guest',
			title: 'Guest',
			description: 'Public visitor.',
			source: 'specification/permissions/guest.json',
			grants: []
		},
		{
			schemaVersion: 1,
			id: 'member',
			title: 'Member',
			description: 'Reads their own orders.',
			source: 'specification/permissions/member.json',
			grants: [
				{ kind: 'page', resource: 'app.page.orders', actions: ['view'] },
				{
					kind: 'api',
					resource: 'app.endpoint.orders',
					actions: ['GET'],
					data: [
						{
							resource: 'app.model.order',
							actions: ['read'],
							fields: ['id', 'total'],
							scope: 'Own account only'
						}
					]
				}
			]
		},
		{
			schemaVersion: 1,
			id: 'admin',
			title: 'Administrator',
			description: 'Manages all orders.',
			source: 'specification/permissions/admin.json',
			grants: [
				{
					kind: 'api',
					resource: 'app.endpoint.orders',
					actions: ['GET', 'DELETE'],
					data: [
						{
							resource: 'app.model.order',
							actions: ['read', 'delete'],
							fields: ['*'],
							scope: 'All accounts'
						}
					]
				},
				{
					kind: 'data',
					resource: 'app.model.order',
					actions: ['read', 'update'],
					fields: ['status'],
					scope: 'All accounts'
				}
			]
		}
	]
};

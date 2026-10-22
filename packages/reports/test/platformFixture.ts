import type { PlatformCatalog } from '../../../src/core/explorer-ui/Platform.types';
/** Deployment settings belonging to the synthetic Orders project, never the Harness app. */
export const platformFixture = {
	entries: [
		{
			id: 'web',
			runtime: 'SvelteKit on Cloudflare',
			status: 'configured',
			summary: 'Orders in the browser.',
			configuration: [
				{ name: 'Application', value: 'orders-web', description: 'Worker name.' },
				{
					name: 'GitHub App variables',
					value:
						'ORDERS_GITHUB_APP_ID, ORDERS_GITHUB_PRIVATE_KEY, ORDERS_GITHUB_CLIENT_ID, ORDERS_GITHUB_CLIENT_SECRET'
				}
			],
			commands: [{ name: 'Build', command: 'bun run build:web' }],
			requirements: ['Set the Orders deployment credential in the host secret store.'],
			sources: ['wrangler.jsonc']
		},
		{
			id: 'ios',
			runtime: 'Capacitor',
			status: 'setup-required',
			summary: 'Orders on iPhone and iPad.',
			configuration: [{ name: 'Bundle identifier', value: 'com.example.orders' }],
			commands: [{ name: 'Sync', command: 'bun run sync:ios' }],
			requirements: ['Configure a signing team for device distribution.'],
			sources: ['capacitor.config.ts']
		},
		{
			id: 'android',
			runtime: 'Not configured',
			status: 'not-configured',
			summary: 'No Android native project is registered.',
			configuration: [],
			commands: [],
			requirements: ['Add an Android project and release signing configuration.'],
			sources: []
		},
		{
			id: 'desktop',
			runtime: 'Electron',
			status: 'configured',
			summary: 'Orders on desktop.',
			configuration: [{ name: 'Application identifier', value: 'com.example.orders.desktop' }],
			commands: [{ name: 'Package', command: 'bun run package:desktop' }],
			requirements: ['Use a distribution certificate for a signed release.'],
			sources: ['electron.config.ts']
		}
	]
} satisfies PlatformCatalog;

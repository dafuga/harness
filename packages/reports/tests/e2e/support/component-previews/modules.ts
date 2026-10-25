import type { ExplorerScreenProps } from '../../../../src/models/explorer-ui/ExplorerScreen.types';
const definition = (id: string, title: string, resource: string, resourceTitle: string) => ({
	schemaVersion: 1 as const,
	id,
	version: '1.0.0',
	title,
	description:
		id === 'email'
			? 'Transactional email through Resend, with reusable email templates.'
			: 'Background streamed downloads, local data and durable queued writes.',
	instructions:
		id === 'email'
			? [
					'Configure RESEND_API_KEY and RESEND_EMAIL_FROM in server-only environment settings.',
					'Use DISABLE_EMAILS=true for local development.'
				]
			: [
					'Register authorized data sources behind one download endpoint.',
					'Keep pending writes on this device until the server acknowledges them.'
				],
	setup: [],
	dependencies: {},
	resources: [
		{
			id: resource,
			title: resourceTitle,
			singular: id === 'email' ? 'Email' : 'Offline collection',
			kind: id === 'email' ? 'mailer' : 'repository',
			instructions: ['Generate a resource, implement its contract, then run its tests.'],
			files: [{ path: `src/${id}/{{PascalName}}.ts`, contents: '' }]
		}
	]
});
export const moduleData = {
	gaps: [],
	modules: [
		{
			definition: definition('email', 'Email', 'email', 'Emails'),
			source: 'builtin' as const,
			installed: true,
			instances: [
				{
					module: 'email',
					type: 'email',
					name: 'Welcome',
					files: ['src/mailers/email/WelcomeMailer.ts']
				}
			]
		},
		{
			definition: definition('offline', 'Offline', 'collection', 'Offline collections'),
			source: 'builtin' as const,
			installed: false,
			instances: []
		}
	]
};
export function modulePreview(host: ExplorerScreenProps, entity?: string): ExplorerScreenProps {
	const route = {
		...host.route,
		category: 'pages' as const,
		screen: 'modules' as const,
		...(entity ? { entity } : {})
	};
	return {
		...host,
		route,
		scope: { ...host.scope, location: route },
		head: { ...host.head, modules: moduleData }
	};
}

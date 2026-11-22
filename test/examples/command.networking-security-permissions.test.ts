import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Command } from 'commander';
import { test, vi } from 'vitest';
import { PermissionsCommand } from '../../src/commands/networking-security/PermissionsCommand';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

async function writeProfiles(root: string): Promise<void> {
	const directory = join(root, 'specification', 'permissions');
	await mkdir(directory, { recursive: true });
	const profile = {
		schemaVersion: 1,
		id: 'editor',
		title: 'Report editor',
		description: 'Read reports and update invoices.',
		grants: [
			{ kind: 'api', resource: 'reports', actions: ['GET', 'PATCH'], data: [] },
			{ kind: 'api', resource: 'invoices', actions: ['GET'], data: [] },
			{ kind: 'page', resource: 'reports', actions: ['view'] },
			{ kind: 'data', resource: 'users', actions: ['read'], fields: ['id'], scope: 'tenant' }
		]
	};
	await writeFile(join(directory, 'editor.json'), JSON.stringify(profile), 'utf8');
}

function profileProgram() {
	const program = new Command().name('harness').exitOverride();
	const returned = new PermissionsCommand().register(program);
	return { program, returned };
}

function apiProgram() {
	const api = new Command().name('api').exitOverride();
	const returned = new PermissionsCommand().registerApi(api);
	return { api, returned };
}

async function profileQuery(root: string, ...args: string[]) {
	return invoke(profileProgram().program, ['permissions', '--root', root, ...args]);
}

async function apiQuery(root: string, ...args: string[]) {
	return invoke(apiProgram().api, ['permissions', ...args, '--root', root]);
}

async function invoke(
	command: Command,
	args: string[]
): Promise<{ output: unknown } | { error: { name: string; message: string } }> {
	const output: string[] = [];
	const log = vi.spyOn(console, 'log').mockImplementation((...values) => {
		output.push(values.map(String).join(' '));
	});
	let thrown: unknown;
	try {
		await command.parseAsync(args, { from: 'user' });
	} catch (error) {
		thrown = error;
	} finally {
		log.mockRestore();
	}
	if (thrown !== undefined)
		return {
			error:
				thrown instanceof Error
					? { name: thrown.name, message: thrown.message }
					: { name: typeof thrown, message: String(thrown) }
		};
	return { output: JSON.parse(output[0] ?? 'null') };
}

function outputOf(result: Awaited<ReturnType<typeof invoke>>) {
	if ('output' in result) return result.output;
	throw new Error(result.error.message);
}

function errorOf(result: Awaited<ReturnType<typeof invoke>>) {
	if ('error' in result) return result.error;
	throw new Error('The command completed without an error.');
}

async function profileExamples(root: string) {
	await writeProfiles(root);
	const registered = profileProgram();
	const permission = registered.program.commands[0];
	const listed = outputOf(
		await invoke(registered.program, ['permissions', '--root', root, 'list'])
	) as { profiles: Array<{ id: string; source: string }>; gaps: string[] };
	const shown = outputOf(await profileQuery(root, 'show', 'editor')) as {
		id: string;
		title: string;
		source: string;
	};
	const missing = errorOf(await profileQuery(root, 'show', 'unknown-profile'));
	return {
		registration: {
			returned: registered.returned,
			commands: registered.program.commands.map((command) => command.name()),
			children: permission?.commands.map((command) => command.name()),
			options: permission?.options.map((option) => option.flags)
		},
		listed: {
			profiles: listed.profiles.map((profile) => ({ id: profile.id, source: profile.source })),
			gaps: listed.gaps
		},
		shown: { id: shown.id, title: shown.title, source: shown.source },
		missing
	};
}

function apiSummary(result: unknown) {
	const value = result as {
		endpoint: string | null;
		profiles: Array<{
			id: string;
			grants: Array<{ resource: string; actions: string[] }>;
		}>;
		gaps: string[];
	};
	return {
		endpoint: value.endpoint,
		profiles: value.profiles.map((profile) => ({
			id: profile.id,
			grants: profile.grants.map((grant) => ({
				resource: grant.resource,
				actions: grant.actions
			}))
		})),
		gaps: value.gaps
	};
}

async function apiExamples(root: string) {
	await writeProfiles(root);
	const registered = apiProgram();
	const permissions = registered.api.commands[0];
	const all = apiSummary(outputOf(await invoke(registered.api, ['permissions', '--root', root])));
	const reports = apiSummary(outputOf(await apiQuery(root, 'reports')));
	return {
		registration: {
			returned: registered.returned,
			arguments: permissions?.registeredArguments.map((argument) => ({
				name: argument.name(),
				required: argument.required
			})),
			options: permissions?.options.map((option) => option.flags)
		},
		all,
		reports
	};
}

test('register lists, shows, and rejects unknown profiles', async () => {
	await withTempDir('permission-command-examples-', async (root) => {
		const example = await profileExamples(root);
		expect(example.registration).toEqual({
			returned: undefined,
			commands: ['permissions'],
			children: ['list', 'show'],
			options: ['--root <path>', '--commit <sha>', '--branch <name>', '--json']
		});
		expect(example.listed.profiles.map((profile) => profile.id)).toEqual(['editor']);
		expect(example.shown).toEqual({
			id: 'editor',
			title: 'Report editor',
			source: 'specification/permissions/editor.json'
		});
		expect(example.missing.message).toBe('Unknown permission profile: unknown-profile');
		recordExampleCases(
			{
				unitId: 'command.networking-security-permissions',
				symbol: 'PermissionsCommand.register',
				state: 'register-lists-shows-and-rejects-unknown-profiles',
				evidence: 'examples-cases',
				file: 'register-lists-shows-and-rejects-unknown-profiles.json'
			},
			[
				{ name: 'List', input: { action: 'list', root: 'temp' }, output: example.listed },
				{
					name: 'Show editor',
					input: { action: 'show', profile: 'editor', root: 'temp' },
					output: example.shown
				},
				{
					name: 'Unknown profile',
					input: { action: 'show', profile: 'unknown-profile', root: 'temp' },
					error: example.missing
				}
			]
		);
	});
});

test('registerApi returns grants for all or one endpoint', async () => {
	await withTempDir('permission-api-command-examples-', async (root) => {
		const example = await apiExamples(root);
		expect(example.registration).toEqual({
			returned: undefined,
			arguments: [{ name: 'endpoint', required: false }],
			options: ['--root <path>']
		});
		expect(example.all.endpoint).toBeNull();
		expect(example.all.profiles.map((profile) => profile.id)).toEqual(['editor']);
		expect(example.all.profiles[0].grants.map((grant) => grant.resource)).toEqual([
			'reports',
			'invoices'
		]);
		expect(example.reports.endpoint).toBe('reports');
		expect(example.reports.profiles[0].grants).toHaveLength(1);
		expect(example.reports.profiles[0].grants[0].resource).toBe('reports');
		expect(example.reports.gaps).toEqual([]);
		recordExampleCases(
			{
				unitId: 'command.networking-security-permissions',
				symbol: 'PermissionsCommand.registerApi',
				state: 'registerapi-returns-grants-for-all-or-one-endpoint',
				evidence: 'examples-cases',
				file: 'registerapi-returns-grants-for-all-or-one-endpoint.json'
			},
			[
				{ name: 'All grants', input: { endpoint: null, root: 'temp' }, output: example.all },
				{
					name: 'Reports filter',
					input: { endpoint: 'reports', root: 'temp' },
					output: example.reports
				}
			]
		);
	});
});

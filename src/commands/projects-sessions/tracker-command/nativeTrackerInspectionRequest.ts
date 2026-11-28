// @harness-uid u_r7qgepnoax
import { nativeTrackerAutolaunchRequest } from './nativeTrackerAutolaunchRequest';
import { nativeTrackerMachineRequest } from './nativeTrackerMachineRequest';
import { nativeTrackerJobRequest } from './nativeTrackerJobRequest';
import type { NativeTrackerRequest } from './nativeTrackerCli.types';
import { nativeTrackerQuery } from './nativeTrackerRunRequest';
import { nativeTrackerAdapterRequest } from './nativeTrackerAdapterRequest';

const inspectionRoutes = new Map<string, Record<string, string>>([
	['autolaunch', { status: '/autolaunch', 'dry-run': '/autolaunch/dry-run' }],
	['adapter', { list: '/adapters' }],
	['backup', { list: '/backup/list' }]
]);

export function nativeTrackerInspectionRequest(
	command: string,
	words: string[],
	values: Record<string, string | boolean | undefined>
): NativeTrackerRequest | undefined {
	if (command === 'progress') return readProjectProgress(words, values.project);
	if (command === 'job') return nativeTrackerJobRequest(words, values);
	if (command === 'backup' && words.join() === 'now')
		return { method: 'POST', path: '/backup/now' };
	const adapter = command === 'adapter' ? nativeTrackerAdapterRequest(words, values) : undefined;
	const admin = command === 'autolaunch' ? nativeTrackerAutolaunchRequest(words) : undefined;
	return (
		admin ??
		adapter ??
		nativeTrackerMachineRequest(command, words, values) ??
		nativeTrackerReadInspection(command, words)
	);
}

function nativeTrackerReadInspection(
	command: string,
	words: string[]
): NativeTrackerRequest | undefined {
	const routes = inspectionRoutes.get(command);
	if (!routes) return undefined;
	const sub = words[0] ?? (command === 'autolaunch' ? 'status' : '');
	if (words.length > 1 || !Object.hasOwn(routes, sub))
		throw new TypeError(`usage: tracker ${command} ${Object.keys(routes).join('|')}`);
	return { method: 'GET', path: routes[sub] };
}

function readProjectProgress(
	words: string[],
	project: string | boolean | undefined
): NativeTrackerRequest | undefined {
	if (project === undefined) return undefined;
	if (words.length || typeof project !== 'string' || !project.trim())
		throw new TypeError('usage: tracker progress --project <project>');
	return { method: 'GET', path: '/progress' + nativeTrackerQuery({ project }) };
}

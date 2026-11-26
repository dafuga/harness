// @harness-uid u_6dl2gp42h5
import type { NativeTrackerAskValues, NativeTrackerRequest } from './nativeTrackerCli.types';

const usage = 'usage: tracker job list|set|rm|test';
const routes = new Map<string, { method: NativeTrackerRequest['method']; suffix: string }>([
	['set', { method: 'POST', suffix: '' }],
	['rm', { method: 'DELETE', suffix: '' }],
	['test', { method: 'POST', suffix: '/test' }]
]);

export const nativeTrackerJobHelp =
	"Box jobs (hub only): job list | rm <id> | test <id> | set <id> --cmd 'C' " +
	'[--wake-on finding|fail|always] [--timeout S]\n' +
	'  Exit 0 records done, 10 wakes the owner with the output, anything else or a timeout fails.';

export function nativeTrackerJobRequest(
	[mode, id, ...rest]: string[],
	values: NativeTrackerAskValues
): NativeTrackerRequest {
	const { cmd, 'wake-on': wakeOn, timeout } = values;
	const settings = [cmd, wakeOn, timeout].some((value) => value !== undefined);
	if (settings && mode !== 'set') throw new TypeError('job settings require job set');
	if (mode === 'list' && !id) return { method: 'GET', path: '/jobs' };
	const route = routes.get(mode);
	if (!route || !id || rest.length) throw new TypeError(usage);
	const body = mode === 'set' ? { cmd, wake_on: wakeOn, timeout_s: timeout } : undefined;
	return { method: route.method, path: `/jobs/${encodeURIComponent(id)}${route.suffix}`, body };
}

import { basename } from 'node:path';
export type CpuRole = 'codex' | 'harness' | 'agent';
export interface CpuProcess {
	pid: number;
	parentPid: number;
	cpuMs: number;
	role?: CpuRole;
	label?: string;
}
// Arguments are used only for classification and are never returned or persisted.
export function cpuProcesses(value: string, monitorPid = process.pid): CpuProcess[] {
	return value.split('\n').flatMap((line) => {
		const match = line.match(/^\s*(\d+)\s+(\d+)\s+([\d:.+-]+)\s+(.+)$/);
		if (!match) return [];
		const [, pid, parentPid, time, command] = match;
		const identity =
			Number(pid) === monitorPid
				? { role: 'harness' as const, label: 'Harness' }
				: classify(command);
		return [{ pid: Number(pid), parentPid: Number(parentPid), cpuMs: cpuTime(time), ...identity }];
	});
}
function cpuTime(value: string): number {
	const [days, clock] = value.includes('-') ? value.split('-') : ['0', value];
	const seconds = clock.split(':').reduce((total, part) => total * 60 + Number(part), 0);
	return (Number(days) * 86400 + seconds) * 1000;
}
function classify(command: string): { role?: CpuRole; label?: string } {
	const executable = basename(command.split(/\s/)[0]);
	if (
		/\bharness\/(?:src\/index\.ts|dist\/(?:index\.js|reports\/))/.test(command) ||
		executable === 'harness'
	)
		return { role: 'harness', label: 'Harness' };
	if (executable === 'codex')
		return /\bapp-server\b/.test(command)
			? { role: 'codex', label: 'Codex app' }
			: { role: 'agent', label: 'Codex CLI' };
	if (
		/(?:Codex(?: Framework|\.app| \(| Computer Use\.app)|ChatGPT\.app\/Contents\/MacOS\/ChatGPT)/.test(
			command
		)
	)
		return { role: 'codex', label: 'Codex app' };
	if (executable === 'claude' || /@anthropic-ai\/claude-code\/cli\.js/.test(command))
		return { role: 'agent', label: 'Claude' };
	if (['opencode', 'aider'].includes(executable)) return { role: 'agent', label: executable };
	return {};
}

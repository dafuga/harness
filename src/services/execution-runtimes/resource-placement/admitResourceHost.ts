// @harness-uid u_zhks2htppd
import type {
	ResourceCandidate,
	ResourceHost,
	ResourceReservation,
	ResourceRunnerState,
	ResourceWork
} from '../../../core/execution-runtimes/resourcePlacementTypes';

/**
 * Decides whether one computer may start one work request now. Returns the first blocking
 * reason, or null when it is admitted. Gates run in the Tracker's order: due placement,
 * launcher and holds, repository, fit, capacity, then the non-home (MB2) cap.
 */
export function admitResourceHost(
	host: ResourceHost,
	work: ResourceWork,
	candidate: ResourceCandidate,
	reservations: ResourceReservation[]
): string | null {
	const due = dueHold(host, work);
	if (due) return due;
	const runner = host.runner;
	if (!runner?.enabled) return disabledReason(host, candidate);
	return (
		runnerHold(runner, work) ??
		repoHold(runner, work) ??
		fitHold(candidate) ??
		capacityHold(runner, host.node, reservations) ??
		otherProjectHold(runner, work, host, reservations)
	);
}

function disabledReason(host: ResourceHost, candidate: ResourceCandidate): string {
	return host.snapshot && candidate.status !== 'offline'
		? 'launcher disabled'
		: 'no fresh machine sample';
}

/** Due launches honour an explicit computer and keep the shared box for light work. */
function dueHold(host: ResourceHost, work: ResourceWork): string | null {
	if (!work.due) return null;
	if (work.requestedNode && work.requestedNode !== host.node) {
		return `not the requested computer (${work.requestedNode})`;
	}
	return host.role === 'shared' && !work.light ? 'shared box is reserved for light work' : null;
}

function runnerHold(runner: ResourceRunnerState, work: ResourceWork): string | null {
	if (runner.diskHold) return runner.diskHold;
	if (work.cli && runner.quotaHolds[work.cli]) return `${work.cli} quota exhausted`;
	if (work.cli === 'codex' && runner.codexPaused) return 'Codex paused';
	return null;
}

function repoHold(runner: ResourceRunnerState, work: ResourceWork): string | null {
	if (work.repo) {
		return runner.repoPaths.includes(work.repo) ? null : 'explicit repo path unavailable';
	}
	const project = (work.project ?? '').toLowerCase();
	const known = runner.projects.map((p) => p.toLowerCase());
	return project && known.includes(project) ? null : `no repo for ${work.project}`;
}

function fitHold(candidate: ResourceCandidate): string | null {
	if (candidate.fits) return null;
	return candidate.reasons[candidate.reasons.length - 1] ?? 'does not fit';
}

function capacityHold(
	runner: ResourceRunnerState,
	node: string,
	reservations: ResourceReservation[]
): string | null {
	const reserved = reservations.filter((r) => r.node === node).length;
	const total = runner.activeSessions + reserved;
	return total >= runner.maxConcurrent
		? `${total}/${runner.maxConcurrent} sessions running or reserved`
		: null;
}

/** MB2 rule: non-home work shares a small core budget and a session cap. */
function otherProjectHold(
	runner: ResourceRunnerState,
	work: ResourceWork,
	host: ResourceHost,
	reservations: ResourceReservation[]
): string | null {
	const home = runner.homeProjects.map((p) => p.toLowerCase());
	const max = runner.otherMax;
	if (!home.length || max == null || isHome(work.project, home)) return null;
	const scope: { home: string[]; label: string; max: number } = {
		home,
		label: `non-${home.join('/')}`,
		max
	};
	return (
		otherLoadHold(runner, host, scope.label) ??
		otherSessionHold(runner, host.node, reservations, scope) ??
		otherCpuHold(runner, scope.label)
	);
}

function isHome(project: string | null, home: string[]): boolean {
	return project !== null && home.includes(project.toLowerCase());
}

function otherLoadHold(
	runner: ResourceRunnerState,
	host: ResourceHost,
	label: string
): string | null {
	const limit = runner.otherLoadLimitCores;
	if (limit == null || !host.snapshot) return null;
	const busyCores = host.snapshot.usableCores - host.snapshot.cpuAvailableCores;
	return busyCores >= limit ? `load too high for ${label} work` : null;
}

function otherSessionHold(
	runner: ResourceRunnerState,
	node: string,
	reservations: ResourceReservation[],
	scope: { home: string[]; label: string; max: number }
): string | null {
	const reserved = reservations.filter(
		(r) => r.node === node && !scope.home.includes((r.project ?? '').toLowerCase())
	).length;
	const other = runner.otherActiveSessions + reserved;
	return other >= scope.max
		? `${other}/${scope.max} ${scope.label} sessions running or reserved`
		: null;
}

function otherCpuHold(runner: ResourceRunnerState, label: string): string | null {
	const cores = runner.otherCores;
	if (!cores || runner.otherCpuPercent + 100 <= cores * 100) return null;
	return `${label} work at ${runner.otherCpuPercent}% of ${cores} cores`;
}

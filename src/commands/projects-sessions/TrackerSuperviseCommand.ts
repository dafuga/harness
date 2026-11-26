// @harness-uid u_vgqa27fzcq
import { parseArgs } from 'node:util';
import { TrackerHostSupervisorService } from '../../services/projects-sessions/TrackerHostSupervisorService';
import { trackerSupervisorFiles } from '../../services/projects-sessions/tracker-host-supervisor-service/trackerSupervisorFiles';
import { loadTrackerNodeConfig } from '../../services/projects-sessions/tracker-node-service/trackerNodeConfig';
import { harnessSelfCommand } from './tracker-command/harnessSelfCommand';

const usage = 'Usage: harness tracker supervise --config <private absolute path> --role hub|spoke';

export class TrackerSuperviseCommand {
	async run(args: string[]): Promise<number> {
		const options = supervisorOptions(args);
		if (!options) {
			console.error(usage);
			return 2;
		}
		const stop = new AbortController();
		const onSignal = () => stop.abort();
		// A closing terminal must not take the supervisor with it.
		const ignore = () => {};
		process.on('SIGINT', onSignal);
		process.on('SIGTERM', onSignal);
		process.on('SIGHUP', ignore);
		try {
			const outcome = await new TrackerHostSupervisorService(options).run(stop.signal);
			if (outcome === 'already-running') console.log('tracker supervisor already running');
			return 0;
		} catch {
			console.error('tracker: supervisor failed. Check its database directory and log.');
			return 1;
		} finally {
			process.removeListener('SIGINT', onSignal);
			process.removeListener('SIGTERM', onSignal);
			process.removeListener('SIGHUP', ignore);
		}
	}
}

function supervisorOptions(args: string[]) {
	try {
		const { values } = parseArgs({
			args,
			options: { config: { type: 'string' }, role: { type: 'string' } }
		});
		const { config, role } = values;
		if (!config || !role) return null;
		const node = loadTrackerNodeConfig(config);
		if (node.role !== role) return null;
		const self = [...harnessSelfCommand(), 'tracker'];
		return {
			serve: [...self, 'serve', '--config', config, '--role', role],
			health: [...self, 'health', '--alert', '--config', config],
			...trackerSupervisorFiles(node.database)
		};
	} catch {
		return null;
	}
}

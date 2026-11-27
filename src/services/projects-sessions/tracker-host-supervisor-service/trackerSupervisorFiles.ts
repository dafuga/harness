// @harness-uid u_ilgvyw6mvz
/** @pure The supervisor's own files, kept beside the node's database. */
export function trackerSupervisorFiles(database: string) {
	return {
		lockFile: database + '.host-supervisor-lock.sqlite',
		pidFile: database + '.host-supervisor.pid',
		log: database + '.log'
	};
}

import { StoppedServer, reportServerRecord, processStarted } from '../../utils/reportServerRecord';

/** Ends the server this store recorded on the port, waits until it is gone, and forgets it. */
export async function stopReportServer(root: string, port: number): Promise<StoppedServer> {
	const record = reportServerRecord(root, port);
	const known = await record.read();
	if (!known) {
		return { port, stopped: false, reason: 'This report store recorded no server on this port.' };
	}
	const same = async () => (await processStarted(known.pid)) === known.started;
	const was = await same();
	if (was) process.kill(known.pid, 'SIGTERM');
	for (let waited = 0; waited < 5000 && (await same()); waited += 100) {
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	if (await same()) process.kill(known.pid, 'SIGKILL');
	await record.remove();
	const ended = was ? {} : { reason: 'The recorded server had already ended.' };
	return { port, stopped: was, pid: known.pid, ...ended };
}

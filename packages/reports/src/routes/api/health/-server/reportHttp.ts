import { repository } from '../../../../utils/reportHttp';
import { reportBuildIdentity } from '../../../../utils/reportBuildIdentity';
import { json } from '@sveltejs/kit';
import { createHash } from 'node:crypto';

export function reportHttp() {
	return json({
		app: 'project-reports',
		version: 1,
		buildId: reportBuildIdentity(),
		// Only a server started for a verification run knows which revision it was built from.
		revision: process.env.HARNESS_VERIFY_REVISION ?? null,
		root: createHash('sha256').update(repository.root).digest('hex')
	});
}

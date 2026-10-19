import { error, isHttpError, type RequestEvent } from '@sveltejs/kit';
import { reportFile } from '../../../../../../utils/reportHttp';
export async function GET({ params, request }: RequestEvent) {
	try {
		return await reportFile(params.id!, params.type!, params.file!, request.headers.get('range'));
	} catch (reason) {
		if (isHttpError(reason)) throw reason;
		error(404, 'Registered asset not found');
	}
}

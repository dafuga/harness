// @harness-uid u_wbx7usmkro
import { error, isHttpError } from '@sveltejs/kit';
import { reportFile } from './reportHttp';

export async function GET({
	params,
	request
}: {
	params: { id: string; type: string; file: string };
	request: Request;
}) {
	try {
		return await reportFile(params.id, params.type, params.file, request.headers.get('range'));
	} catch (reason) {
		if (isHttpError(reason)) throw reason;
		error(404, 'Registered asset not found');
	}
}

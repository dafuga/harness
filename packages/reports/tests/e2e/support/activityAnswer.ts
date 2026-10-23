import type { ActivityAnswer } from './activityAnswer.types';
import type { APIRequestContext } from '@playwright/test';

/** One reading of the activity of the hosting repository, with the text it was sent as. */
export async function activityAnswer(request: APIRequestContext, query = '') {
	const response = await request.get('/api/project-activity' + query);
	const text = await response.text();
	return { response, text, answer: JSON.parse(text) as ActivityAnswer };
}

export type { ActivityAnswer } from './activityAnswer.types';

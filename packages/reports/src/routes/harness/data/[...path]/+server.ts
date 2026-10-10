import type { RequestEvent } from '@sveltejs/kit';
import { consoleServer } from '../../../../utils/consoleServer';
export const GET = (event: RequestEvent) => consoleServer().json(event, event.params.path ?? '');

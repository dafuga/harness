import type { RequestEvent } from '@sveltejs/kit';
import { consoleServer } from "../../../../utils/console-server/consoleServer";
export const GET = (event: RequestEvent) => consoleServer().media(event, event.params.file ?? '');

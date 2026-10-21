import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { NavigationValidator } from '../../../../validators/explorer-ui/NavigationValidator';

/** Only the top frame of the app page, in this very window, may ask the main process anything. */
export function trustedSender(
	event: Pick<IpcMainInvokeEvent, 'sender' | 'senderFrame'>,
	window: BrowserWindow
): boolean {
	return (
		event.sender === window.webContents &&
		event.senderFrame === window.webContents.mainFrame &&
		new NavigationValidator().validate(event.senderFrame?.url)
	);
}

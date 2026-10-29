
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const order = ["empty.desktop","empty.tablet","empty.mobile","filled.desktop","filled.tablet","filled.mobile"];
export default class FixtureCaptureReporter {
 onEnd() {
  const directory = process.env.HARNESS_EVIDENCE_DIR;
  if (!directory) return;
  const file = join(directory, 'captures.ndjson');
  if (!existsSync(file)) return;
  const lines = readFileSync(file, 'utf8').split('\n').filter(line => line.length > 0);
  const entries = lines.map((line, index) => {
   const capture = JSON.parse(line);
   const position = order.indexOf(capture.state + '.' + capture.viewport);
   return { line, index, position: position < 0 ? order.length : position };
  });
  entries.sort((left, right) => left.position - right.position || left.index - right.index);
  writeFileSync(file, entries.map(entry => entry.line).join('\n') + (entries.length ? '\n' : ''));
 }
}

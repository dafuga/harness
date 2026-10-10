//! Native JSON process: one request on stdin, or one request per line with `--lines`.

use std::io::{self, BufRead, Read, Write};

/// Bytes that are not UTF-8 are not JSON; they are refused like any other invalid text.
fn answer(bytes: &[u8]) -> String {
    impact_kernel::handle(std::str::from_utf8(bytes).unwrap_or(""))
}

fn main() -> io::Result<()> {
    let persistent = std::env::args().any(|argument| argument == "--lines");
    let stdin = io::stdin();
    let mut out = io::stdout().lock();
    if !persistent {
        let mut bytes = Vec::new();
        stdin.lock().read_to_end(&mut bytes)?;
        return out.write_all(answer(&bytes).as_bytes());
    }
    for line in stdin.lock().split(b'\n') {
        // Every line gets exactly one answer, so a caller never waits on a blank request.
        writeln!(out, "{}", answer(&line?))?;
        out.flush()?;
    }
    Ok(())
}

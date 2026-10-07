"""Install/update daily 30-day cleanup for all local and cloud report media."""

import os
import plistlib
import shutil
import subprocess
from pathlib import Path


def main() -> None:
    home = Path.home()
    project = Path(__file__).resolve().parents[1]
    bun = shutil.which("bun")
    if not bun:
        raise RuntimeError("Bun is required to install report retention")
    label = "com.danielfugere.project-reports.screenshot-retention"
    agents = home / "Library" / "LaunchAgents"
    reports = home / ".codex" / "project-reports"
    agents.mkdir(parents=True, exist_ok=True)
    reports.mkdir(parents=True, exist_ok=True, mode=0o700)
    path = agents / f"{label}.plist"
    config = {
        "Label": label,
        "ProgramArguments": [bun, str(project / "src" / "cli" / "index.ts"), "cleanup"],
        "WorkingDirectory": str(project),
        "EnvironmentVariables": {
            "HOME": str(home),
            "PATH": str(Path(bun).parent) + ":" + os.environ.get("PATH", "/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin"),
        },
        "StartCalendarInterval": {"Hour": 3, "Minute": 0},
        "RunAtLoad": True,
        "StandardOutPath": "/dev/null",
        "StandardErrorPath": str(reports / "retention-fatal.log"),
    }
    with path.open("wb") as output:
        plistlib.dump(config, output)
    path.chmod(0o600)
    subprocess.run(["plutil", "-lint", str(path)], check=True)
    domain = f"gui/{os.getuid()}"
    subprocess.run(["launchctl", "bootout", domain, str(path)], capture_output=True)
    subprocess.run(["launchctl", "bootstrap", domain, str(path)], check=True)
    subprocess.run(
        ["launchctl", "print", f"{domain}/{label}"], check=True, stdout=subprocess.DEVNULL
    )
    print(f"Installed daily cloud/local report cleanup at 03:00 local time: {path}")


if __name__ == "__main__":
    main()

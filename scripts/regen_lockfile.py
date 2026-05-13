"""Run `npm install` inside a Node container on the VPS to regenerate
package-lock.json after editing package.json overrides, then copy it back.
"""
import paramiko
import sys
from pathlib import Path

HOST = "72.61.196.210"
USER = "root"
PASSWORDS = ["Pg.reag22740", "Pg.reag49000"]
PROJECT_DIR = "/docker/openclaw-nmtd/data/.openclaw/workspace/lima-app"
LOCAL_LOCKFILE = Path(__file__).resolve().parent.parent / "package-lock.json"


def run(client, cmd, timeout=600):
    print(f"$ {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    if out.strip():
        sys.stdout.buffer.write(out.strip().encode("utf-8", errors="replace") + b"\n")
    if err.strip():
        sys.stdout.buffer.write(b"[stderr] " + err.strip().encode("utf-8", errors="replace") + b"\n")
    return stdout.channel.recv_exit_status()


client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
connected = False
for pwd in PASSWORDS:
    try:
        client.connect(HOST, username=USER, password=pwd, timeout=15)
        print(f"Connected with password: {pwd[:4]}****")
        connected = True
        break
    except paramiko.AuthenticationException:
        pass

if not connected:
    sys.exit("Could not connect to VPS")

# Pull latest from main (so VPS has the updated package.json we just pushed)
run(client, f"cd {PROJECT_DIR} && git pull")
# Run npm install inside a Node container, output the regenerated lockfile
run(
    client,
    f"cd {PROJECT_DIR} && docker run --rm -v $(pwd):/app -w /app node:22-slim "
    f"sh -c 'npm install --no-audit --no-fund'",
    timeout=600,
)

# Pull lockfile back via SFTP
sftp = client.open_sftp()
remote_path = f"{PROJECT_DIR}/package-lock.json"
print(f"Fetching {remote_path} -> {LOCAL_LOCKFILE}")
sftp.get(remote_path, str(LOCAL_LOCKFILE))
sftp.close()
client.close()
print("Done.")

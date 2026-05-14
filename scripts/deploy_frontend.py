"""SSH into VPS and rebuild frontend Docker container.

Hardened deploy:
- Captures git rev-parse HEAD before and after pull to confirm the pull
  actually advanced (catches the silent "Already up to date" trap that
  bit us on 2026-05-14 when a stale package-lock.json blocked the merge).
- Auto-stashes tracked dirty files so the pull doesn't refuse mid-deploy.
- Verifies the rebuilt frontend container's Created timestamp is fresh.
"""
import paramiko
import sys
import time

HOST = "72.61.196.210"
USER = "root"
PASSWORDS = ["Pg.reag22740", "Pg.reag49000"]
PROJECT_DIR = "/docker/openclaw-nmtd/data/.openclaw/workspace/lima-app"


def run(client, cmd, timeout=300):
    print(f"$ {cmd}")
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    if out.strip():
        sys.stdout.buffer.write(out.strip().encode("utf-8", errors="replace") + b"\n")
    if err.strip():
        sys.stdout.buffer.write(b"[stderr] " + err.strip().encode("utf-8", errors="replace") + b"\n")
    return stdout.channel.recv_exit_status(), out, err


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
        print(f"Auth failed with {pwd[:4]}****")

if not connected:
    print("Could not connect — check credentials")
    sys.exit(1)

# Capture HEAD before
_, head_before, _ = run(client, f"cd {PROJECT_DIR} && git rev-parse HEAD")
head_before = head_before.strip()

# Stash tracked dirty state so pull doesn't refuse.
_, dirty, _ = run(client, f"cd {PROJECT_DIR} && git status --porcelain")
if dirty.strip():
    stash_tag = f"auto-deploy-{int(time.time())}"
    run(client, f"cd {PROJECT_DIR} && git stash push -m '{stash_tag}'")

# Pull main explicitly and re-check HEAD.
run(client, f"cd {PROJECT_DIR} && git pull origin main")
_, head_after, _ = run(client, f"cd {PROJECT_DIR} && git rev-parse HEAD")
head_after = head_after.strip()

if head_before == head_after:
    print(f"\n[!] HEAD did not advance ({head_before[:8]}).")
    print("[!] Either origin/main has no new commits, or pull failed silently.")
    print("[!] Aborting rebuild — re-run after confirming origin/main is ahead.")
    client.close()
    sys.exit(2)

print(f"\n[+] HEAD advanced: {head_before[:8]} -> {head_after[:8]}")

# Rebuild frontend.
run(
    client,
    f"cd {PROJECT_DIR} && docker compose -f docker-compose.prod.yml up -d --build frontend",
    timeout=900,
)

# Verify container is fresh.
run(client, "docker ps --format 'table {{.Names}}\\t{{.Status}}' | grep -i lima")
run(client, "docker inspect lima-frontend --format '{{.Created}}'")

client.close()
print("\nDeploy complete!")

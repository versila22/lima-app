"""One-shot: write VITE_SENTRY_DSN to the VPS .env and rebuild the frontend."""
import paramiko
import sys

HOST = "72.61.196.210"
USER = "root"
PASSWORDS = ["Pg.reag22740", "Pg.reag49000"]
PROJECT_DIR = "/docker/openclaw-nmtd/data/.openclaw/workspace/lima-app"
DSN = "https://f46e058be6a1b5840b7e6dbd42c5fd00@o4511380300496896.ingest.de.sentry.io/4511380391723088"


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
for pwd in PASSWORDS:
    try:
        client.connect(HOST, username=USER, password=pwd, timeout=15)
        print(f"Connected with password: {pwd[:4]}****")
        break
    except paramiko.AuthenticationException:
        pass
else:
    sys.exit("Auth failed")

# Write .env (idempotent: replace any existing VITE_SENTRY_DSN line)
run(
    client,
    f"cd {PROJECT_DIR} && "
    f"touch .env && "
    f"sed -i '/^VITE_SENTRY_DSN=/d' .env && "
    f"echo 'VITE_SENTRY_DSN={DSN}' >> .env && "
    f"chmod 600 .env && "
    f"cat .env",
)

# Pull latest, rebuild
run(client, f"cd {PROJECT_DIR} && git pull")
run(
    client,
    f"cd {PROJECT_DIR} && docker compose -f docker-compose.prod.yml up -d --build frontend",
    timeout=600,
)
run(client, "docker ps --format 'table {{.Names}}\\t{{.Status}}' | grep lima")

client.close()
print("\nDone.")

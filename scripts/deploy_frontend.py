"""SSH into VPS and rebuild frontend Docker container."""
import paramiko
import sys

HOST = "72.61.196.210"
USER = "root"
PASSWORDS = ["Pg.reag22740", "Pg.reag49000"]
PROJECT_DIR = "/docker/openclaw-nmtd/data/.openclaw/workspace/lima-app"

def run(client, cmd, timeout=300):
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
        print(f"Auth failed with {pwd[:4]}****")

if not connected:
    print("Could not connect — check credentials")
    sys.exit(1)

run(client, f"cd {PROJECT_DIR} && git pull")
run(client, f"cd {PROJECT_DIR} && docker compose -f docker-compose.prod.yml up -d --build frontend", timeout=300)
run(client, "docker ps --format 'table {{.Names}}\\t{{.Status}}' | grep lima")

client.close()
print("\nDeploy complete!")

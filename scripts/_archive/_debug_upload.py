"""Check backend status and R2 config."""
import paramiko, sys

HOST = "72.61.196.210"
USER = "root"
PASSWORD = "Pg.reag22740"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=15)

def run(label, cmd, timeout=30):
    print(f"\n=== {label} ===")
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    combined = (out + err).strip()
    sys.stdout.buffer.write(combined.encode("utf-8", errors="replace") + b"\n")

run("Docker ps", "docker ps --format '{{.Names}} | {{.Status}}'")
run("Lima backend logs tail", "docker logs lima-backend 2>&1 | grep -v 'asyncpg\\|sqlalchemy\\|pool\\|checkout\\|fairy\\|reraise\\|_connect\\|greenlet' | tail -40")
run("docker-compose.prod.yml", "cat /docker/openclaw-nmtd/data/.openclaw/workspace/lima-app/docker-compose.prod.yml")
run("Backend env vars (no secrets)", "docker inspect lima-backend | python3 -c \"import sys,json; env=[e for e in json.load(sys.stdin)[0]['Config']['Env'] if not any(s in e for s in ['SECRET','PASSWORD','KEY'])]; print('\\n'.join(env))\"")

client.close()

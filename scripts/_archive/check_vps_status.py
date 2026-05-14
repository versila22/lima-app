import paramiko, sys

HOST = "72.61.196.210"
USER = "root"
PASSWORD = "Pg.reag22740"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=15)

def run(cmd, timeout=30):
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors="replace")
    sys.stdout.buffer.write(out.encode("utf-8", errors="replace"))

run("docker logs lima-frontend 2>&1 | tail -20")
client.close()

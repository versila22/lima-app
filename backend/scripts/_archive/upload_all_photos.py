import os
import asyncio
import requests
from app.database import SessionLocal
from app.models.member import Member
from sqlalchemy import select
from app.utils.security import create_access_token
from app.config import settings

API_URL = "https://api-production-e15b.up.railway.app"
PHOTOS_DIR = "/data/.openclaw/workspace/lima-app/public/photos"

async def main():
    async with SessionLocal() as db:
        result = await db.execute(select(Member).where(Member.app_role == 'admin'))
        admin = result.scalars().first()
        if not admin:
            print("No admin found")
            return
        
        token = create_access_token(
            subject=str(admin.id),
            extra_claims={"role": admin.app_role},
        )
        print(f"Token created for admin {admin.email}")

    headers = {"Authorization": f"Bearer {token}"}
    for filename in os.listdir(PHOTOS_DIR):
        if not filename.endswith(('.jpg', '.jpeg', '.png')):
            continue
        
        member_id = filename.split('.')[0]
        file_path = os.path.join(PHOTOS_DIR, filename)
        
        with open(file_path, "rb") as f:
            files = {"file": (filename, f, "image/jpeg")}
            url = f"{API_URL}/members/{member_id}/photo"
            resp = requests.post(url, headers=headers, files=files)
            if resp.status_code == 200:
                print(f"Success for {member_id}")
            else:
                print(f"Failed for {member_id}: {resp.status_code} {resp.text}")

if __name__ == "__main__":
    asyncio.run(main())

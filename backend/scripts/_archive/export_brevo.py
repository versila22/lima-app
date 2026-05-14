import asyncio
import csv
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.config import settings

async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT email, first_name, last_name, app_role FROM members WHERE is_active = true"))
        members = result.fetchall()
        
    with open("/data/.openclaw/workspace/lima-app/brevo_contacts.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["EMAIL", "FIRSTNAME", "LASTNAME", "ROLE"])
        for m in members:
            writer.writerow([m.email, m.first_name, m.last_name, m.app_role])
            
    print(f"Exported {len(members)} contacts.")

if __name__ == "__main__":
    asyncio.run(main())

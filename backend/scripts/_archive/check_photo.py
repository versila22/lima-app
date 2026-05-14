import asyncio
from sqlalchemy import select
from app.database import SessionLocal
from app.models.member import Member

async def main():
    async with SessionLocal() as db:
        result = await db.execute(select(Member).where(Member.email == "jerome.jacq@gmail.com"))
        member = result.scalar_one_or_none()
        if member:
            print(f"Photo URL for jerome: {member.photo_url}")
        else:
            print("Not found")

asyncio.run(main())

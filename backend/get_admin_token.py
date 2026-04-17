import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
from app.models.member import Member
import sys
import os
from app.utils.security import create_access_token
from app.config import Settings

async def main():
    engine = create_async_engine(os.environ['DATABASE_URL'], echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        result = await db.execute(select(Member).where(Member.app_role == 'admin'))
        admin = result.scalars().first()
        if not admin:
            print("No admin")
            sys.exit(1)
        token = create_access_token(subject=str(admin.id), extra_claims={"role": admin.app_role})
        print(token)
        
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())

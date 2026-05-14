import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
from app.config import settings
from app.models.member import Member
from app.utils.security import hash_password

async def main():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    passwords = {
        "ca@lima.asso.fr": "ca",
        "spectacle@lima.asso.fr": "spectacle",
        "comprog@lima.asso.fr": "comprog",
        "comcom@lima.asso.fr": "comcom",
        "comform@lima.asso.fr": "comform"
    }
    
    async with async_session() as session:
        result = await session.execute(select(Member).where(Member.email.in_(passwords.keys())))
        members = result.scalars().all()
        
        for member in members:
            new_pass = passwords[member.email]
            member.password_hash = hash_password(new_pass)
            print(f"Updated password for {member.email}")
            
        await session.commit()
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())

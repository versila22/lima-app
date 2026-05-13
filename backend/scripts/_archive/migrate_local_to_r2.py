import asyncio
import os
import boto3
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from app.config import settings

s3_client = boto3.client(
    's3',
    endpoint_url="https://df52739360dbec3a97b4d87d797ba9a9.r2.cloudflarestorage.com",
    aws_access_key_id="85ac3f95ea5bb38cb2a4575909d12cae",
    aws_secret_access_key="efaf5aab9b0291138d0d38f95be051ec144a4e05a7264c7eff4ebfa6cac80a18",
    region_name="auto"
)

async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    photos_dir = "../dist/photos"
    
    async with AsyncSession(engine) as db:
        if not os.path.exists(photos_dir):
            print(f"Dossier {photos_dir} introuvable.")
            return

        count = 0
        for filename in os.listdir(photos_dir):
            if not filename.endswith('.jpg'): continue
            filepath = os.path.join(photos_dir, filename)
            
            s3_key = f"photos/{filename}"
            print(f"Upload de {filename}...")
            
            with open(filepath, "rb") as f:
                s3_client.put_object(
                    Bucket="lima-photos",
                    Key=s3_key,
                    Body=f.read(),
                    ContentType="image/jpeg"
                )
            
            new_url = f"https://pub-f97b30dd50cc475ca05726d100e35d40.r2.dev/{s3_key}"
            old_url = f"/static/photos/{filename}"
            
            await db.execute(
                text("UPDATE member SET photo_url = :new_url WHERE photo_url = :old_url"),
                {"new_url": new_url, "old_url": old_url}
            )
            count += 1
            
        await db.commit()
        print(f"Migration terminée ! {count} photos uploadées et BDD mise à jour.")

if __name__ == "__main__":
    asyncio.run(main())

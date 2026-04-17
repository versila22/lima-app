import asyncio
import os
import boto3
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from app.config import settings

s3_client = boto3.client(
    's3',
    endpoint_url=settings.S3_ENDPOINT_URL,
    aws_access_key_id=settings.S3_ACCESS_KEY_ID,
    aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
    region_name="auto"
)

async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    photos_dir = "../static/photos"
    
    async with AsyncSession(engine) as db:
        if not os.path.exists(photos_dir):
            print("Dossier photos introuvable, rien à migrer.")
            return

        for filename in os.listdir(photos_dir):
            filepath = os.path.join(photos_dir, filename)
            if not os.path.isfile(filepath):
                continue
                
            s3_key = f"photos/{filename}"
            print(f"Upload de {filename} vers R2...")
            
            with open(filepath, "rb") as f:
                s3_client.put_object(
                    Bucket=settings.S3_BUCKET_NAME,
                    Key=s3_key,
                    Body=f.read(),
                    ContentType="image/jpeg"
                )
            
            new_url = f"{settings.S3_PUBLIC_URL}/{s3_key}"
            old_url = f"/static/photos/{filename}"
            
            await db.execute(
                text("UPDATE member SET photo_url = :new_url WHERE photo_url = :old_url"),
                {"new_url": new_url, "old_url": old_url}
            )
            
        await db.commit()
        print("Migration terminée avec succès !")

if __name__ == "__main__":
    asyncio.run(main())

"""PSDE – System Bootstrap Script"""
import asyncio
import uuid
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.models import User, UserRole
from app.core.security import hash_password
from app.core.config import get_settings

settings = get_settings()

async def create_bootstrap_admin():
    """Create the initial admin user if no admins exist."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.role == UserRole.ADMIN))
        admin = result.scalar_one_or_none()
        
        if not admin:
            print("No admin user found. Creating bootstrap admin...")
            email = settings.bootstrap_admin_email
            password = settings.bootstrap_admin_password
            
            if not password:
                print("BOOTSTRAP_ADMIN_PASSWORD not set. Cannot create admin.")
                return

            new_admin = User(
                id=str(uuid.uuid4()),
                email=email,
                username="admin",
                full_name="System Administrator",
                hashed_password=hash_password(password),
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
            )
            db.add(new_admin)
            await db.commit()
            print(f"Bootstrap admin created: {email}")
        else:
            print("Admin user already exists. Skipping bootstrap.")

if __name__ == "__main__":
    asyncio.run(create_bootstrap_admin())

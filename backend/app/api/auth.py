"""PSDE – Auth API Routes"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import (
    create_access_token, create_refresh_token, hash_password,
    validate_password_strength, verify_password,
)
from app.models.models import AuditEventType, User, UserRole
from app.schemas.schemas import (
    LoginRequest, PasswordChangeRequest, TokenResponse, UserCreate, UserOut,
)
from app.services.audit.audit_service import record_event
from app.core.config import get_settings

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()


@router.post("/register", response_model=UserOut, status_code=201)
async def register_user(
    user_data: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register a new user. Only ADMINs can create accounts."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only administrators can create user accounts.")

    # Check uniqueness
    email_result = await db.execute(select(User).where(User.email == user_data.email))
    if email_result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered.")

    username_result = await db.execute(select(User).where(User.username == user_data.username))
    if username_result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username already taken.")

    # Validate password
    errors = validate_password_strength(user_data.password)
    if errors:
        raise HTTPException(status_code=422, detail={"password_errors": errors})

    user = User(
        id=str(uuid.uuid4()),
        email=user_data.email,
        username=user_data.username,
        full_name=user_data.full_name,
        hashed_password=hash_password(user_data.password),
        role=user_data.role,
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    await db.flush()

    await record_event(
        db=db,
        event_type=AuditEventType.USER_CREATED,
        actor_id=current_user.id,
        actor_label=current_user.username,
        details={"new_user": user.username, "role": user.role},
        ip_address=request.client.host if request.client else None,
    )
    return UserOut.model_validate(user)


@router.post("/signup", response_model=UserOut, status_code=201)
async def self_register(
    user_data: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Public self-registration. Anyone can create a non-ADMIN account."""
    # Prevent self-assigning ADMIN role
    if user_data.role == UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Cannot self-assign the ADMIN role.")

    # Check uniqueness
    email_result = await db.execute(select(User).where(User.email == user_data.email))
    if email_result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered.")

    username_result = await db.execute(select(User).where(User.username == user_data.username))
    if username_result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username already taken.")

    # Validate password strength
    errors = validate_password_strength(user_data.password)
    if errors:
        raise HTTPException(status_code=422, detail={"password_errors": errors})

    user = User(
        id=str(uuid.uuid4()),
        email=user_data.email,
        username=user_data.username,
        full_name=user_data.full_name,
        hashed_password=hash_password(user_data.password),
        role=user_data.role,
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    await db.flush()

    await record_event(
        db=db,
        event_type=AuditEventType.USER_CREATED,
        actor_id=user.id,
        actor_label=user.username,
        details={"self_registered": True, "role": user.role},
        ip_address=request.client.host if request.client else None,
    )
    return UserOut.model_validate(user)


@router.post("/login", response_model=TokenResponse)
async def login(
    credentials: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate with username + password. Returns JWT tokens."""
    result = await db.execute(select(User).where(User.username == credentials.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled.")

    # Update last login
    user.last_login = datetime.now(timezone.utc)

    access_token = create_access_token(subject=user.id, role=user.role)
    refresh_token = create_refresh_token(subject=user.id)

    await record_event(
        db=db,
        event_type=AuditEventType.USER_LOGIN,
        actor_id=user.id,
        actor_label=user.username,
        details={"role": user.role},
        ip_address=request.client.host if request.client else None,
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.jwt_access_token_expire_minutes * 60,
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user profile."""
    return UserOut.model_validate(current_user)


@router.post("/change-password", status_code=200)
async def change_password(
    data: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change the current user's password."""
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Current password is incorrect.")
    errors = validate_password_strength(data.new_password)
    if errors:
        raise HTTPException(status_code=422, detail={"password_errors": errors})
    current_user.hashed_password = hash_password(data.new_password)
    return {"success": True, "message": "Password updated successfully."}


@router.get("/users", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all users. Admin only."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required.")
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return [UserOut.model_validate(u) for u in result.scalars().all()]

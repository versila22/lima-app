const fs = require('fs');
const path = '/data/.openclaw/workspace/lima-app/backend/app/routers/members.py';
let content = fs.readFileSync(path, 'utf8');

const oldDef = `@router.post("/{member_id}/photo", status_code=status.HTTP_200_OK)
async def upload_member_photo(
    member_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    """Upload a profile photo for a member. Admin only. Stores in /static/photos/."""`;

const newDef = `@router.post("/{member_id}/photo", status_code=status.HTTP_200_OK)
async def upload_member_photo(
    member_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: Member = Depends(get_current_user),
):
    """Upload a profile photo for a member. Admin or self. Stores in /static/photos/."""
    if not current_user.is_admin and current_user.id != member_id:
        raise HTTPException(status_code=403, detail="Accès réservé à votre profil")`;

content = content.replace(oldDef, newDef);
fs.writeFileSync(path, content);

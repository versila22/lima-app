# Sprint 2 — JWT httpOnly + Intercepteur 401 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Déplacer le JWT de `localStorage` vers des cookies `httpOnly; Secure; SameSite=Lax`, ajouter un refresh token, et gérer les sessions expirées avec un intercepteur 401.

**Architecture:** Le backend pose deux cookies au login (`access_token` + `refresh_token`). Le frontend envoie `credentials: "include"` sur tous les fetch — le browser gère les cookies automatiquement. Un intercepteur 401 dans `api.ts` tente silencieusement le refresh avant de déclencher la déconnexion. `AuthContext` ne gère plus d'état token.

**Tech Stack:** FastAPI (python-jose, pydantic-settings), React 18 + TypeScript, fetch API.

---

## File Map

| Fichier | Action |
|---------|--------|
| `backend/app/config.py` | Ajouter `REFRESH_JWT_SECRET` |
| `backend/app/utils/security.py` | Ajouter `create_refresh_token`, `decode_refresh_token`, helpers cookies |
| `backend/app/utils/deps.py` | `get_current_user` lit cookie OU header Authorization |
| `backend/app/routers/auth.py` | `login` pose cookies ; nouveaux endpoints `refresh` et `logout` |
| `backend/app/schemas/auth.py` | Ajouter `RefreshResponse` |
| `src/lib/api.ts` | Supprimer helpers token, ajouter `credentials: "include"`, intercepteur 401 |
| `src/contexts/AuthContext.tsx` | Supprimer état token, `logout` appelle API, écoute `auth:logout` |
| `src/App.tsx` | Écouter `auth:logout` → redirect `/login` avec toast |

---

## Task 1 : Ajouter `REFRESH_JWT_SECRET` dans `backend/app/config.py`

**Files:**
- Modify: `backend/app/config.py`

- [ ] **Step 1 : Lire le fichier**

```bash
cat C:/WorkspaceVSCode/lima-app/backend/app/config.py
```

- [ ] **Step 2 : Ajouter `REFRESH_JWT_SECRET` après `JWT_ALGORITHM`**

Ajouter dans la classe `Settings`, juste après `REFRESH_TOKEN_EXPIRE_DAYS`:
```python
    # Refresh token — use a different secret to allow independent rotation
    REFRESH_JWT_SECRET: str = DEFAULT_JWT_SECRET
```

Et mettre à jour le `model_validator` pour vérifier aussi le refresh secret :
```python
    @model_validator(mode="after")
    def validate_jwt_secret(self) -> "Settings":
        if self.APP_ENV != "development":
            if self.JWT_SECRET == DEFAULT_JWT_SECRET:
                raise ValueError(
                    "JWT_SECRET uses the insecure default value. "
                    "Set JWT_SECRET in the environment before starting in non-development mode."
                )
            if self.REFRESH_JWT_SECRET == DEFAULT_JWT_SECRET:
                raise ValueError(
                    "REFRESH_JWT_SECRET uses the insecure default value. "
                    "Set REFRESH_JWT_SECRET in the environment before starting in non-development mode."
                )
        return self
```

- [ ] **Step 3 : Vérifier syntaxe**

```bash
cd C:/WorkspaceVSCode/lima-app/backend
python -c "import ast; ast.parse(open('app/config.py').read()); print('OK')"
```

- [ ] **Step 4 : Commit**

```bash
cd C:/WorkspaceVSCode/lima-app
git add backend/app/config.py
git commit -m "feat(auth): add REFRESH_JWT_SECRET config field"
```

---

## Task 2 : Ajouter utilitaires refresh token et cookies dans `backend/app/utils/security.py`

**Files:**
- Modify: `backend/app/utils/security.py`

- [ ] **Step 1 : Lire le fichier actuel**

```bash
cat C:/WorkspaceVSCode/lima-app/backend/app/utils/security.py
```

- [ ] **Step 2 : Ajouter les nouvelles fonctions à la fin du fichier**

```python
def create_refresh_token(subject: str) -> str:
    """Create a signed JWT refresh token with long expiry."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload: Dict[str, Any] = {
        "sub": subject,
        "iat": now,
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(payload, settings.REFRESH_JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_refresh_token(token: str) -> Dict[str, Any]:
    """
    Decode and validate a refresh token.

    Raises:
        JWTError: If the token is invalid, expired, or not a refresh token.
    """
    payload = jwt.decode(
        token,
        settings.REFRESH_JWT_SECRET,
        algorithms=[settings.JWT_ALGORITHM],
    )
    if payload.get("type") != "refresh":
        from jose import JWTError
        raise JWTError("Not a refresh token")
    return payload


def set_auth_cookies(response, access_token: str, refresh_token: str, secure: bool) -> None:
    """Set httpOnly auth cookies on a FastAPI Response object."""
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/auth/refresh",
    )


def clear_auth_cookies(response, secure: bool) -> None:
    """Expire auth cookies."""
    response.delete_cookie(key="access_token", path="/", secure=secure, httponly=True, samesite="lax")
    response.delete_cookie(key="refresh_token", path="/auth/refresh", secure=secure, httponly=True, samesite="lax")
```

- [ ] **Step 3 : Vérifier syntaxe**

```bash
cd C:/WorkspaceVSCode/lima-app/backend
python -c "import ast; ast.parse(open('app/utils/security.py').read()); print('OK')"
```

- [ ] **Step 4 : Commit**

```bash
cd C:/WorkspaceVSCode/lima-app
git add backend/app/utils/security.py
git commit -m "feat(auth): add refresh token creation/decoding and cookie helpers"
```

---

## Task 3 : Mettre à jour `get_current_user` dans `backend/app/utils/deps.py`

**Files:**
- Modify: `backend/app/utils/deps.py`

**Objectif :** lire le token depuis le cookie `access_token` OU depuis le header `Authorization: Bearer` (rétrocompatibilité).

- [ ] **Step 1 : Lire le fichier actuel**

```bash
cat C:/WorkspaceVSCode/lima-app/backend/app/utils/deps.py
```

- [ ] **Step 2 : Remplacer le contenu complet du fichier**

```python
"""FastAPI dependencies: current user, admin guard."""

from typing import Optional
from uuid import UUID

from fastapi import Cookie, Depends, HTTPException, Request, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.member import Member
from app.utils.security import decode_access_token


async def get_current_user(
    request: Request,
    access_token: Optional[str] = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> Member:
    """
    Decode the JWT and return the authenticated Member.

    Reads from the httpOnly 'access_token' cookie first, then falls back to
    the Authorization: Bearer header for backward compatibility.

    Raises 401 if the token is missing, invalid, or the user is inactive.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentification requise",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # 1. Try cookie
    token = access_token

    # 2. Fall back to Authorization header
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[len("Bearer "):]

    if not token:
        raise credentials_exception

    try:
        payload = decode_access_token(token)
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(
        select(Member)
        .options(selectinload(Member.member_seasons))
        .where(Member.id == UUID(user_id))
    )
    member = result.scalar_one_or_none()

    if member is None:
        raise credentials_exception
    if not member.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte désactivé",
        )
    return member


async def require_admin(
    current_user: Member = Depends(get_current_user),
) -> Member:
    """
    Require the current user to have the 'admin' role.

    Raises 403 if not admin.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs",
        )
    return current_user
```

- [ ] **Step 3 : Vérifier syntaxe**

```bash
cd C:/WorkspaceVSCode/lima-app/backend
python -c "import ast; ast.parse(open('app/utils/deps.py').read()); print('OK')"
```

- [ ] **Step 4 : Commit**

```bash
cd C:/WorkspaceVSCode/lima-app
git add backend/app/utils/deps.py
git commit -m "feat(auth): get_current_user reads httpOnly cookie with Bearer header fallback"
```

---

## Task 4 : Mettre à jour `backend/app/schemas/auth.py` — ajouter `RefreshResponse`

**Files:**
- Modify: `backend/app/schemas/auth.py`

- [ ] **Step 1 : Ajouter `RefreshResponse` à la fin du fichier**

```python
class RefreshResponse(BaseModel):
    """Returned by POST /auth/refresh — confirms token rotation."""
    detail: str = "Token refreshed"
```

- [ ] **Step 2 : Commit**

```bash
cd C:/WorkspaceVSCode/lima-app
git add backend/app/schemas/auth.py
git commit -m "feat(auth): add RefreshResponse schema"
```

---

## Task 5 : Mettre à jour `backend/app/routers/auth.py` — cookies + refresh + logout

**Files:**
- Modify: `backend/app/routers/auth.py`

- [ ] **Step 1 : Mettre à jour les imports**

Ajouter en haut du fichier, dans les imports FastAPI :
```python
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
```

Ajouter dans les imports locaux :
```python
from app.schemas.auth import (
    ActivateAccountRequest,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshResponse,
    ResetPasswordRequest,
    TokenResponse,
)
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    set_auth_cookies,
    clear_auth_cookies,
    verify_password,
)
```

- [ ] **Step 2 : Modifier l'endpoint `login` pour poser les cookies**

Remplacer la fonction `login` entière :

```python
@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(
    request: Request,
    response: Response,
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticate with email and password.

    Sets httpOnly access_token and refresh_token cookies.
    Also returns the access token in the response body for backward compatibility.
    """
    member = await auth_service.authenticate_member(db, data.email, data.password)
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not member.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte désactivé",
        )

    access_token = create_access_token(
        subject=str(member.id),
        extra_claims={"role": member.app_role},
    )
    refresh_token = create_refresh_token(subject=str(member.id))
    secure = settings.APP_ENV != "development"
    set_auth_cookies(response, access_token, refresh_token, secure=secure)

    return TokenResponse(
        access_token=access_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
```

- [ ] **Step 3 : Ajouter l'endpoint `POST /auth/refresh`**

Ajouter après l'endpoint `login` :

```python
@router.post("/refresh", response_model=RefreshResponse)
async def refresh_token(
    response: Response,
    refresh_token: Optional[str] = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
):
    """
    Issue a new access token using the refresh token cookie.

    Rotates both cookies on success.
    """
    from typing import Optional
    from jose import JWTError

    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token manquant",
        )
    try:
        payload = decode_refresh_token(refresh_token)
        user_id: str = payload["sub"]
    except (JWTError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token invalide ou expiré",
        )

    result = await db.execute(select(Member).where(Member.id == UUID(user_id)))
    member = result.scalar_one_or_none()
    if member is None or not member.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilisateur introuvable ou inactif",
        )

    new_access = create_access_token(
        subject=str(member.id),
        extra_claims={"role": member.app_role},
    )
    new_refresh = create_refresh_token(subject=str(member.id))
    secure = settings.APP_ENV != "development"
    set_auth_cookies(response, new_access, new_refresh, secure=secure)

    return RefreshResponse()
```

- [ ] **Step 4 : Ajouter l'endpoint `POST /auth/logout`**

Ajouter après l'endpoint `refresh` :

```python
@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(response: Response):
    """Clear auth cookies and end the session."""
    secure = settings.APP_ENV != "development"
    clear_auth_cookies(response, secure=secure)
    return {"detail": "Déconnecté avec succès"}
```

- [ ] **Step 5 : Ajouter les imports manquants en haut du fichier**

S'assurer que `Optional` et `UUID` sont importés (ils l'étaient déjà, vérifier).

- [ ] **Step 6 : Vérifier syntaxe**

```bash
cd C:/WorkspaceVSCode/lima-app/backend
python -c "import ast; ast.parse(open('app/routers/auth.py').read()); print('OK')"
```

- [ ] **Step 7 : Commit**

```bash
cd C:/WorkspaceVSCode/lima-app
git add backend/app/routers/auth.py
git commit -m "feat(auth): login sets httpOnly cookies, add /refresh and /logout endpoints"
```

---

## Task 6 : Mettre à jour `src/lib/api.ts` — credentials + intercepteur 401

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1 : Lire les lignes 1-120 du fichier**

```bash
head -120 C:/WorkspaceVSCode/lima-app/src/lib/api.ts
```

- [ ] **Step 2 : Supprimer les helpers token et le TOKEN_KEY**

Remplacer les lignes 21-34 (TOKEN_KEY + getToken/setToken/removeToken) :

```ts
// Token management moved to httpOnly cookies — no client-side token storage.
// A 401 interceptor in request() handles silent refresh via POST /auth/refresh.
let _isRefreshing = false;
let _refreshQueue: Array<() => void> = [];
```

- [ ] **Step 3 : Mettre à jour la fonction `request<T>`**

Remplacer le corps de `request<T>` pour :
1. Supprimer la lecture du token et le header `Authorization`
2. Ajouter `credentials: "include"` sur tous les fetch
3. Ajouter l'intercepteur 401 (refresh silencieux + retry)

```ts
async function request<T>(
  method: string,
  path: string,
  { body, params, headers: extraHeaders, ...rest }: RequestOptions = {}
): Promise<T> {
  return _doRequest<T>(method, path, { body, params, headers: extraHeaders, ...rest }, false);
}

async function _doRequest<T>(
  method: string,
  path: string,
  { body, params, headers: extraHeaders, ...rest }: RequestOptions,
  isRetry: boolean
): Promise<T> {
  const fullUrl = API_BASE_URL ? `${API_BASE_URL}${path}` : path;
  const url = new URL(fullUrl);

  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, String(v));
      }
    });
  }

  const headers: Record<string, string> = {
    ...(extraHeaders as Record<string, string>),
  };

  let bodyInit: BodyInit | undefined;
  if (body instanceof FormData) {
    bodyInit = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    bodyInit = JSON.stringify(body);
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: bodyInit,
    credentials: "include",
    ...rest,
  });

  if (response.status === 401 && !isRetry) {
    // Attempt silent refresh
    const refreshed = await _tryRefresh();
    if (refreshed) {
      return _doRequest<T>(method, path, { body, params, headers: extraHeaders, ...rest }, true);
    }
    // Refresh failed — broadcast logout
    window.dispatchEvent(new CustomEvent("auth:logout"));
    throw new ApiError(401, "Session expirée");
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const err = await response.json();
      detail = err?.detail ?? detail;
    } catch {
      // ignore JSON parse errors
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

async function _tryRefresh(): Promise<boolean> {
  if (_isRefreshing) {
    // Queue concurrent requests waiting for the refresh
    return new Promise((resolve) => {
      _refreshQueue.push(() => resolve(true));
    });
  }
  _isRefreshing = true;
  try {
    await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    _refreshQueue.forEach((cb) => cb());
    _refreshQueue = [];
    return true;
  } catch {
    _refreshQueue = [];
    return false;
  } finally {
    _isRefreshing = false;
  }
}
```

- [ ] **Step 4 : Supprimer les exports de `getToken`, `setToken`, `removeToken`**

Ces fonctions n'existent plus. S'assurer qu'elles ne sont plus exportées.

- [ ] **Step 5 : Vérifier TypeScript**

```bash
cd C:/WorkspaceVSCode/lima-app
npx tsc --noEmit 2>&1 | head -30
```

Attendu : erreurs uniquement sur les imports de `getToken`/`setToken`/`removeToken` dans `AuthContext.tsx` — normal, on les corrige dans Task 7.

- [ ] **Step 6 : Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(auth): replace localStorage token with cookie-based auth + 401 interceptor"
```

---

## Task 7 : Mettre à jour `src/contexts/AuthContext.tsx`

**Files:**
- Modify: `src/contexts/AuthContext.tsx`

- [ ] **Step 1 : Lire le fichier actuel**

```bash
cat C:/WorkspaceVSCode/lima-app/src/contexts/AuthContext.tsx
```

- [ ] **Step 2 : Remplacer le contenu complet du fichier**

```tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api, ApiError } from "@/lib/api";
import type {
  ActivateAccountRequest,
  ApiMessage,
  MemberRead,
  ResetPasswordRequest,
} from "@/types";

// ============================================================
// Context shape
// ============================================================
interface AuthContextValue {
  user: MemberRead | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  activateAccount: (payload: ActivateAccountRequest) => Promise<ApiMessage>;
  forgotPassword: (email: string) => Promise<ApiMessage>;
  resetPassword: (payload: ResetPasswordRequest) => Promise<ApiMessage>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ============================================================
// Provider
// ============================================================
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MemberRead | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const me = await api.get<MemberRead>("/auth/me");
      setUser(me);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-load on mount
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Listen for global logout event (dispatched by 401 interceptor)
  useEffect(() => {
    const handler = () => {
      setUser(null);
      setIsLoading(false);
    };
    window.addEventListener("auth:logout", handler);
    return () => window.removeEventListener("auth:logout", handler);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // POST /auth/login sets httpOnly cookies; we discard the body token
    await api.post("/auth/login", { email, password });
    const me = await api.get<MemberRead>("/auth/me");
    setUser(me);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Best-effort
    }
    setUser(null);
  }, []);

  const activateAccount = useCallback((payload: ActivateAccountRequest) => {
    return api.post<ApiMessage>("/auth/activate", payload);
  }, []);

  const forgotPassword = useCallback((email: string) => {
    return api.post<ApiMessage>("/auth/forgot-password", { email });
  }, []);

  const resetPassword = useCallback((payload: ResetPasswordRequest) => {
    return api.post<ApiMessage>("/auth/reset-password", payload);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        activateAccount,
        forgotPassword,
        resetPassword,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================
// Hook
// ============================================================
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
```

- [ ] **Step 3 : Vérifier TypeScript**

```bash
cd C:/WorkspaceVSCode/lima-app
npx tsc --noEmit 2>&1 | head -30
```

Corriger les erreurs restantes (probablement `token` utilisé ailleurs via `useAuth().token`). Chercher :

```bash
grep -rn "\.token\b\|useAuth.*token\|getToken\|setToken\|removeToken" C:/WorkspaceVSCode/lima-app/src --include="*.tsx" --include="*.ts" | grep -v "node_modules\|\.git"
```

Si des composants utilisent encore `token` depuis `useAuth()`, les corriger : le token n'est plus exposé — ils doivent utiliser `isAuthenticated` ou `user` à la place.

- [ ] **Step 4 : Commit**

```bash
git add src/contexts/AuthContext.tsx src/
git commit -m "feat(auth): AuthContext uses cookies — remove token state, logout calls API"
```

---

## Task 8 : Mettre à jour `src/App.tsx` — écouter `auth:logout`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1 : Lire le fichier**

```bash
cat C:/WorkspaceVSCode/lima-app/src/App.tsx
```

- [ ] **Step 2 : Ajouter le listener `auth:logout` dans le composant root**

Dans le composant `App` (ou dans un composant enfant qui a accès à `useNavigate`), ajouter un listener qui redirige vers `/login` avec un toast.

Trouver le composant principal qui wrap les routes. Ajouter un `useEffect` dans le composant `ProtectedRoute` ou dans un nouveau composant `AuthLogoutHandler` placé à l'intérieur du `BrowserRouter` :

Ajouter après les imports existants :
```ts
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
```

Ajouter un nouveau composant avant `App` :
```tsx
function AuthLogoutHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => {
      toast.error("Session expirée, veuillez vous reconnecter.");
      navigate("/login", { replace: true });
    };
    window.addEventListener("auth:logout", handler);
    return () => window.removeEventListener("auth:logout", handler);
  }, [navigate]);

  return null;
}
```

Placer `<AuthLogoutHandler />` à l'intérieur du `<BrowserRouter>`, juste avant les `<Routes>` :
```tsx
<BrowserRouter>
  <AuthProvider>
    <AuthLogoutHandler />
    {/* rest of the tree */}
  </AuthProvider>
</BrowserRouter>
```

- [ ] **Step 3 : Vérifier TypeScript**

```bash
cd C:/WorkspaceVSCode/lima-app
npx tsc --noEmit 2>&1 | head -20
```
Attendu : aucune erreur.

- [ ] **Step 4 : Commit**

```bash
git add src/App.tsx
git commit -m "feat(auth): redirect to login with toast on auth:logout event"
```

---

## Task 9 : Vérification finale

- [ ] **Step 1 : Build frontend complet**

```bash
cd C:/WorkspaceVSCode/lima-app
npm run build 2>&1 | tail -15
```
Attendu : build sans erreur.

- [ ] **Step 2 : Vérifier les tests backend**

```bash
cd C:/WorkspaceVSCode/lima-app/backend
pytest tests/ -v --tb=short 2>&1 | tail -20
```
Attendu : tous les tests passent.

- [ ] **Step 3 : Vérifier le git log**

```bash
cd C:/WorkspaceVSCode/lima-app
git log --oneline -10
```
Attendu : 8 commits Sprint 2 visibles.

---

## Checklist self-review

- [x] Rétrocompatibilité : `get_current_user` accepte cookie ET header Authorization
- [x] Le token body est toujours retourné par `/auth/login` (peut être utilisé par des clients API tiers)
- [x] Le refresh token est scopé sur `path="/auth/refresh"` — le browser ne l'envoie pas à d'autres endpoints
- [x] `_isRefreshing` évite les boucles infinies de refresh concurrent
- [x] `auth:logout` est écouté dans `AuthContext` (state) ET `App.tsx` (navigation)
- [x] Pas de migration DB nécessaire

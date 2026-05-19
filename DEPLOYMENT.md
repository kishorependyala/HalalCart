# HalalCart — Social Login Plan

## Strategy: Auth0 (zero user management)
Auth0 handles all OAuth — enable new providers from dashboard with no code changes.
Free tier: 7,500 monthly active users.

## Providers
| Provider | Audience | Auth0 connection name |
|---|---|---|
| 🔵 Google | Universal | google-oauth2 |
| 🍎 Apple | iOS users | apple |
| 📘 Facebook | Instagram / WhatsApp users | facebook |
| 🎮 Discord | Gamers, college students, youth | discord |
| 🐦 Twitter / X | Trending crowd | twitter |
| 👻 Snapchat | Teens & young adults | snap |
| 🎮 Xbox / Microsoft | Console gamers | windowslive |

Phone login kept as fallback. Admin still detectable by phone OR email.

---

## Steps

### Step 1 — Write plan ✅ DONE

### Step 2 — Install Auth0 SDK & configure ✅ DONE
- Installed `@auth0/auth0-react`
- `index.tsx` wrapped in `Auth0Provider` using `REACT_APP_AUTH0_DOMAIN` + `REACT_APP_AUTH0_CLIENT_ID`

### Step 3 — Update LoginModal with social buttons ✅ DONE
- 7 branded social buttons with correct colors/icons
- Phone form hidden behind "Continue with Phone Number" toggle
- Social login calls `loginWithPopup({ authorizationParams: { connection } })`

### Step 4 — Update App.tsx + User type ✅ DONE
- `useAuth0()` syncs Auth0 user → our User state via `useEffect`
- User type extended: `email`, `picture`, `authMethod` fields added
- Social avatar shown in header
- Logout calls `auth0Logout` for social users

### Step 5 — Update backend for email-based admin ✅ DONE
- `ADMIN_EMAIL = os.getenv('ADMIN_EMAIL', '')` in `data.py`
- `_is_admin()` checks `X-Admin-Email` header when ADMIN_EMAIL is set
- `/login` accepts + returns `email` field

### Step 6 — Update GitHub workflow ✅ DONE
- `deploy-frontend.yml` passes `REACT_APP_AUTH0_DOMAIN`, `REACT_APP_AUTH0_CLIENT_ID`, `REACT_APP_ADMIN_EMAIL` as env vars to SWA build
- These come from GitHub secrets (to be added — see Step 7)

### Step 7 — One-time Auth0 setup (YOU DO THIS) ⬜ ACTION NEEDED
See instructions below ↓

### Step 8 — Deploy & verify ⬜ PENDING (auto-triggers after secrets are added)

---

## ⚡ Auth0 Setup Instructions (one-time, ~15 min)

### A. Create Auth0 account + tenant
1. Go to https://auth0.com → Sign up free
2. Create a tenant (e.g. `halalcart`)

### B. Create a Single Page Application
1. Applications → Create Application → "Single Page Web Applications"
2. Name it "HalalCart"
3. In Settings, set:
   - **Allowed Callback URLs**: `http://localhost:3000, https://ashy-sky-04731fd0f.7.azurestaticapps.net`
   - **Allowed Logout URLs**: `http://localhost:3000, https://ashy-sky-04731fd0f.7.azurestaticapps.net`
   - **Allowed Web Origins**: `http://localhost:3000, https://ashy-sky-04731fd0f.7.azurestaticapps.net`
4. Save Changes
5. Copy **Domain** and **Client ID** — you'll need these

### C. Enable Social Connections
Go to Authentication → Social and enable each:
| Provider | What you need |
|---|---|
| Google | Google Cloud Console → OAuth Client ID (free) |
| Apple | Apple Developer account ($99/yr) OR use Auth0's dev key |
| Facebook | Meta Developer app → App ID + Secret (free) |
| Discord | Discord Developer Portal → Client ID + Secret (free) |
| Twitter/X | Twitter Developer Portal → API Key + Secret |
| Snapchat | Snap Kit → Client ID + Secret |
| Microsoft | Azure AD app registration → Client ID + Secret |

> **Shortcut**: For testing, Auth0 provides built-in dev keys for Google and a few others — just toggle on and test immediately without your own credentials.

### D. Add GitHub Secrets
Go to https://github.com/kishorependyala/HalalCart/settings/secrets/actions and add:

| Secret Name | Value |
|---|---|
| `REACT_APP_AUTH0_DOMAIN` | e.g. `halalcart.us.auth0.com` |
| `REACT_APP_AUTH0_CLIENT_ID` | from Auth0 app settings |
| `REACT_APP_ADMIN_EMAIL` | your Google/Apple sign-in email (for admin detection) |

### E. Add ADMIN_EMAIL to Azure App Service
```
az webapp config appsettings set \
  --resource-group eu-hack-rg \
  --name halalcart-api \
  --settings ADMIN_EMAIL="your-email@gmail.com"
```

### F. Re-run the frontend workflow
After adding secrets:
- GitHub → Actions → "Deploy Frontend to Azure Static Web Apps" → Run workflow
- OR push any small change to `frontend/` to trigger auto-deploy

---

## Commit: 37f3be3

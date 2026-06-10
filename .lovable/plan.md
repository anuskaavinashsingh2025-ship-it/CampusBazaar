# CampusBazar — System Architecture

A student-only (VIT-verified) campus marketplace for **selling**, **renting**, **notes sharing**, **chat**, **wishlist**, public **seller profiles**, and an **admin moderation** portal. Stack as requested: **MongoDB + Express/Node + React**.

> Note on platform: this Lovable project ships on TanStack Start + Lovable Cloud (Postgres). The document below is the MERN/MongoDB architecture you asked for. If you'd rather I implement on Lovable's native stack, I'll translate collections → Postgres tables 1:1 at build time. Tell me which target before I generate code.

---

## 1. Database Schema (MongoDB)

### Collections overview

`users`, `sellerProfiles`, `products`, `rentals`, `rentalRequests`, `notes`, `conversations`, `messages`, `wishlists`, `reviews`, `reports`, `notifications`, `categories`, `auditLogs`.

### 1.1 users (private)

```
_id
email            // unique, must match @vitstudent.ac.in
authProvider     // "google" | "password"
passwordHash     // null when google
fullName         // set at profile completion
hostelBlock      // set at profile completion
avatarUrl
role             // "user" | "admin"  (guest = no doc / no session)
isProfileComplete// false until fullName + hostelBlock saved
status           // "active" | "suspended" | "banned"
suspendedUntil   // date | null
emailVerified    // bool
lastLoginAt
createdAt, updatedAt
```

### 1.2 sellerProfiles (public) — auto-created on first listing

```
_id
userId           // ref users (1:1, unique)
slug             // e.g. "rohan-sharma-12345" -> /seller/:slug
displayName
bio
avatarUrl
ratingAvg        // denormalized, recomputed on new review
ratingCount
totalSold        // count of products status=sold
totalRentedOut   // count of completed rentals
joinedAt
createdAt, updatedAt
```

### 1.3 products (sell items)

```
_id
sellerId         // ref users
title, description
images[]         // 3–5 URLs
category         // ref/category key
customCategory   // when category = "Others"
condition        // New|Like New|Good|Fair|Used
price
isNegotiable
location         // e.g. "Viman Nagar, Pune"
isUrgent         // urgent sale badge
status           // available | sold | hidden
priceLocked      // true once buyer engagement begins
engagementCount  // chats/interest; triggers priceLocked
soldAt
createdAt, updatedAt
// indexes: text(title,description), category, status, isUrgent, sellerId, price
```

### 1.4 rentals (separate from products)

```
_id
ownerId          // ref users
title, description, images[]
category, customCategory
condition
rentPricePerDay
location
status           // available | rented_out | unavailable
currentRenterId  // ref users | null
timesRented      // counter for reputation
createdAt, updatedAt
// indexes: text, category, status, ownerId, rentPricePerDay
```

### 1.5 rentalRequests

```
_id
rentalId         // ref rentals
renterId         // ref users (requester)
ownerId          // ref users
status           // pending | accepted | rejected | returned | completed
requestedFrom, requestedTo   // optional date range
respondedAt, returnedAt, completedAt
createdAt, updatedAt
```

### 1.6 notes (academic PDFs)

```
_id
uploaderId       // ref users
title, subject, course, semester
description
fileUrl          // PDF
fileSizeKb
downloadCount
createdAt, updatedAt
// indexes: text(title,subject), subject, course
```

### 1.7 conversations

```
_id
participants[]   // [userId, userId]
contextType      // "product" | "rental" | "general"
contextId        // productId/rentalId | null
lastMessage, lastMessageAt
unread { userId: count }
createdAt
// index: participants, lastMessageAt
```

### 1.8 messages

```
_id
conversationId
senderId
text
attachments[]
readBy[]
createdAt
```

### 1.9 wishlists

```
_id
userId
itemType         // "product" | "rental"
itemId
createdAt
// unique compound: (userId, itemType, itemId)
```

### 1.10 reviews (seller reputation)

```
_id
sellerId         // ref users (the seller being reviewed)
reviewerId       // ref users
rating           // 1–5
comment
contextType      // product | rental
contextId
createdAt
// unique: (reviewerId, contextId) to prevent duplicates
```

### 1.11 reports (moderation)

```
_id
reporterId
targetType       // "product" | "rental" | "seller" | "note"
targetId
reason           // scam | spam | fake | offensive | suspicious | other
description
status           // pending | resolved | dismissed
resolvedBy, resolutionNote, resolvedAt
createdAt
// index: status, targetType, targetId
```

### 1.12 notifications

```
_id
userId
type             // rental_request | request_accepted | returned | new_message | review | admin_action ...
title, body
link
isRead
createdAt
```

### 1.13 categories

```
_id, key, label, type ("sell"|"rent"|"both"), icon, isCustom, usageCount
```

### 1.14 auditLogs (admin actions)

```
_id, actorId, action, targetType, targetId, meta, createdAt
```

### Relationships (summary)

```
users 1───1 sellerProfiles
users 1───* products / rentals / notes
rentals 1──* rentalRequests
users *──* conversations ──* messages
users 1──* wishlists / reviews(given) / reports / notifications
sellerProfiles 1──* reviews(received)  -> ratingAvg denormalized
```

---

## 2. API Endpoints (REST, Express)

Base: `/api/v1`. Auth header: `Authorization: Bearer <jwt>`.

### Auth

```
POST /auth/google              // Google OAuth, enforce @vitstudent.ac.in
POST /auth/signup              // email+pwd (VIT domain only)
POST /auth/login
POST /auth/logout
POST /auth/forgot-password
POST /auth/reset-password
GET  /auth/me                  // current user + flags
POST /auth/complete-profile    // fullName + hostelBlock -> isProfileComplete=true
```

### Products (sell)

```
GET    /products                       // list + filters (category, price, condition, availability, urgent, recent, search)
GET    /products/:id
POST   /products                       // [verified] creates sellerProfile if first listing
PATCH  /products/:id                   // [owner] price editable only if !priceLocked
DELETE /products/:id                   // [owner] blocked if active order/report
PATCH  /products/:id/status            // available|sold|hidden
PATCH  /products/:id/urgent
```

### Rentals

```
GET    /rentals                        // list + filters
GET    /rentals/:id
POST   /rentals                        // [verified]
PATCH  /rentals/:id                    // [owner]
DELETE /rentals/:id                    // [owner]
PATCH  /rentals/:id/status             // available|rented_out|unavailable
POST   /rentals/:id/requests           // [verified renter] send request
GET    /rentals/:id/requests           // [owner]
PATCH  /rental-requests/:id            // [owner] accept|reject
PATCH  /rental-requests/:id/return     // [renter] mark returned
```

### Notes

```
GET    /notes                          // filter by subject/course/search
GET    /notes/:id
POST   /notes                          // [verified] upload PDF
GET    /notes/:id/download             // increments downloadCount
DELETE /notes/:id                      // [owner]
```

### Sellers (public)

```
GET /sellers/:slug                     // public profile + listings + reviews + stats
GET /sellers/:slug/reviews
POST /sellers/:slug/reviews            // [verified, had interaction]
GET /search?q=                         // products + categories + seller names
```

### Chat

```
GET  /conversations                    // [verified] my inbox
POST /conversations                    // start (product/rental/general)
GET  /conversations/:id/messages
POST /conversations/:id/messages
PATCH /conversations/:id/read
```

### Wishlist

```
GET    /wishlist
POST   /wishlist                       // {itemType,itemId}
DELETE /wishlist/:itemType/:itemId
```

### Dashboard / User

```
GET /me/listings                       // products + rentals grouped
GET /me/orders                         // purchases + rental requests
GET /me/notifications
PATCH /me/notifications/:id/read
PATCH /me/settings
```

### Reports

```
POST /reports                          // [verified] report product/seller/rental/note
```

### Admin (role=admin only)

```
GET    /admin/stats                    // users, products, pending reports, banned, suspicious
GET    /admin/reports?status=
PATCH  /admin/reports/:id              // resolve|dismiss
GET    /admin/users
PATCH  /admin/users/:id/suspend
PATCH  /admin/users/:id/ban
DELETE /admin/products/:id
DELETE /admin/rentals/:id
GET    /admin/suspicious               // heuristics feed
```

---

## 3. Authentication Architecture

- **Identity**: Google OAuth (primary) + email/password fallback. Both **hard-gated to `@vitstudent.ac.in`** at the auth controller; non-VIT emails rejected before any account is created.
- **Sessions**: JWT access token (short-lived, ~15 min) + httpOnly refresh-token cookie (rotating). `GET /auth/me` hydrates the client.
- **Profile gate**: after first login `isProfileComplete=false`. A `requireProfile` middleware blocks restricted actions and the frontend redirects to **Complete Profile** (Full Name + Hostel Block only). On save → `isProfileComplete=true` → full access.
- **Password reset**: email link → reset page → `updatePassword`.
- **Account state**: `suspended`/`banned` checked in middleware on every request; banned users get 403 + forced logout.

Middleware chain: `authenticate → checkAccountStatus → requireProfile(optional) → requireRole(optional) → requireOwnership(optional)`.

---

## 4. Role System

| Role              | How obtained                                                                                       | Scope                     |
| ----------------- | -------------------------------------------------------------------------------------------------- | ------------------------- |
| **guest**         | not logged in                                                                                      | read-only public browsing |
| **user**          | VIT login (profile incomplete)                                                                     | login state, limited      |
| **verified user** | `isProfileComplete=true`                                                                           | full marketplace actions  |
| **seller**        | derived: a verified user who has ≥1 listing (auto sellerProfile) — not a stored role, a capability | manage own listings       |
| **admin**         | manual `role:"admin"` in DB for team emails                                                        | full moderation           |

Roles stored on `users.role` only as `user`/`admin`; "guest", "verified", "seller" are **derived states** (session presence, `isProfileComplete`, listing ownership) — not duplicated, preventing privilege-escalation drift.

---

## 5. Permissions Matrix

| Action                       |     Guest     | User (incomplete) |       Verified       |      Owner       | Admin |
| ---------------------------- | :-----------: | :---------------: | :------------------: | :--------------: | :---: |
| View home/browse/search      |      ✅       |        ✅         |          ✅          |        ✅        |  ✅   |
| View notes / seller profiles |      ✅       |        ✅         |          ✅          |        ✅        |  ✅   |
| Complete profile             |      ❌       |        ✅         |          —           |        —         |   —   |
| Sell / Rent listing create   |      ❌       |        ❌         |          ✅          |        ✅        |  ✅   |
| Edit/Delete listing          |      ❌       |        ❌         |          ❌          |     ✅(own)      |  ✅   |
| Edit price (pre-engagement)  |      ❌       |        ❌         |          ❌          | ✅(own,unlocked) |  ✅   |
| Send rental request          |      ❌       |        ❌         |          ✅          |        —         |  ✅   |
| Accept/reject request        |      ❌       |        ❌         |          ❌          |    ✅(owner)     |  ✅   |
| Mark returned                |      ❌       |        ❌         |     renter only      |        —         |  ✅   |
| Chat                         |      ❌       |        ❌         |          ✅          |        ✅        |  ✅   |
| Wishlist                     |      ❌       |        ❌         |          ✅          |        ✅        |  ✅   |
| Upload/Download notes        | view/❌upload |     ❌upload      |          ✅          |        ✅        |  ✅   |
| Leave review                 |      ❌       |        ❌         | ✅(post-interaction) |        —         |  ✅   |
| Report                       |      ❌       |        ❌         |          ✅          |        ✅        |  ✅   |
| Access /admin                |      ❌       |        ❌         |          ❌          |        ❌        |  ✅   |
| Ban/suspend, remove content  |      ❌       |        ❌         |          ❌          |        ❌        |  ✅   |

All write rules re-verified server-side (`sellerId === user.id`, `role === "admin"`).

---

## 6. Backend Folder Structure

```
server/
├── src/
│   ├── config/            // env, db, oauth, storage
│   ├── models/            // mongoose schemas (one per collection)
│   ├── controllers/       // auth, product, rental, note, chat, wishlist, seller, report, admin
│   ├── services/          // business logic (reputation, suspicious-activity, notifications, search)
│   ├── routes/            // /api/v1 routers
│   ├── middleware/        // authenticate, checkAccountStatus, requireProfile, requireRole, requireOwnership, validate, errorHandler, rateLimit
│   ├── validators/        // zod/joi schemas per endpoint
│   ├── utils/             // jwt, slug, mailer, fileUpload
│   ├── jobs/              // cron: suspicious detection, cleanup
│   └── app.ts / server.ts
├── tests/
└── package.json
```

---

## 7. Frontend Folder Structure

```
client/src/
├── app/                   // router, providers
├── pages/
│   ├── Home, Login, CompleteProfile
│   ├── sell/ (Browse, ProductDetails, SellWizard)
│   ├── rent/ (RentBrowse, RentDetails, RentWizard)
│   ├── notes/
│   ├── seller/[slug]
│   ├── dashboard/ (Wishlist, Orders, Chats, Notifications, Settings)
│   ├── chat/
│   └── admin/ (Stats, Reports, Users, Suspicious)
├── components/
│   ├── ui/                // design system (CampusBazar navy #1e2d6b + orange #f47b20)
│   ├── product/ (ProductCard, UrgentBadge, ConditionTag)
│   ├── rental/ (RentalCard, AvailabilityBadge)
│   ├── layout/ (Navbar, BottomNav, Footer, SearchBar)
│   └── shared/
├── features/              // RTK Query / hooks per domain
├── store/                 // global state
├── hooks/, lib/, types/, assets/
```

UI matches uploads: top nav (logo + search + Wishlist/Chats/Profile), mobile bottom nav with central SELL/RENT FAB, multi-step Sell wizard with live preview + tips, rental browse with left filter rail and "How Renting Works" strip.

---

## 8. State Management

- **Server state**: **RTK Query** (or TanStack Query) for all API data — caching, invalidation, optimistic wishlist/urgent toggles.
- **Global client state**: Redux Toolkit slices for `auth` (user, flags), `ui` (modals, search), `chat` (active conversation, socket status).
- **Realtime**: Socket.IO for chat + notifications; falls back to polling.
- **Forms**: React Hook Form + Zod; Sell/Rent wizards keep draft in local state + `Save Draft` to backend.
- **Access gating**: a `useAccess()` hook derives guest/verified/owner/admin from auth slice to drive both UI and route guards.

---

## 9. Deployment Architecture

```
Client (React/Vite)  → Vercel / Netlify (static + CDN)
API (Node/Express)   → Render / Railway / Fly.io (containerized)
Database             → MongoDB Atlas (replica set, backups)
File/Image storage   → Cloudinary or S3 (product images, note PDFs)
Realtime             → Socket.IO on API host (sticky sessions / Redis adapter)
Email                → Resend / SES (verification, reset, notifications)
Secrets              → platform env vars
CI/CD                → GitHub Actions: lint, test, build, deploy
Monitoring           → Sentry (errors) + uptime + Atlas metrics
```

Stable public URLs for OAuth callbacks and webhooks; rate limiting + CORS allow-list on API.

---

## 10. Missing Edge Cases & Improvements

**Gaps in the spec I'll handle:**

1. **Price-lock trigger** — define "engagement" precisely (first chat OR wishlist) and stamp `priceLocked`.
2. **Delete guards** — block delete when active rentalRequest (`pending/accepted`) or open report exists; offer "Hide" instead.
3. **Review eligibility** — only after a completed chat/rental to stop fake reviews; one review per context.
4. **Rating recompute** — denormalized `ratingAvg/ratingCount` updated transactionally on review create.
5. **Rental concurrency** — prevent double-accept; only one active renter; auto-expire stale `pending` requests.
6. **Seller slug** — collision-safe slug + numeric suffix; immutable after creation.
7. **Suspicious-activity engine** — thresholds (reports/24h, duplicate listings, message spam) feeding `/admin/suspicious`.
8. **Notes integrity** — PDF-only, size cap, virus/type validation, abuse reporting.
9. **Image upload** — 3–5 enforced, type/size limits, signed uploads, EXIF strip.
10. **Banned/suspended UX** — global interceptor logs out and shows reason.
11. **Search ranking** — urgent + recent boosting; unified product/category/seller search.
12. **Notifications** — full event matrix (request lifecycle, messages, reviews, admin actions).
13. **Soft-delete & audit** — admin actions logged to `auditLogs`; content soft-deleted for traceability.
14. **Pagination/rate limits** — cursor pagination on all lists; per-route rate limiting.
15. **Accessibility/SEO** — public seller/product pages get unique meta + OG tags; semantic markup.

---

Approve this and tell me the target stack (MongoDB/Express **or** Lovable native Postgres) and I'll start building.

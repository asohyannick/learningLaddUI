# 🎓 Learning Ladder UI

> The Angular frontend for **Learning Ladder**, a School Management System.
> It talks to the Learning Ladder **Spring Boot REST API** and gives students, tutors, librarians and administrators their own dashboards, pages and workflows.

![Angular](https://img.shields.io/badge/Angular-22.2-DD0031?logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)
![RxJS](https://img.shields.io/badge/RxJS-7.8-B7178C?logo=reactivex&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-13.2-FFCA28?logo=firebase&logoColor=black)
![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF?logo=stripe&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-5.0-6E9F18?logo=vitest&logoColor=white)
![npm](https://img.shields.io/badge/npm-12.0.2-CB3837?logo=npm&logoColor=white)

---

## 📑 Table of Contents

1. [🧭 About the Project](#-about-the-project)
2. [🧰 Tech Stack](#-tech-stack)
3. [🔌 How the UI Talks to the Backend](#-how-the-ui-talks-to-the-backend)
4. [🗂️ Project Structure](#️-project-structure)
5. [🗺️ Feature ↔ API Map](#️-feature--api-map)
6. [🚀 Getting Started](#-getting-started)
7. [🔐 Environment Variables & Secrets](#-environment-variables--secrets)
8. [📜 Available Scripts](#-available-scripts)
9. [🛡️ Client-Side Security](#️-client-side-security)
10. [⚡ Performance Guidelines](#-performance-guidelines)
11. [✍️ Coding Conventions](#️-coding-conventions)
12. [🌿 Git Workflow](#-git-workflow)
13. [🧪 Testing](#-testing)
14. [👋 Onboarding New Developers](#-onboarding-new-developers)
15. [🆘 Troubleshooting](#-troubleshooting)

---

## 🧭 About the Project

Learning Ladder is a full **School Management System**. The backend (Java 25 + Spring Boot 4) is complete. This repository holds the **Angular client**, which is responsible for:

- 🔗 **API integration** with the Learning Ladder REST API
- 🧩 **Reusable UI components**, pipes and directives
- 📊 **Role-based dashboards** for admins, students, tutors and librarians
- 📄 **Pages and workflows** for courses, bookings, library loans, payments, AI assistants and more
- 🛡️ **Client-side security**: authentication, token refresh, route guards and role checks
- ⚡ **Client-side performance**: lazy loading, signals, caching and deferred rendering

| 🌍 Resource | 🔗 Link |
| --- | --- |
| 🖥️ Backend API (production) | `https://learningladder-4xlm.onrender.com` |
| 📘 API docs (Swagger UI) | `https://learningladder-4xlm.onrender.com/swagger-ui/index.html` |
| 📄 OpenAPI spec (JSON) | `https://learningladder-4xlm.onrender.com/v3/api-docs` |
| 🩺 API health check | `https://learningladder-4xlm.onrender.com/actuator/health` |
| 💻 Backend API (local) | `http://localhost:8090` |

---

## 🧰 Tech Stack

### 🅰️ Core framework

| | Technology | What we use it for |
| --- | --- | --- |
| 🅰️ | **Angular 22** | Standalone components, signals, new control flow (`@if`, `@for`, `@defer`) |
| 🟦 | **TypeScript 6** | Strict typing for components, services, DTOs and API responses |
| 🔁 | **RxJS 7.8** | HTTP streams, retry and refresh logic, debounced search |
| 📶 | **Angular Signals** | Local and shared UI state (`signal`, `computed`, `effect`) |

### 🔌 Communicating with the REST API

| | Technology | What we use it for |
| --- | --- | --- |
| 🌐 | **`HttpClient`** (`@angular/common/http`) | All calls to the Spring Boot REST API (`GET`, `POST`, `PATCH`, `PUT`, `DELETE`) |
| 🪝 | **HTTP interceptors** | Attach the JWT, refresh expired tokens, map errors, log requests, show loaders |
| 🧭 | **Angular Router** (`@angular/router`) | Page navigation, lazy-loaded features, route guards, route resolvers |
| 📝 | **Angular Forms** (`@angular/forms`) | Reactive Forms with validation for every create and update screen |
| 🔥 | **Firebase** (`firebase`) | Google sign-in. The Firebase ID token is sent to `POST /api/v1/auth/google` |
| 💳 | **Stripe.js** (`@stripe/stripe-js`) *(to be installed)* | Card payments using the `clientSecret` returned by `POST /api/v1/payment/checkout` |
| 📡 | **Fetch streaming / Server-Sent Events** | Streamed AI assistant replies from `/ai-assist/conversations/{id}/messages/stream` |
| 🔀 | **Dev proxy** (`proxy.conf.json`) | Forwards `/api/**` to the local backend during development, so no CORS issues |

### 🎨 UI and styling

| | Technology | What we use it for |
| --- | --- | --- |
| 🎨 | **CSS / Tailwind CSS** *(recommended)* | Utility-first styling and responsive layouts |
| 🖼️ | **`NgOptimizedImage`** | Optimised images (course thumbnails, logos, avatars) |
| 🔤 | `public/fonts`, `public/icons`, `public/images` | Self-hosted fonts, icons and images |

### 🧪 Quality and tooling

| | Technology | What we use it for |
| --- | --- | --- |
| 🧪 | **Vitest 5** + **jsdom** | Unit and component tests |
| 💅 | **Prettier 3** | Code formatting (`.prettierrc`) |
| 📐 | **EditorConfig** | Consistent indentation and line endings (`.editorconfig`) |
| 🛠️ | **Angular CLI 22** | Generate, serve, build and test |
| 📦 | **npm 12** | Package manager (pinned in `package.json`; **do not use pnpm or yarn**) |

---

## 🔌 How the UI Talks to the Backend

```
┌─────────────────────┐   HttpClient    ┌──────────────────────┐   JPA    ┌─────────────┐
│  Angular component  │ ──────────────► │  Spring Boot API     │ ───────► │ PostgreSQL  │
│  (feature page)     │                 │  /api/v1/**          │          └─────────────┘
└─────────┬───────────┘                 │  JWT + role checks   │ ───────► Redis, MinIO,
          │ calls                       └──────────▲───────────┘          Stripe, Groq,
┌─────────▼───────────┐                            │                      Resend, Firebase
│  Feature service    │ ── interceptors ───────────┘
│  (typed requests)   │    ① add Bearer token
└─────────────────────┘    ② refresh on 401
                           ③ map errors to APIErrorResponse
```

### 📦 Response shape

Every endpoint returns the same wrapper, so the UI can handle all responses in one way.

```ts
// ✅ Success
interface ApiResponse<T> {
  success: true;
  status: number;        // 200, 201...
  message: string;       // human-readable, safe to show in the UI
  data: T;
  path: string;
  timestamp: string;
}

// ❌ Error
interface ApiErrorResponse {
  success: false;
  status: number;        // 400, 401, 403, 404, 409, 429, 500
  error: string;
  errorCode: string;     // e.g. "ACCESS_DENIED", "ENDPOINT_NOT_FOUND"
  message: string;
  errors?: { field: string; message: string; rejectedValue?: unknown }[]; // form validation errors
  path: string;
  timestamp: string;
}
```

> ⚠️ Paging comes in **two shapes** from the backend: some lists return `pageNumber/pageSize/hasNext`, others return `page/size`. Keep both page interfaces in `core/interface` and use the right one per endpoint.

### 🔑 Authentication flow

```
Register ──► Verify OTP ──► Login ──► { user, accessToken, refreshToken }
   201          200           200
                                │
     Every request: Authorization: Bearer <accessToken>
                                │
     401 received? ──► POST /auth/refresh-token ──► new accessToken + NEW refreshToken
                                │                   (the old refresh token stops working)
                    refresh fails? ──► logout + redirect to /login
```

Other sign-in options: 🔗 **magic link** (`/auth/magic-link/*`) and 🔥 **Google** via Firebase (`/auth/google`).

### 💳 Payment flow (Stripe)

```
Cart ──► Apply coupon ──► POST /payment/checkout ──► { clientSecret, publishableKey }
                                                         │
                         Stripe.js confirms the card payment in the browser
                                                         │
                         Stripe webhook ──► backend marks the payment as PAID
```

> 🔒 The browser only ever sees the Stripe **publishable** key, returned by the API. The **secret** key lives only on the backend.

---

## 🗂️ Project Structure

```
learningLadderUI/
├── 📁 public/                     # Static assets copied as-is into the build
│   ├── 📁 docs/                   # Downloadable documents
│   ├── 📁 fonts/                  # Self-hosted fonts
│   ├── 📁 icons/                  # SVG/PNG icons
│   └── 📁 images/                 # Logos, illustrations, placeholders
│
├── 📁 src/
│   ├── 📁 app/
│   │   ├── 📁 core/               # 🧠 Singleton, app-wide logic (used once)
│   │   │   ├── 📁 enum/           #    User roles, statuses, payment types...
│   │   │   ├── 📁 guard/          #    Route guards (auth, role, guest-only)
│   │   │   ├── 📁 interceptor/    #    JWT, token refresh, error, logging, loader
│   │   │   ├── 📁 interface/      #    Global types: ApiResponse, ApiError, Page, User
│   │   │   └── 📁 service/
│   │   │       ├── 📁 auth/       #    🔐 One folder per auth use case (see below)
│   │   │       └── 📁 logger/     #    Central logging service
│   │   │
│   │   ├── 📁 features/           # 🏗️ Business features (lazy-loaded)
│   │   │   ├── 📁 ai-assistant/
│   │   │   ├── 📁 booking/
│   │   │   ├── 📁 coupon/
│   │   │   ├── 📁 course/
│   │   │   ├── 📁 dashboard/
│   │   │   │   ├── 📁 admin-dashboard/
│   │   │   │   ├── 📁 librarian-dashboard/
│   │   │   │   ├── 📁 student-dashboard/
│   │   │   │   └── 📁 tutor-dashboard/
│   │   │   ├── 📁 job-application/
│   │   │   ├── 📁 job-listing/
│   │   │   ├── 📁 library/
│   │   │   ├── 📁 partnership/
│   │   │   ├── 📁 payment/
│   │   │   ├── 📁 review/
│   │   │   ├── 📁 shopping-cart/
│   │   │   ├── 📁 student-profile/
│   │   │   ├── 📁 time-table/
│   │   │   └── 📁 tutor-profile/
│   │   │
│   │   ├── 📁 shared/             # ♻️ Reusable, stateless building blocks
│   │   │   ├── 📁 custom-pipe/
│   │   │   ├── 📁 directives/
│   │   │   └── 📁 reusable-components/
│   │   │
│   │   ├── 📄 app.config.ts       # Providers: router, HttpClient, interceptors
│   │   ├── 📄 app.routes.ts       # Top-level routes (lazy-loads each feature)
│   │   ├── 📄 app.ts / app.html / app.css   # Root component (shell, nav, outlet)
│   │
│   ├── 📁 environments/           # 🔐 Environment config. NOT committed to GitHub
│   │   ├── 📄 environment.ts              # production
│   │   └── 📄 environment.development.ts  # local development
│   ├── 📄 index.html
│   ├── 📄 main.ts                 # Bootstraps the app
│   └── 📄 styles.css              # Global styles
│
├── ⚙️ .env                        # 🔐 Local values. NOT committed
├── 📐 .editorconfig
├── 💅 .prettierrc
├── 🙈 .gitignore
├── 🅰️ angular.json
├── 📦 package.json / package-lock.json
└── 🟦 tsconfig.json / tsconfig.app.json / tsconfig.spec.json
```

### 🧠 `core/`: app-wide logic, loaded once

Anything that should exist **only once** in the whole application.

| Folder | Responsibility | Examples |
| --- | --- | --- |
| `enum/` | Enums mirroring the backend | `UserRole` (`SUPER_ADMIN`, `ADMIN`, `IT_ADMIN`, `STUDENT`, `LECTURER`, `LIBRARIAN`...), `PaymentStatus`, `LoanStatus` |
| `guard/` | Protect routes | `authGuard`, `roleGuard(['ADMIN', 'SUPER_ADMIN'])`, `guestGuard` (keeps logged-in users off `/login`) |
| `interceptor/` | Touch every HTTP request and response | `authInterceptor`, `refreshTokenInterceptor`, `errorInterceptor`, `loggingInterceptor`, `loaderInterceptor` |
| `interface/` | Global types | `ApiResponse<T>`, `ApiErrorResponse`, `PagedResponse<T>`, `User`, `AuthTokens` |
| `service/auth/` | One folder per auth use case | `login`, `register`, `verify-otp`, `resend-otp`, `refresh-token`, `logout`, `forgot-password`, `reset-password`, `login-via-magic-link`, `verify-magic-link`, `resend-magic-link`, `google-auth`, `fetch-user`, `fetch-all-users`, `block-user-account`, `un-block-user-account`, `delete-user-account` |
| `service/logger/` | Central logging | Console in development; can forward errors to a monitoring tool in production |

> 🚫 `core/` must **never** import from `features/`.

### 🏗️ `features/`: business logic per domain

Each feature owns its **pages, feature-specific components, service, models and routes**, and is **lazy-loaded**. A typical feature looks like this:

```
features/course/
├── 📁 pages/
│   ├── 📁 course-list/          # course-list.ts / .html / .css / .spec.ts
│   ├── 📁 course-detail/
│   └── 📁 course-form/          # create + edit
├── 📁 components/               # Used only inside this feature
│   └── 📁 course-card/
├── 📁 models/                   # CourseResponse, CreateCourseRequest...
├── 📄 course.service.ts         # All /api/v1/course HTTP calls
└── 📄 course.routes.ts          # Child routes, lazy-loaded from app.routes.ts
```

> 🚫 Features must **not** import from each other. If two features need the same thing, move it to `shared/` (UI) or `core/` (logic).

### ♻️ `shared/`: reusable building blocks

Stateless, presentation-only pieces any feature can use.

| Folder | Examples |
| --- | --- |
| `reusable-components/` | `button`, `input`, `modal`, `data-table`, `pagination`, `search-bar`, `status-badge`, `empty-state`, `spinner`, `toast`, `confirm-dialog`, `file-upload`, `avatar`, `stat-card` |
| `custom-pipe/` | `currencyFormat`, `timeAgo`, `fileSize`, `initials`, `truncate`, `enumLabel` |
| `directives/` | `hasRole` (show or hide by role), `autofocus`, `clickOutside`, `debounceClick`, `lazyImage` |

> ✅ Shared components receive data through `input()` and emit through `output()`. They **never** call the API directly.

### 🔐 `environments/`: configuration and secrets

Holds the environment values (API base URL, Firebase web config...). This folder is **git-ignored** and must **not** be pushed to GitHub. See [Environment Variables & Secrets](#-environment-variables--secrets).

---

## 🗺️ Feature ↔ API Map

All endpoints are prefixed with **`/api/v1`**. 🔓 = public · 🔑 = logged in · 👮 = specific roles.

| 📁 Folder | 🌐 API base | 🧾 What it does | 🔐 Access |
| --- | --- | --- | --- |
| `core/service/auth` | `/auth` | Register, OTP, login, refresh, logout, password reset, magic link, Google, users admin | 🔓 / 👮 admin |
| `features/course` | `/course` | Paged list, search, count, CRUD with files, PDF download | 🔑 read · 👮 write |
| `features/student-profile` | `/student-profile` | Create own profile; staff list/search/export | 👮 |
| `features/tutor-profile` | `/tutor-profile` | Create own profile; staff list/search/export | 👮 |
| `features/time-table` | `/time-table` | Class schedule, search, PDF | 🔑 read · 👮 write |
| `features/review` | `/review` | Course reviews, approve/disapprove | 🔑 / 👮 |
| `features/booking` | `/booking` | Book tutor sessions, tutor approve/decline | 👮 student / tutor |
| `features/library` | `/library/books`, `/library/loans` | Catalog plus loan lifecycle (reserve → issue → renew → return → confirm) | 🔑 / 👮 librarian |
| `features/job-listing` | `/job-listing` | Job board | 🔑 / 👮 admin |
| `features/job-application` | `/job-application` | Apply with CV, admin review | 🔑 / 👮 admin |
| `features/partnership` | `/partners`, `/partners/public` | Sponsors & partners (public website pages) | 🔓 public · 👮 staff |
| `features/shopping-cart` | `/shopping-cart` | Cart, save for later, coupon, history | 🔑 |
| `features/coupon` | `/coupons` | Issue, list, revoke coupons | 👮 admin / tutors |
| `features/payment` | `/payment` | Stripe checkout, school fees, salaries, refunds | 🔑 / 👮 finance |
| `features/ai-assistant` | `/ai-assist` | AI assistants, conversations, streamed chat, feedback | 🔑 · 👮 admin config |
| `features/dashboard/*` | *(combines the above)* | Role-specific overviews built from count/search endpoints | 👮 per role |

> 📘 Request and response shapes are in Swagger. Generate or update models in each feature's `models/` folder from the OpenAPI spec.

---

## 🚀 Getting Started

### ✅ Prerequisites

| Tool | Version | Check |
| --- | --- | --- |
| 🟩 Node.js | 24.x LTS | `node -v` |
| 📦 npm | 12.x | `npm -v` |
| 🅰️ Angular CLI | 22.x | `npx ng version` |
| 🌿 Git | latest | `git --version` |
| 💻 VS Code (recommended) | latest | Extensions: Angular Language Service, Prettier, EditorConfig, Tailwind CSS IntelliSense |
| ☕ Backend *(optional)* | Java 25 + Spring Boot 4 | Only if you run the API locally; otherwise point to the Render URL |

### 🛠️ Installation

```bash
# 1️⃣ Clone the repository
git clone <repository-url>
cd learningLadderUI

# 2️⃣ Install dependencies (npm only — the project pins npm@12)
npm install

# 3️⃣ Create your environment files (see the next section)

# 4️⃣ Start the dev server
npm start
```

Open 👉 **<http://localhost:4200>** (or the port set in your config).

### 🔀 Dev proxy (recommended)

Create `proxy.conf.json` in the project root to forward API calls to the backend:

```json
{
  "/api": {
    "target": "http://localhost:8090",
    "secure": false,
    "changeOrigin": true
  }
}
```

Register it in `angular.json` → `projects → learning-ladder-ui → architect → serve → options`:

```json
"options": { "proxyConfig": "proxy.conf.json" }
```

Then set `apiUrl: '/api/v1'` in `environment.development.ts`. To work against the **deployed** API instead, change the proxy `target` to `https://learningladder-4xlm.onrender.com`.

> 🔁 Restart `npm start` after changing the proxy, `angular.json` or environment files. Hot reload does not pick these up.

---

## 🔐 Environment Variables & Secrets

### 🙈 Never commit these

Make sure `.gitignore` contains:

```gitignore
# 🔐 Environment & secrets
.env
.env.*
!.env.example
src/environments/*
!src/environments/environment.example.ts
```

If a file was committed before being ignored, remove it from git tracking (this keeps your local copy):

```bash
git rm --cached -r src/environments .env
git commit -m "chore: stop tracking environment files"
```

### 📝 Template to commit: `src/environments/environment.example.ts`

New developers copy this file to create their own environment files:

```ts
export const environment = {
  production: false,
  apiUrl: '/api/v1',              
    apiKey: '<firebase-web-api-key>',
    authDomain: '<project>.firebaseapp.com',
    projectId: '<project-id>',
    storageBucket: '<project>.firebasestorage.app',
    messagingSenderId: '<sender-id>',
    appId: '<app-id>',
  },
};
```

```bash
# Windows PowerShell
Copy-Item src/environments/environment.example.ts src/environments/environment.development.ts
Copy-Item src/environments/environment.example.ts src/environments/environment.ts
```

> ⚠️ **Important:** everything in `environment.ts` is **bundled into the JavaScript sent to the browser**. Anyone can read it in DevTools. Only put **public** configuration here: the API URL, the Firebase **web** config (protected by Firebase Security Rules, not by secrecy), and publishable keys.
>
> 🚫 **Never** put in the frontend: Stripe secret keys (`sk_…`), database credentials, JWT secrets, Groq/OpenAI/Resend API keys or Firebase **Admin** private keys. These belong only in the Spring Boot backend.

Ask the team lead for the current values. They're shared through the team password manager, **never** through chat or email.

---

## 📜 Available Scripts

| Command | What it does |
| --- | --- |
| `npm start` | ▶️ Runs `ng serve` (development server with hot reload) |
| `npm run build` | 📦 Production build into `dist/` |
| `npm run watch` | 👀 Development build in watch mode |
| `npm test` | 🧪 Runs the unit tests (Vitest) |
| `npx ng generate component features/course/pages/course-list` | 🧩 Generate a component |
| `npx ng generate service features/course/course` | 🔧 Generate a service |
| `npx ng generate guard core/guard/auth --functional` | 🛡️ Generate a functional guard |
| `npx ng generate interceptor core/interceptor/auth` | 🪝 Generate an interceptor |
| `npx prettier --write "src/**/*.{ts,html,css}"` | 💅 Format the codebase |

---

## 🛡️ Client-Side Security

> 🧠 Rule: **the backend is the real security boundary.** The frontend improves the user experience (hiding buttons, redirecting), but every permission is enforced again by Spring Security.

| | Practice | How |
| --- | --- | --- |
| 🔑 | **Attach tokens automatically** | `authInterceptor` adds `Authorization: Bearer <token>` to `/api/**` requests only, never to third-party URLs |
| 🔁 | **Refresh tokens safely** | On `401`, call `/auth/refresh-token` **once**, queue other requests until it finishes, store the **new** refresh token (rotation), then retry. If the refresh fails, log out |
| 🧳 | **Token storage** | Keep the access token **in memory** (a signal in the auth service). Store the refresh token as carefully as possible and clear everything on logout |
| 🚪 | **Logout properly** | Call `POST /auth/logout` with the refresh token, then clear all tokens and cached user data |
| 🛡️ | **Route guards** | `authGuard` for logged-in pages, `roleGuard` for role-specific pages (dashboards, admin tools), `guestGuard` for login/register |
| 👁️ | **Role-based UI** | Use the `*hasRole` directive to hide actions the user can't perform |
| 🧼 | **XSS protection** | Rely on Angular's built-in sanitisation. Avoid `[innerHTML]` with user content and **never** use `bypassSecurityTrust*` on untrusted data |
| 🔐 | **No secrets in the bundle** | See [Environment Variables & Secrets](#-environment-variables--secrets) |
| 💳 | **Payments** | Card details go **directly to Stripe** via Stripe.js; they never touch our code or API |
| 📝 | **Validate forms** | Use Reactive Forms validators that mirror the backend rules, and show the backend's `errors[]` per field |
| 🙊 | **Don't log sensitive data** | Never log passwords, OTP codes, tokens or card details, even in development |
| 🚦 | **Respect rate limits** | Handle `429 Too Many Requests` with a friendly message and disable repeated submits |

---

## ⚡ Performance Guidelines

| | Practice | Why |
| --- | --- | --- |
| 💤 | **Lazy-load every feature** with `loadComponent` / `loadChildren` | Users download only what they open |
| ⏳ | **`@defer`** for heavy, below-the-fold UI (charts, AI chat, PDF previews) | Faster first render |
| 📶 | **Signals + `ChangeDetectionStrategy.OnPush`** | Fewer, cheaper change-detection cycles |
| 🔢 | **Always `track`** in `@for` (`track item.id`) | Avoids re-rendering whole lists |
| 📄 | **Server-side paging and search** | Use the API's `page`/`size` and `/search` endpoints; never load everything |
| ⌛ | **Debounce search inputs** (`debounceTime(300)` + `distinctUntilChanged`) | Fewer API calls |
| 🗃️ | **Cache stable data** (enums, assistants, catalog pages) in services | Fewer repeated requests |
| 🖼️ | **`NgOptimizedImage`** for thumbnails and logos | Lazy, correctly sized images |
| 🧹 | **Clean up subscriptions** with `takeUntilDestroyed()` or `toSignal()` | Prevents memory leaks |
| 📦 | **Respect bundle budgets** in `angular.json` | Catches bundle growth early |
| 📊 | **Measure** with Lighthouse and Angular DevTools | Find real bottlenecks before optimising |

---

## ✍️ Coding Conventions

- 🧩 **Standalone components only**, no NgModules.
- 💉 Use **`inject()`** instead of constructor injection.
- 📶 Prefer **signals** (`signal`, `computed`, `input()`, `output()`, `model()`) for component state.
- 🔀 Use the **built-in control flow**: `@if`, `@for`, `@switch`, `@defer`.
- 📝 Use **Reactive Forms** for every form, typed with `FormBuilder.nonNullable`.
- 🏷️ **File naming** follows the current Angular style: `course-list.ts`, `course-list.html`, `course-list.css`, `course-list.spec.ts`. Services: `course.service.ts`.
- 🧱 **One HTTP service per feature.** Components never call `HttpClient` directly.
- 🟦 **No `any`.** Type every request and response with interfaces from `models/` or `core/interface`.
- 🔤 **Names:** `PascalCase` for classes and types, `camelCase` for variables and methods, `kebab-case` for files and folders, `UPPER_SNAKE_CASE` for enum values (matching the backend).
- 💅 Run **Prettier** before every commit.
- 📥 **Import rules:**

  | From ➡️ | `core` | `features` | `shared` |
  | --- | --- | --- | --- |
  | `core` | ✅ | 🚫 | ✅ |
  | `features` | ✅ | 🚫 (other features) | ✅ |
  | `shared` | ✅ (interfaces/enums only) | 🚫 | ✅ |

---

## 🌿 Git Workflow

### 🌳 Branches

| Branch | Purpose |
| --- | --- |
| `master` | 🚀 Production-ready code. Protected; merge only through pull requests |
| `develop` | 🧪 Integration branch for the next release |
| `feature/<ticket>-<short-name>` | ✨ New work, e.g. `feature/LL-42-course-list-page` |
| `fix/<ticket>-<short-name>` | 🐛 Bug fixes |
| `chore/<short-name>` | 🧹 Tooling, dependencies, config |

### 📝 Commit messages ([Conventional Commits](https://www.conventionalcommits.org/))

```
feat(course): add paginated course list page
fix(auth): store rotated refresh token after refresh
refactor(shared): extract data-table component
test(booking): cover approve/decline flow
chore(deps): update angular to 22.2.5
```

### 🔍 Pull request checklist

- [ ] ✅ `npm run build` passes
- [ ] 🧪 `npm test` passes, and new logic has tests
- [ ] 💅 Code is formatted with Prettier
- [ ] 🔐 No secrets, tokens or environment files committed
- [ ] 📱 UI checked on mobile and desktop widths
- [ ] ♿ Labels, alt text and keyboard navigation work
- [ ] 📸 Screenshots attached for UI changes
- [ ] 👀 At least **one approving review** before merging

---

## 🧪 Testing

- 🧪 **Unit tests** run on **Vitest** with **jsdom**: `npm test`.
- 📄 Every service, guard, interceptor, pipe and directive gets a `.spec.ts` next to it.
- 🌐 Mock HTTP with `provideHttpClientTesting()` and `HttpTestingController`; tests must **never** call the real API.
- 🎯 Focus first on the **auth flow** (login, refresh, logout), **guards**, **interceptors** and **payment** logic.

---

## 👋 Onboarding New Developers

Welcome to the team! 🎉 Follow this plan to go from zero to your first merged pull request.

### 📅 Day 1: Set up and explore

| ✅ | Task |
| --- | --- |
| ☐ | 🔑 Get access to the **Git repository**, the **team chat** and the **password manager** (for environment values) |
| ☐ | 🧰 Install the [prerequisites](#-prerequisites) and VS Code extensions |
| ☐ | 📥 Clone the repo, run `npm install`, and create your environment files from `environment.example.ts` |
| ☐ | ▶️ Run `npm start` and open the app |
| ☐ | 📘 Open **Swagger UI** and try `POST /api/v1/auth/register` → `verify-otp` → `login` with your own test account |
| ☐ | 🔓 Click **Authorize** in Swagger, paste your access token and call a protected endpoint such as `GET /api/v1/course` |
| ☐ | 📖 Read this README end to end |

### 📅 Day 2: Understand the architecture

| ✅ | Task |
| --- | --- |
| ☐ | 🧠 Walk through `core/`: how `authInterceptor` adds the token, how refresh works, how guards protect routes |
| ☐ | 🧭 Read `app.routes.ts` and follow how one feature is lazy-loaded |
| ☐ | 🏗️ Pick **one feature** (e.g. `course`) and trace a request: component → service → interceptor → API → response → UI |
| ☐ | ♻️ Browse `shared/reusable-components` so you know what exists **before** building something new |
| ☐ | 👥 Learn the **roles** in `core/enum` and which dashboard each role sees |

### 📅 Days 3–5: First contribution

| ✅ | Task |
| --- | --- |
| ☐ | 🎟️ Take a ticket labelled **`good first issue`** (a small shared component, pipe or a list page) |
| ☐ | 🌿 Create a branch: `feature/<ticket>-<short-name>` |
| ☐ | 🧪 Write the code **and** its tests |
| ☐ | 🔍 Open a pull request using the [checklist](#-pull-request-checklist) |
| ☐ | 🤝 Pair with a teammate on review feedback, then merge 🎉 |

### 🧭 Who to ask

| Topic | Contact |
| --- | --- |
| 🅰️ Frontend architecture & code reviews | Frontend lead |
| ☕ Backend API, endpoints & roles | Backend lead (Swagger first, then ask) |
| 🔐 Access, environment values & secrets | Team lead |
| 🎨 UI/UX designs | Designer / product owner |

> 💡 **Golden rules for new developers**
>
> 1. 🔎 Check `shared/` before building a new component.
> 2. 📘 Check Swagger before guessing an API shape.
> 3. 🔐 Never commit `.env` or `src/environments/*`.
> 4. 🧱 Components call services; services call the API.
> 5. ❓ Stuck for more than 30 minutes? Ask. That's what the team is for.

---

## 🆘 Troubleshooting

| ❌ Problem | ✅ Fix |
| --- | --- |
| `ERR_PNPM_OTHER_PM_EXPECTED` | The project pins npm. Use `npm`, not `pnpm` or `yarn` |
| `Could not resolve "src/styles.css"` | A file referenced in `angular.json` is missing. Restore it (`git restore <file>`) or remove the reference |
| `Unexpected token '<', "<!DOCTYPE"… is not valid JSON` | The request hit the Angular dev server instead of the API. Check `apiUrl` in your environment file and that `proxy.conf.json` is registered, then restart `npm start` |
| `302` on an API call | Same cause as above: the request fell through to Angular's `**` route. Fix the API URL or proxy |
| CORS error in the console | Use the dev proxy, or ask the backend lead to add your origin to `CORS_ALLOWED_ORIGINS` |
| `401 Unauthorized` on every request | Your access token expired and refresh failed. Log out and log in again; check the refresh interceptor |
| `403 Forbidden` | Your user's role isn't allowed on that endpoint. Check the role in Swagger or ask for a test account with the right role |
| `404` on `/api/v1/health` | Health checks live at `/actuator/health`, not under `/api/v1` |
| Changes to `.env`, proxy or `angular.json` not applied | Stop and restart `npm start`. If needed, delete `.angular/cache` |
| Production API slow on first request | The Render free tier sleeps when idle; the first call can take 30–60 seconds |

---

<p align="center">Built with ❤️ by the <b>Learning Ladder</b> team · 🅰️ Angular + ☕ Spring Boot</p>

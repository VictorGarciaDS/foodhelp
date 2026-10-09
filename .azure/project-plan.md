# Project Plan

**Status**: In Progress
**Created**: 2026-10-04
**Mode**: NEW

---

## 1. Project Overview

**Goal**: Build FoodHelp, a private Spanish-language family web app for verified food catalogs and prescriptions, exact food-equivalent calculations, saved and on-demand AI recipe suggestions, seven-day menu planning, consolidated shopping lists, and deterministic PDF exports. The project is designed so that every module is independently testable.

**App Type**: SPA + API

**API Login**: Yes

**Mode**: NEW

**Deployment Plan**: No deployment plan found

Hosting and persistence are explicitly fixed by the submitted requirements to Render.com and PostgreSQL on Neon; no Azure hosting or data service is planned. The `.azure` directory contains planning artifacts only. No real clinical catalog, prescription, or confirmed allergy data was supplied, so menu generation must remain unavailable until those inputs are entered and reviewed.

---

## 2. FoodHelp API — backend

| Component | Technology |
|-----------|-----------|
| **Language** | TypeScript |
| **Runtime** | Node |
| **Package Manager** | npm |
| **Test Runner** | vitest |
| **Mocking Library** | vi.mock |
| **Test Command** | npm test |
| **Orchestration** | docker-compose |

Implement a same-origin Express API and serve the production Vite build from the Render.com web service. Use Zod at request boundaries and PostgreSQL SQL migrations against the isolated `foodhelp` schema. Keep all migration statements explicitly scoped to that schema; do not alter other Neon schemas, connect to Neon, or run migrations during planning. Configure the database URL only through an untracked local environment file or Render environment settings; never commit credentials.

Store food entries by food group, name, base quantity, and unit; monthly prescriptions by person, meal time, and group; saved recipes; weekly menus; and shopping-list source data. Do not persist generated PDFs. Generate menu and shopping PDFs on demand with PDFKit and stream the result.

Equivalent calculations use exact rational arithmetic for `quantity / base`, validate the food group and compatible unit, and never infer conversions between pieces, grams, tablespoons, or other incompatible units. Required regression examples are `2 cookies / base 4 = 0.5` and `3 tablespoons of granola / base 2 = 1.5`. Reject invalid or out-of-target menu and recipe candidates; never present an invalid candidate as compliant. Keep 7-day planning to 2–3 repeatable menus per day, with one shared base dish and per-person portions. Aggregate shopping quantities by food and unit only; do not add invented conversions, rounding, packaging waste, or a zero-waste claim.

Prefer saved recipes. Call the external completion API only on explicit request or when no saved recipe matches, and request exactly three new proposals. Fetch recipe details on demand. The AI integration is an Enhancement: if its key is absent, its contract is incompatible, or the provider fails, do not call it or discard existing recipes; report the unavailable suggestion action while preserving saved data. Use the configured `https://api.artesaniadigital.org/v1/completions` endpoint and `gpt-5` model only from the backend, with the student key read from environment configuration and sent as `x-student-key`; never expose or log the key. Confirm the provider response contract before integration and do not test the live provider without a supplied key.

Block menu generation until verified catalog entries, the initial family member's real prescription, and allergy/restriction status have been entered. Do not infer a lack of allergies, create medical values, or treat preview fixtures as clinical instructions. Additional family members may be added later.

Use the supplied Neon database over TLS with `DATABASE_URL`; the target database/schema are the existing `ai_course` database and isolated `foodhelp` schema. Credentials previously shared in chat must be treated as exposed and rotated before any connection or deployment. Never reproduce credentials in files, logs, or source control; configure only newly rotated values through an untracked local `.env` or Render environment settings. Do not connect to Neon during planning.

---

## 3. FoodHelp web — frontend

| Component | Technology |
|-----------|-----------|
| **Language** | TypeScript |
| **Framework** | React + Vite |
| **Package Manager** | npm |
| **Test Runner** | vitest |
| **Mocking Library** | vi.mock |
| **Test Command** | npm test |

Build a responsive Spanish-language single-page interface served by the same Render.com service as the API. Use a typed API client and shared Zod contracts. Provide accessible validation and explicit blocked, empty, loading, and recoverable error states. Do not include a marketing landing page or invent clinical values in empty states.

---

## 4. Services Required

| Azure Service | Role in App | Environment Variable | Default Value (Local) | Classification |
|---------------|------------|---------------------|----------------------|----------------|
| Render.com Web Service (non-Azure) | Serve the React build and Express API from one origin | `PORT` | `3000` | Essential |
| PostgreSQL on Neon (non-Azure) | Persist verified catalog, prescriptions, recipes, menus, and shopping inputs in schema `foodhelp` | `DATABASE_URL` | Unset until newly rotated credentials are configured; TLS required for Neon | Essential |
| External completion API (non-Azure) | Produce exactly three validated recipe suggestions on request or when saved recipes have no match | `AI_API_BASE_URL`, `AI_MODEL`, `AI_STUDENT_KEY` | `https://api.artesaniadigital.org/v1/completions`; `gpt-5`; key unset and calls disabled | Enhancement |

No Azure services, Azure storage, file persistence, or Azure deployment are included. PDF responses are generated on demand and are not stored.

---

## 5. Prerequisites

### Run

| Tool | Service(s) | Installed | Version |
|------|------------|-----------|---------|
| Node.js | * | ✅ | 24.9.0 |
| npm | * | ✅ | 11.6.0 |

### Debug

| Tool | Service(s) | Installed | Version |
|------|------------|-----------|---------|
| Chrome | foodhelp-web | ✅ | 154.0.8037.93 |

No container runtime is required for local emulators because this plan has no Azure dependencies.

---

## 6. Design System & UI

**Component Library**: Fluent UI v9
**Style Direction**: A calm, practical family food-planning workspace: compact, scannable tables and lists, restrained elevation, clear status colors, and a warm accent for primary actions without making the interface feel clinical. Use 4–8px corners and keep the current week's plan as the main working surface.
**Typography**: Aptos, Segoe UI Variable, system-ui

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#147D73` | FoodHelp actions, selected navigation, and confirmed calculation accents |
| `accent` | `#C84A32` | Recipe prompts, attention cues, and secondary highlights |
| `surface` | `#F5F8F5` | App canvas and quiet page background |
| `text` | `#202B28` | Main labels, food names, and quantities |
| `muted` | `#64716C` | Units, helper text, and pending-data notes |
| `border` | `#D8E1DC` | Table rules, field boundaries, and section dividers |

### Pages

| Page | Route | Purpose | Layout |
|------|-------|---------|--------|
| Semana | `/` | Review a seven-day plan, its 2–3 repeatable menus per day, per-person portions, and export the menu PDF. | `header + nav + main + tabs + table + action-bar` |
| Recetas | `/recipes` | Browse saved recipes first, request exactly three new suggestions when eligible, and open recipe details on demand. | `header + nav + main + tabs + card-list + actions` |
| Alimentos | `/foods` | Maintain the five food groups, verified base quantities and units, and inspect exact-equivalent calculations. | `header + nav + main + table + form + action-bar` |
| Personas y prescripciones | `/people` | Manage family members and monthly prescriptions by meal time and food group. | `header + nav + main + tabs + table + form + action-bar` |
| Compras | `/shopping` | Review quantities aggregated across selected people by food and compatible unit, then export the shopping PDF. | `header + nav + main + table + actions` |

### Sample Content

Semana — day and planning state:
| Day | Menus per day | State |
| Lunes | 2–3 | Blocked until verified catalog, prescription, and restriction status are entered |
| Martes | 2–3 | Uses repeatable menus from the same seven-day plan |
| Miércoles | 2–3 | Uses repeatable menus from the same seven-day plan |
| Jueves | 2–3 | Uses repeatable menus from the same seven-day plan |
| Viernes | 2–3 | Uses repeatable menus from the same seven-day plan |
| Sábado | 2–3 | Uses repeatable menus from the same seven-day plan |
| Domingo | 2–3 | Uses repeatable menus from the same seven-day plan |

Recetas — saved recipe state:
| Collection | Count | Behavior | State |
| Recetas guardadas | 0 supplied | Prefer saved matches before generation | Empty until family recipes are entered |
| Propuestas nuevas | Exactly 3 per eligible request | Generate only on request or when there are no saved matches | Disabled until required real data and provider configuration are available |
| Detalle de receta | On demand | Load detail only when opened | No recipe detail data supplied |

Alimentos — food group and calculation examples:
| Group or fixture | Base / unit | Result | State |
| Frutas | Real catalog quantity and unit not supplied | — | Requires manual verified entry |
| Verduras | Real catalog quantity and unit not supplied | — | Requires manual verified entry |
| Cereales y leguminosas | Real catalog quantity and unit not supplied | — | Requires manual verified entry |
| Proteínas | Real catalog quantity and unit not supplied | — | Requires manual verified entry |
| Grasas | Real catalog quantity and unit not supplied | — | Requires manual verified entry |
| Galletas calculation fixture | 2 ÷ base 4 | 0.5 equivalent | User-supplied arithmetic test only; not a prescription |
| Granola calculation fixture | 3 tablespoons ÷ base 2 | 1.5 equivalents | User-supplied arithmetic test only; not a prescription |

Personas y prescripciones — family member:
| Person | Initial scope | Prescription | State |
| Mamá | Initial person | Real monthly values by meal time and group not supplied | Menu generation blocked pending entry and review |
| Usuario | Add later | Not supplied | Not configured |
| Hermana | Add later | Not supplied | Not configured |

Compras — aggregate:
| Source | Aggregation | Conversion policy | State |
| Selected people across the week | Sum by food and unit | No conversion between incompatible units | Empty until a valid menu exists |
| Shopping PDF | Deterministic on-demand export | No stored PDF | Available only when a list can be generated |

The preview uses only these supplied values and truthful pending/empty states. It must not introduce recipe ingredients, prescription quantities, allergy assumptions, or other medical data.

---

## 7. Project Structure

```text
FoodHelp/
├── .azure/
│   └── project-plan.md
├── .env.example
├── .gitignore
├── package.json
├── packages/
│   └── contracts/
│       ├── package.json
│       └── src/
│           ├── schemas/
│           └── types/
└── services/
    ├── foodhelp-api/
    │   ├── package.json
    │   ├── src/
    │   │   ├── app.ts
    │   │   ├── routes/
    │   │   ├── domain/
    │   │   │   ├── equivalents/
    │   │   │   ├── menus/
    │   │   │   └── recipes/
    │   │   ├── db/
    │   │   │   └── migrations/       # Explicitly scoped to schema foodhelp
    │   │   ├── integrations/
    │   │   │   └── completion-api.ts
    │   │   └── exports/
    │   │       └── pdf.ts
    │   └── tests/
    │       ├── domain/
    │       ├── routes/
    │       └── fixtures/
    └── foodhelp-web/
        ├── package.json
        ├── vite.config.ts
        ├── index.html
        └── src/
            ├── api/
            ├── components/
            └── pages/
                ├── WeekPage.tsx
                ├── RecipesPage.tsx
                ├── FoodsPage.tsx
                ├── PeoplePage.tsx
                └── ShoppingPage.tsx
```

---

## 8. Route Definitions

| # | Method | Path | Description | Request Body | Response Body | Status Codes |
|---|--------|------|-------------|-------------|--------------|-------------|
| 1 | GET | `/api/health` | Check API process and essential dependency readiness without exposing configuration | — | `{ status, services }` | 200, 503 |
| 2 | GET | `/api/foods` | List catalog entries, optionally filtered by group | — | `{ items: Food[] }` | 200, 503 |
| 3 | POST | `/api/foods` | Create a food entry after group, base quantity, and unit validation | `{ name, group, baseQuantity, unit }` | `{ item: Food }` | 201, 422 |
| 4 | GET | `/api/people` | List family members and prescription completeness | — | `{ people: Person[] }` | 200, 503 |
| 5 | PUT | `/api/people/:personId/prescription` | Save a verified monthly prescription by meal time and food group | `{ month, meals }` | `{ prescription: Prescription }` | 200, 404, 422 |
| 6 | POST | `/api/equivalents/calculate` | Calculate exact quantity/base equivalent with group and unit validation | `{ foodId, quantity, unit }` | `{ numerator, denominator, decimal }` | 200, 404, 422 |
| 7 | GET | `/api/recipes` | List saved recipes and supported filters | — | `{ items: Recipe[] }` | 200, 503 |
| 8 | GET | `/api/recipes/:recipeId` | Load one recipe's details on demand | — | `{ recipe: RecipeDetail }` | 200, 404 |
| 9 | POST | `/api/recipes/suggestions` | Request exactly three new candidates, validate them, and preserve saved recipes if the provider fails | `{ weekStart, peopleIds }` | `{ suggestions: RecipeCandidate[] }` | 200, 422, 503 |
| 10 | GET | `/api/menus/:weekStart` | Read the seven-day plan and per-person portions | — | `{ weekStart, days }` | 200, 404, 503 |
| 11 | POST | `/api/menus/generate` | Generate a seven-day plan with 2–3 repeatable menus per day only after required verified inputs exist | `{ weekStart, peopleIds }` | `{ plan: WeeklyPlan }` | 201, 409, 422 |
| 12 | GET | `/api/shopping-list/:weekStart` | Aggregate menu ingredients by food and compatible unit without invented conversions | — | `{ items: ShoppingItem[] }` | 200, 404, 503 |
| 13 | POST | `/api/exports/pdf` | Generate and stream a deterministic menu or shopping-list PDF without persisting it | `{ kind, weekStart, peopleIds }` | `application/pdf` | 200, 409, 422, 503 |

Use the shared error response shape `{ "error": { "code": "NOT_FOUND", "message": "Item not found", "details": null } }`; validation failures use `VALIDATION_ERROR` with status 422, unavailable essential dependencies use 503, and unexpected failures use `INTERNAL_ERROR` with status 500.

---

## 9. Next Steps

1. Present this plan for explicit approval; this planning task does not create application code or connect to external services.
2. Before any later implementation or deployment, rotate the credentials exposed in chat and verify the real food catalog, monthly prescriptions, and known restrictions with the family.
3. In a separately approved implementation task, test exact equivalent arithmetic, isolated `foodhelp` schema migrations, menu-validation blockers, and deterministic PDF generation before configuring a database connection.
4. Deploy only through Render.com and Neon; keep the completion API as an optional backend-only enhancement, disabled until its response contract is confirmed and a new student key is securely configured.

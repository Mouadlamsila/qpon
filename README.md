# Qpon

**Qpon** is an open-source, self-hosted coupon framework for creating, managing, and validating coupons at scale. Built with **NestJS**, **PostgreSQL**, **TypeORM**, and **Angular**, Qpon is ideal for e-commerce, SaaS, and marketing teams seeking full control over their promotional workflows.

🌐 [Visit Qpon Website](https://quicko.company/labs/qpon) | 📖 [Documentation](https://org-quicko.github.io/qpon)

## Features

- 🧾 Create and manage coupons with custom rules and constraints
- 🛍️ Associate coupons with products or categories
- 🕒 Support start/end dates, usage limits, and redemption tracking
- 🧑‍🤝‍🧑 Multi-organization support with role-based access control
- 🔐 Secure API endpoints for managing and redeeming coupons
- 🔗 Easily integrate Qpon into your systems using REST API endpoints
- 🚀 Production-ready and easy to deploy with Docker

## Tech Stack

- **Backend:** [NestJS](https://nestjs.com/)
- **Database:** [PostgreSQL](https://www.postgresql.org/)
- **ORM:** [TypeORM](https://typeorm.io/)
- **Frontend:** [Angular](https://angular.dev/)

## Development

### 1. Prerequisites

- Node.js (>= 20.x)
- Docker (for containerized deployment)
- PostgreSQL (if not using Docker)

### 2. Running with Docker

The latest image is available on Docker Hub. Use the provided [`docker-compose.yml`](https://github.com/org-quicko/qpon/blob/main/docker-compose.yml):

```sh
# Download the compose file
curl -LO https://github.com/org-quicko/qpon/raw/main/docker-compose.yml

# Run the services in the background
docker compose up -d
```

**Note:** By default, Docker Compose expects a `.env` file for environment variables. You can also set these variables directly in your shell or hardcode them in `docker-compose.yml` if you prefer not to use a `.env` file.

Visit [http://localhost:3000](http://localhost:3000) to use the app.

### 3. Manual Setup

#### Backend (API)

```sh
cd api
npm install
npm run start:dev
```

#### Frontend

```sh
cd frontend
npm install --legacy-peer-deps
ng serve
```

## First-time Setup: Super Admin & Organization

After starting the services, visit [http://localhost:3000/setup](http://localhost:3000/setup) to set up the super admin user through the web interface.

## Environment Variables

| Variable    | Description                      | Example                  |
| ----------- | -------------------------------- | ------------------------ |
| DB_USERNAME | Database username                | qpon_user                |
| DB_PASSWORD | Database password                | strongpassword           |
| DB_NAME     | Database name                    | qpon_db                  |
| DB_HOST     | Database host                    | db (use 'db' for Docker) |
| JWT_SECRET  | JWT signing secret               | any-random-string        |
| CLAIM_TOKEN_SECRET | Dedicated claim-token encryption secret; required in production | another-random-secret |
| SALT_ROUNDS | Bcrypt salt rounds for passwords | 10                       |
| NODE_ENV | `development` or `production` | development |
| PORT | API/application port | 3000 |
| APP_URL | Application URL used by deployments | http://localhost:3000 |
| PUBLIC_BASE_URL | Public offer base URL | http://localhost:3000 |
| CORS_ORIGINS | Comma-separated browser origins; production must set this explicitly | http://localhost:4200,http://localhost:3000 |
| UPLOADS_DIR | Offer image storage directory | public/uploads/offers |
| PUBLIC_CLAIM_RATE_LIMIT_MAX | Claims per IP/offer window | 10 |
| PUBLIC_CLAIM_RATE_LIMIT_WINDOW_MS | Claim rate-limit window in milliseconds | 600000 |

These variables can be set in a `.env` file, in your shell, or directly in `docker-compose.yml`.

## MVP architecture and routes

The final MVP business loop is:

```text
Restaurant → Offer → OfferClaim → Redemption
```

Merchant routes are scoped by restaurant ID and include Dashboard, Offers, Redeem, Redemptions, and Settings. Public routes are `/o/:offer_slug` for an offer, `/claim/:claim_token` for a secure claim result, and `/api/public/...` for the public API. Platform super-admins use `/organizations` and the `/api/admin/restaurants` API to inspect restaurant accounts and activity.

The API is a NestJS application backed by PostgreSQL and TypeORM. Restaurant offer metrics query `restaurant_offer`, `offer_claim`, and claim-backed `redemption` rows directly. Legacy coupon, campaign, item, workbook, and API-key APIs remain for compatibility but are not part of the normal restaurant navigation.

## Storage and security

Offer images are stored under `UPLOADS_DIR` and served as `/uploads/offers/...`. Docker persists this directory with the `qpon_app_uploads` volume. A cloud object store can replace the filesystem behind the offer upload service later without changing public offer URLs.

Production deployments must provide both `JWT_SECRET` and a separate high-entropy `CLAIM_TOKEN_SECRET`. Claim retrieval tokens are stored hashed for lookup and encrypted with the dedicated claim secret. Development may fall back to `JWT_SECRET` only when `NODE_ENV` is not `production`.

Production CORS is allow-list based through `CORS_ORIGINS`; development keeps the local Angular workflow permissive. Public claim throttling is currently an in-process adapter, so multiple application instances require replacing its storage with a shared service such as Redis.

## Known limitations

- Customer identity is lightweight email identity; there are no customer accounts or verified email flows.
- QR output is provided for claims, while merchant redemption remains code-first unless a scanner is added later.
- Public marketplace, discovery, maps, wallet, notifications, payments, subscriptions, POS, menus, reservations, delivery, reviews, favorites, and loyalty are outside this MVP.
- Local filesystem storage is suitable for the self-hosted MVP; production deployments must persist the upload volume or provide an equivalent storage adapter.
- Angular production build still reports an initial bundle-budget warning and CommonJS optimization warnings.

## Project Structure

```
qpon/
  api/        # NestJS backend API
  frontend/   # Angular frontend web app
  lib/        # Shared TypeScript libraries (core, client, sheet-core)
  common/     # Shared resources (e.g., DB diagrams)
  resources/  # Global resources (e.g., Postman collections)
```

## Libraries

- `lib/core`: Common entities for Qpon
- `lib/sheet-core`: Sheet entities for Qpon
- `lib/client`: Client library to access Qpon APIs

## Resources

- **API Postman Collection:**[resources/json/org.quicko.qpon.postman_collection.json](https://github.com/org-quicko/qpon/blob/main/resources/json/org.quicko.qpon.postman_collection.json)
- **ER Diagram:**
  [common/org-quicko-qpon.pgerd](https://github.com/org-quicko/qpon/blob/main/common/org-quicko-qpon.pgerd)

## Contributing

Pull requests and issues are welcome! Please open an issue to discuss your ideas or report bugs.

## Maintainers

- [Quicko Engineering](mailto:developer@quicko.org.in)

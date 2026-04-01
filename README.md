# 📬 Notification Service

A production-grade microservice for sending **email** and **webhook** notifications asynchronously via RabbitMQ queues, AWS SES, and PostgreSQL.

```
Node.js · RabbitMQ · Docker · PostgreSQL · AWS SES
```

---

## Architecture

```
┌─────────────┐     POST /notifications     ┌─────────────────────┐
│   Client    │ ─────────────────────────► │   Express REST API  │
└─────────────┘                             └──────────┬──────────┘
                                                       │ publish
                                              ┌────────▼────────┐
                                              │    RabbitMQ     │
                                              │  notifications  │
                                              │  exchange (DX)  │
                                              └──┬───────────┬──┘
                                          email  │           │  webhook
                                         ┌───────▼──┐  ┌────▼──────┐
                                         │  Email   │  │  Webhook  │
                                         │ Consumer │  │ Consumer  │
                                         └───────┬──┘  └────┬──────┘
                                                 │           │
                                            AWS SES     HTTPS POST
                                                 │      (HMAC signed)
                                         ┌───────▼───────────▼──┐
                                         │      PostgreSQL       │
                                         │  (notifications log)  │
                                         └──────────────────────┘
```

### Security model

| Layer | Mechanism |
|---|---|
| Transport | HTTPS / TLS |
| Authentication | JWT (HS256) or hashed API keys (bcrypt) |
| Authorization | Scope-based (`notifications:read`, `notifications:write`, `admin`) |
| Secrets | Environment variables, never committed |
| Outbound webhooks | HMAC-SHA256 signed payloads + SSRF blocklist |
| DB queries | Parameterized only — no string interpolation |
| Rate limiting | Per-IP, configurable window |
| Headers | Helmet (HSTS, CSP, no X-Powered-By, etc.) |
| Container | Non-root user, read-only filesystem, dropped capabilities |
| Logging | Sensitive fields auto-redacted (pino redact) |
| Body size | Limited to 1 MB to prevent DoS |

---

## Quick Start

### 1. Clone & configure

```bash
git clone <repo>
cd notification-service
cp .env.example .env
```

Edit `.env` and replace every `CHANGE_ME` value:

```bash
# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate webhook signing secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Start the stack

```bash
docker compose up -d
```

Services:
- **App**: http://localhost:3000
- **RabbitMQ UI**: http://localhost:15672

### 3. Run migrations

```bash
docker compose run --rm migrate
```

### 4. Create your first API key

```bash
docker compose exec app node scripts/generateApiKey.js
```

Save the printed key — it will **never be shown again**.

---

## API Reference

All endpoints are prefixed with `/api/v1`.

### Authentication

Send credentials via either header:

```
Authorization: Bearer <jwt>
X-API-Key: <api_key>
```

---

### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/ping` | None | Liveness probe |
| GET | `/health` | None | Readiness probe (checks DB + RabbitMQ) |

---

### Notifications

| Method | Path | Scope | Description |
|---|---|---|---|
| POST | `/notifications/email` | `notifications:write` | Queue an email |
| POST | `/notifications/webhook` | `notifications:write` | Queue a webhook |
| GET | `/notifications` | `notifications:read` | List notifications |
| GET | `/notifications/:id` | `notifications:read` | Get one notification |

#### POST /notifications/email

```json
{
  "recipient": "user@example.com",
  "subject": "Welcome!",
  "body": "<h1>Hello</h1>",
  "metadata": {
    "bodyText": "Hello (plain text fallback)"
  }
}
```

**Response** `202 Accepted`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "email",
    "status": "queued",
    "recipient": "user@example.com",
    "subject": "Welcome!",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### POST /notifications/webhook

```json
{
  "recipient": "https://example.com/hooks/my-endpoint",
  "subject": "order.created",
  "body": "{\"orderId\": \"123\"}",
  "metadata": {}
}
```

Outgoing webhook requests include these headers for receiver validation:

```
X-Notification-Id:       <uuid>
X-Delivery-Timestamp:    <ISO 8601>
X-Signature-256:         sha256=<hmac-sha256-hex>
```

Verify with:
```js
const crypto = require('crypto');
const expected = crypto.createHmac('sha256', WEBHOOK_SIGNING_SECRET)
  .update(rawBody).digest('hex');
const valid = crypto.timingSafeEqual(
  Buffer.from(expected),
  Buffer.from(req.headers['x-signature-256'].replace('sha256=', ''))
);
```

---

### API Keys

All routes require `admin` scope.

| Method | Path | Description |
|---|---|---|
| POST | `/api-keys` | Create a new API key |
| GET | `/api-keys` | List all keys (hashes never returned) |
| DELETE | `/api-keys/:id` | Revoke a key |

#### POST /api-keys

```json
{
  "name": "my-service",
  "scopes": ["notifications:write", "notifications:read"]
}
```

Available scopes: `notifications:write`, `notifications:read`, `admin`

---

## Development

```bash
npm install
cp .env.example .env   # fill in values
npm run dev            # nodemon watch mode
npm test               # all tests
npm run test:coverage  # coverage report
npm run lint           # ESLint
```

### Project structure

```
notification-service/
├── docker/
│   └── Dockerfile              # Multi-stage, non-root build
├── scripts/
│   ├── migrate.js              # DB schema up/down
│   └── generateApiKey.js       # Bootstrap first admin key
├── src/
│   ├── config/
│   │   ├── env.js              # Validated env config (fail-fast)
│   │   ├── database.js         # PostgreSQL pool + helpers
│   │   └── rabbitmq.js         # AMQP connection + topology
│   ├── controllers/
│   │   ├── notificationController.js
│   │   ├── apiKeyController.js
│   │   └── healthController.js
│   ├── middleware/
│   │   ├── auth.js             # JWT + API key auth
│   │   ├── errorHandler.js     # Central error handler
│   │   ├── security.js         # Helmet, CORS, rate limiting
│   │   └── validate.js         # express-validator bridge
│   ├── models/
│   │   ├── notification.js
│   │   └── apiKey.js
│   ├── queues/
│   │   ├── emailConsumer.js    # RabbitMQ email worker
│   │   └── webhookConsumer.js  # RabbitMQ webhook worker
│   ├── routes/
│   │   ├── index.js
│   │   ├── notifications.js
│   │   └── apiKeys.js
│   ├── services/
│   │   ├── emailService.js     # AWS SES client
│   │   └── webhookService.js   # SSRF-safe HTTP dispatcher
│   ├── utils/
│   │   ├── crypto.js           # HMAC, bcrypt, UUID helpers
│   │   ├── errors.js           # Typed AppError hierarchy
│   │   └── logger.js           # Pino with secret redaction
│   ├── validators/
│   │   └── notification.js
│   ├── app.js                  # Express factory
│   └── server.js               # Bootstrap + graceful shutdown
├── tests/
│   └── unit/
│       ├── crypto.test.js
│       ├── errors.test.js
│       └── webhookService.test.js
├── .env.example
├── .gitignore
├── docker-compose.yml
└── package.json
```

---

## Environment Variables

See `.env.example` for the full list with descriptions. All `CHANGE_ME` values **must** be replaced before running.

---

## License

MIT

# FlowCRM Backend API

Backend API server for FlowCRM SaaS application.

## Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Redis (optional, for caching)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start PostgreSQL (using Docker):
```bash
docker-compose up -d postgres
```

4. Run database migrations:
```bash
npm run prisma:migrate
```

5. Seed the database:
```bash
npm run prisma:seed
```

6. Generate Prisma Client:
```bash
npm run prisma:generate
```

### Development

Start the development server:
```bash
npm run dev
```

The server will run on `http://localhost:3001`

### Database Management

- Open Prisma Studio: `npm run prisma:studio`
- Create migration: `npm run prisma:migrate`
- Reset database: `npx prisma migrate reset`

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Authentication (coming soon)
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Logout

## Environment Variables

See `.env.example` for all required environment variables.

## Project Structure

```
server/
├── src/
│   ├── config/       # Configuration files
│   ├── middleware/    # Express middlewares
│   ├── routes/       # API routes
│   ├── services/     # Business logic
│   ├── utils/        # Utility functions
│   └── index.ts       # Entry point
├── prisma/
│   ├── schema.prisma  # Database schema
│   ├── migrations/    # Database migrations
│   └── seed.ts        # Database seed
└── package.json
```








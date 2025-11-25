FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY server/package*.json ./
RUN npm ci

# Copy source code
COPY server/ ./

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY server/package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# Expose port
EXPOSE 3001

# Start server
CMD ["node", "dist/index.js"]



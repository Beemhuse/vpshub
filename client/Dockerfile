# ---- Build stage ----
FROM node:20-alpine AS build

WORKDIR /app

# Ensure dev dependencies are installed
ENV NODE_ENV=development

# Enable pnpm properly
RUN corepack enable

# Copy dependency files
COPY package.json pnpm-lock.yaml ./

# Install ALL deps (including dev)
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build
RUN pnpm build


# ---- Runtime stage ----
FROM nginx:1.25-alpine

# Remove default nginx config (optional but clean)
RUN rm /etc/nginx/conf.d/default.conf

# Copy your nginx config if you have one
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
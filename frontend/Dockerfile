# syntax=docker/dockerfile:1
FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY index.html tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts ./
COPY src/ ./src/
COPY public/ ./public/
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime
ENV BACKEND_SERVER_URL=http://backend:7000 \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1 \
    NGINX_ENVSUBST_FILTER="^(BACKEND_SERVER_URL|NGINX_LOCAL_RESOLVERS)$"
# The image entrypoint renders this template each time the container starts.
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist/ /usr/share/nginx/html/
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

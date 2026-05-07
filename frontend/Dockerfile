# syntax=docker/dockerfile:1.7

FROM node:22-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && pnpm install --frozen-lockfile

COPY . .

FROM base AS dev

EXPOSE 5173

CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]

FROM base AS build

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm build

FROM nginx:alpine AS runtime

# ngx_brotli isn't compiled into the upstream nginx image; pull it from the
# Alpine community repo. The module file lives at /usr/lib/nginx/modules/
# and is loaded explicitly in our nginx.conf.
RUN apk add --no-cache nginx-mod-http-brotli

COPY --from=build /app/dist /usr/share/nginx/html
# Override the upstream main config (we need top-level load_module directives
# for brotli; default.conf in conf.d would be too late).
COPY nginx.conf /etc/nginx/nginx.conf
RUN rm -f /etc/nginx/conf.d/default.conf

EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"]

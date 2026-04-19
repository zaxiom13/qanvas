# Qanvas cloud-q reference Dockerfile.
#
# This is a two-stage build:
#   1) build the static Qanvas web app so users can connect without npm
#   2) run a q process + the Node bridge that serves the app AND proxies ws
#
# You MUST provide a valid q license at build or run time. kdb+ is proprietary.
# Mount kc.lic via `docker run -v $PWD/kc.lic:/root/.kx/kc.lic ...` or copy it
# during CI. The Dockerfile does not bundle q; you must COPY it from your
# own base image.

# -------- build stage --------
FROM node:20-alpine AS build
WORKDIR /src
COPY package.json package-lock.json* ./
COPY app ./app
COPY packages ./packages
COPY server ./server
RUN npm install --no-audit --no-fund && npm run build

# -------- run stage --------
FROM node:20-bookworm-slim
WORKDIR /app

# Bring q into the image. One of the following strategies:
#   (a) COPY --from=registry.example.com/kx/q:latest /opt/kx /opt/kx
#   (b) COPY ./vendor/q-linux-64 /opt/kx
# Adjust to taste. At minimum /opt/kx/q and a license must be present at runtime.
ENV QHOME=/opt/kx
ENV PATH="/opt/kx:${PATH}"

# Copy only what's needed for runtime
COPY --from=build /src/app/dist ./app/dist
COPY --from=build /src/server ./server
COPY --from=build /src/node_modules ./node_modules
COPY --from=build /src/package.json ./package.json

ENV QANVAS_BRIDGE_PORT=8080
ENV QANVAS_Q_PORT=5042
ENV QANVAS_SPAWN_Q=true
ENV QANVAS_SERVE_DIST=true

EXPOSE 8080
CMD ["node", "server/q-bridge.js"]

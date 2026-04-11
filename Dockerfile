# Explicit Node image — avoids Nixpacks setup replacing the Node toolchain (npm not found).
FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git git-lfs \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Materialize Git LFS assets when the build context includes .git (optional).
RUN git lfs install 2>/dev/null; if [ -d .git ]; then git lfs pull; fi

ENV NODE_ENV=production

CMD ["npm", "start"]

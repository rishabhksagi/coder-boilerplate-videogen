FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

# System deps:
#   - chromium + libs           → headless rendering by Hyperframes engine
#   - chrome-headless-shell     → installed below for deterministic BeginFrame
#   - ffmpeg                    → frame encoding + audio mixing
#   - tini, curl, git, procps   → runtime/utility
#   - fonts-*                   → font coverage so emoji/CJK/UI render correctly
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl git unzip tini procps \
      ffmpeg chromium \
      libgbm1 libnss3 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdrm2 \
      libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libpangocairo-1.0-0 \
      libpango-1.0-0 libcairo2 libasound2 libxshmfence1 libgtk-3-0 \
      fonts-liberation fonts-noto-color-emoji fonts-noto-cjk fonts-noto-core \
      fonts-freefont-ttf fonts-dejavu-core fontconfig \
   && rm -rf /var/lib/apt/lists/* \
   && fc-cache -fv

# Tell Puppeteer to skip its Chrome download — we use chrome-headless-shell
# (installed next) plus Debian's chromium as a fallback.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    CONTAINER=true

# chrome-headless-shell powers the deterministic BeginFrame render path.
# Install as root, then resolve the real binary path (version-dependent) and
# symlink it to a stable location so daytona can execute it without
# permission issues.
RUN npx --yes @puppeteer/browsers install chrome-headless-shell@stable \
      --path /opt/puppeteer-cache \
 && SHELL_PATH=$(find /opt/puppeteer-cache/chrome-headless-shell -name "chrome-headless-shell" -type f | head -1) \
 && ln -sf "$SHELL_PATH" /usr/local/bin/chrome-headless-shell \
 && chmod -R a+rX /opt/puppeteer-cache \
 && chmod a+rx /usr/local/bin/chrome-headless-shell

ENV PRODUCER_HEADLESS_SHELL_PATH=/usr/local/bin/chrome-headless-shell

# Non-root sandbox user matching the convention used by the other
# coder-sandbox-* images (daytona at /home/daytona).
RUN useradd -m -s /bin/bash daytona

# Copy the boilerplate project into the canonical sandbox path.
COPY --chown=daytona:daytona . /home/daytona/project

WORKDIR /home/daytona/project
USER daytona

# Install Hyperframes (pinned in package.json) and warm npm cache.
RUN npm install --omit=dev

EXPOSE 5173

# Coder service starts the dev server via the template's `devCommand`
# (`node preview-proxy.js`). Keeping CMD as `sleep infinity` matches the
# pattern used by coder-boilerplate-threejs and coder-sandbox-expo.
ENTRYPOINT ["tini", "--"]
CMD ["sleep", "infinity"]

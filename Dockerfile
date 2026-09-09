# syntax=docker/dockerfile:1

# A static bundle: nothing to compile, so there is no build stage to run.
# nginx-unprivileged already listens on 8080 as uid 101, which lets the pod
# run with runAsNonRoot and a read-only root filesystem.
FROM nginxinc/nginx-unprivileged:1.27-alpine

LABEL org.opencontainers.image.title="beer-darts" \
      org.opencontainers.image.description="Touch-first darts scoreboard for X01 and Cricket" \
      org.opencontainers.image.licenses="MIT"

COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Left owned by root and world-readable: the nginx user serves the files but
# cannot rewrite them.
COPY index.html diag.html styles.css icon.svg manifest.webmanifest sw.js /usr/share/nginx/html/
COPY js/ /usr/share/nginx/html/js/

EXPOSE 8080

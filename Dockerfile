# syntax=docker/dockerfile:1

# Stage 1: stamp the service worker. The app itself needs no compiling, but
# sw.js names its cache after the build, and that name has to change whenever
# any shipped file does -- so it is a hash of all of them, worked out here
# rather than bumped by hand. Same base image as the final stage, so there is
# nothing extra to pull.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS stamp
USER root
WORKDIR /site
COPY index.html diag.html styles.css icon.svg manifest.webmanifest sw.js ./
COPY js/ js/
COPY img/ img/
RUN build="$(find . -type f | sort | xargs cat | sha256sum | cut -c1-12)" \
 && sed -i "s/__BUILD__/${build}/" sw.js \
 && grep -q "beer-darts-${build}" sw.js

# Stage 2: the image that runs. nginx-unprivileged already listens on 8080 as
# uid 101, which lets the pod run with runAsNonRoot and a read-only root
# filesystem.
FROM nginxinc/nginx-unprivileged:1.27-alpine

LABEL org.opencontainers.image.title="beer-darts" \
      org.opencontainers.image.description="Touch-first darts scoreboard for X01 and Cricket"

COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Left owned by root and world-readable: the nginx user serves the files but
# cannot rewrite them.
COPY --from=stamp /site/ /usr/share/nginx/html/

EXPOSE 8080

# Unified Dockerfile for Hugging Face Spaces
# Based on Stirling-PDF Dockerfile.unified

# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend .
RUN DISABLE_ADDITIONAL_FEATURES=false VITE_API_BASE_URL=/ npm run build

# Stage 2: Build Backend
FROM gradle:8.14-jdk21 AS backend-build
WORKDIR /app
COPY . .
RUN DISABLE_ADDITIONAL_FEATURES=false \
    ./gradlew clean build -x spotlessApply -x spotlessCheck -x test -x sonarqube

# Stage 3: Final unified image
FROM alpine:3.22.1

# Install all dependencies
RUN echo "@main https://dl-cdn.alpinelinux.org/alpine/edge/main" | tee -a /etc/apk/repositories && \
    echo "@community https://dl-cdn.alpinelinux.org/alpine/edge/community" | tee -a /etc/apk/repositories && \
    echo "@testing https://dl-cdn.alpinelinux.org/alpine/edge/testing" | tee -a /etc/apk/repositories && \
    apk upgrade --no-cache -a && \
    apk add --no-cache \
    ca-certificates tzdata tini bash curl shadow su-exec openssl openssl-dev \
    openjdk21-jre nginx gcompat libc6-compat libreoffice imagemagick poppler-utils \
    unpaper tesseract-ocr-data-eng ocrmypdf py3-opencv python3 py3-pip && \
    python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --upgrade pip setuptools && \
    /opt/venv/bin/pip install --no-cache-dir --upgrade unoserver weasyprint

# Copy backend files
COPY scripts /scripts
COPY app/core/src/main/resources/static/fonts/*.ttf /usr/share/fonts/opentype/noto/
COPY --from=backend-build /app/app/core/build/libs/*.jar app.jar

# Copy frontend files
COPY --from=frontend-build /app/dist /usr/share/nginx/html

# Copy configuration
COPY hf_nginx.conf /etc/nginx/nginx.conf
COPY docker/unified/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh /scripts/*

# Environment Variables for Hugging Face
ENV HOME=/home/stirlingpdfuser \
    PUID=1000 \
    PGID=1000 \
    UMASK=022 \
    MODE=BOTH \
    BACKEND_INTERNAL_PORT=8081 \
    VITE_API_BASE_URL=http://localhost:8080

# Setup directories and permissions
RUN mkdir -p $HOME /configs /logs /customFiles /pipeline /tmp/stirling-pdf && \
    addgroup -S stirlingpdfgroup && adduser -S stirlingpdfuser -G stirlingpdfgroup && \
    chown -R stirlingpdfuser:stirlingpdfgroup $HOME /scripts /configs /customFiles /pipeline /tmp/stirling-pdf /var/lib/nginx /var/log/nginx /usr/share/nginx && \
    chown stirlingpdfuser:stirlingpdfgroup /app.jar

# Hugging Face Spaces default port
EXPOSE 7860

ENTRYPOINT ["tini", "--", "/entrypoint.sh"]

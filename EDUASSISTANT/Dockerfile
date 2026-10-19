FROM node:22-alpine AS frontend-build
WORKDIR /workspace/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM maven:3.9.9-eclipse-temurin-17 AS backend-build
WORKDIR /workspace
COPY backend ./backend
RUN mvn -f backend/pom.xml -DskipTests package

FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
ENV APP_ENV=production \
    NODE_ENV=production \
    PROJECT_ROOT=/app \
    DATA_DIR=/app/storage \
    SEED_DEMO_DATA=false \
    ALLOW_ADMIN_VERIFIED_DEMO_SIS=false
COPY --from=backend-build /workspace/backend/target/eduassistant-backend.jar /app/eduassistant-backend.jar
COPY --from=frontend-build /workspace/frontend/dist /app/frontend/dist
COPY benchmark /app/benchmark
COPY docs /app/docs
RUN mkdir -p /app/storage
EXPOSE 3001
ENTRYPOINT ["java", "-Dfile.encoding=UTF-8", "-jar", "/app/eduassistant-backend.jar"]

# Stage 1: Build the React app
FROM node:20-slim AS build

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

# Bake in React env vars at build time
ARG REACT_APP_FIREBASE_API_KEY
ARG REACT_APP_FIREBASE_AUTH_DOMAIN
ARG REACT_APP_FIREBASE_PROJECT_ID
ARG REACT_APP_FIREBASE_STORAGE_BUCKET
ARG REACT_APP_FIREBASE_MESSAGING_SENDER_ID
ARG REACT_APP_FIREBASE_APP_ID
ARG REACT_APP_FIREBASE_MEASUREMENT_ID
ARG REACT_APP_CLOUDINARY_CLOUD_NAME
ARG REACT_APP_CLOUDINARY_UPLOAD_PRESET

RUN yarn build

# Stage 2: Serve with Nginx
FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html

# SPA fallback — route all paths to index.html
RUN echo 'server { \
  listen 8080; \
  location / { \
    root /usr/share/nginx/html; \
    index index.html; \
    try_files $uri $uri/ /index.html; \
  } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]

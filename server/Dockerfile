FROM denoland/deno:alpine-2.2.3

WORKDIR /app

COPY deno.json .

# Install dependencies (will create new lockfile)
RUN deno install --lock-write || deno install

# Copy source code
COPY app*.js middlewares.js session-service.js task-control.js task-service.js user-control.js user-service.js profile-control.js ./

# Remove lockfile if version incompatible
RUN rm -f deno.lock

CMD [ "run", "--allow-env", "--allow-net", "--no-lock", "app-run.js" ]
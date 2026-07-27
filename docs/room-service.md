# Room service persistence

Room state is stored in SQLite and shared across Next.js workers and restarts.

- `ROOM_DB_PATH` sets the database file. Production must point it at a mounted persistent volume.
- Forwarded client-IP headers are ignored by default and all requests without a trusted peer identity share the `anonymous` creation-rate bucket.
- Set `ROOM_TRUST_PROXY=1` only when Coolify/Cloudflare ingress strips any client-supplied forwarding headers and replaces `X-Forwarded-For` with exactly one validated client IP. Trusted mode rejects missing, malformed, or multi-hop values.
- The default is `data/rooms.sqlite` under the application working directory.
- SQLite uses WAL mode, a 5-second busy timeout, and immediate transactions for room mutations.
- Deployments should preserve the database file and its adjacent WAL/SHM files by mounting the containing directory.
- The service caps active rooms at 10,000, players at 12 per room, events at 100 per room, and room creation at five per client IP per minute.

## Coolify deployment

The production image runs the Next.js standalone server, including the room API, as
the unprivileged `nextjs` user (UID/GID 1001). It binds to `0.0.0.0:80` and includes
an HTTP container healthcheck.

Configure the Coolify application with:

- Dockerfile build pack and container port `80`.
- A persistent volume mounted at `/data`.
- `ROOM_DB_PATH=/data/rooms.sqlite` (the image supplies this default explicitly).
- `HOSTNAME=0.0.0.0` and `PORT=80` (also image defaults).
- A healthcheck path of `/` on port `80`.

The `/data` mount must be writable by UID/GID `1001`. Mount the directory, not only
the database file, because SQLite creates `rooms.sqlite-wal` and
`rooms.sqlite-shm` alongside the database.

Do not set `ROOM_TRUST_PROXY=1` unless the ingress satisfies the trusted-proxy
contract above. No secrets are required by the image or room service.

For a local production-equivalent check:

```sh
docker build -t bara-party-platform:local .
ROOM_DATA_DIR="$(mktemp -d)"
docker run --name bara-party-platform-volume-permissions \
  -v "$ROOM_DATA_DIR:/data" \
  alpine:latest chown -R 1001:1001 /data
docker run --name bara-party-platform-check \
  -p 127.0.0.1:8080:80 \
  -v "$ROOM_DATA_DIR:/data" \
  bara-party-platform:local
```

The temporary host directory is intentionally retained after the check so room
persistence can be inspected across container restarts.

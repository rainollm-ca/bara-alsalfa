# Room service persistence

Room state is stored in SQLite and shared across Next.js workers and restarts.

- `ROOM_DB_PATH` sets the database file. Production must point it at a mounted persistent volume.
- The default is `data/rooms.sqlite` under the application working directory.
- SQLite uses WAL mode, a 5-second busy timeout, and immediate transactions for room mutations.
- Deployments should preserve the database file and its adjacent WAL/SHM files by mounting the containing directory.
- The service caps active rooms at 10,000, players at 12 per room, events at 100 per room, and room creation at five per client IP per minute.

Task 11 should mount the database directory in the server container and must not use the old nginx static-export runner.

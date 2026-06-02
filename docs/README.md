# WereCode Documentation

## Documentation Index

- [ARCHITECTURE.md](ARCHITECTURE.md): Current Next/Supabase/Modal/local-backend split.
- [WORKFLOWS.md](WORKFLOWS.md): Root app, local download backend, and production workflow commands.
- [execution_docs/](execution_docs/): Migration and cleanup tracking.

## Current Shape

WereCode is a root Next.js app. The local Python backend is intentionally small
and only supports local YouTube download for development. Heavy music compute
belongs in Modal; durable product state belongs in Supabase and Next routes.

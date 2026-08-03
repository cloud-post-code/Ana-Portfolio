# Proof: NLWeb-ready structured data

## Primary proof command
```
node scripts/proof-nlweb-structured-data.js
```

The script starts the server on a test port, then asserts:
1. `GET /` contains a `application/ld+json` script whose parsed JSON includes a
   `Person` named "Ana Machuca" and an `ItemList` with at least 5 items.
2. `GET /project/hult` contains a `CreativeWork` JSON-LD object with the project name.
3. `GET /experience/far-out-ice-cream` contains a `CreativeWork` JSON-LD object.
4. `GET /schema.json` returns HTTP 200, `Content-Type: application/json`, an array of
   ≥ 5 objects, each with `@context`, `@type`, `name`, `url` (absolute).

Exit code 0 with `PROOF PASS` on success; non-zero with the failing assertion otherwise.

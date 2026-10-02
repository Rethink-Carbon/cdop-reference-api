# MCP

The API mounts a Model Context Protocol server at `/mcp` (Streamable HTTP, stateless). It calls the same services and HAL serialisers as the REST routes, so tool results carry `_links` and an agent can keep navigating. Reads are anonymous. Writes (M2) need an API key.

## Connecting

### Claude Code

```bash
claude mcp add --transport http cdop https://cdop.rethinkcarbon.co.uk/mcp
```

With a key for the write tools:

```bash
claude mcp add --transport http cdop https://cdop.rethinkcarbon.co.uk/mcp \
  --header "Authorization: Bearer cdop_<keyid>.<64hex>"
```

Against a local instance use `http://localhost:3000/mcp`.

### Claude Desktop

Claude Desktop launches local stdio servers, so bridge with `mcp-remote`. Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cdop": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://cdop.rethinkcarbon.co.uk/mcp"]
    }
  }
}
```

To send a key, add `"--header", "Authorization: Bearer cdop_<keyid>.<64hex>"` to `args`.

### ChatGPT and other header-less clients

Some connectors accept a URL but no custom headers. Put the token in the path instead:

```
https://cdop.rethinkcarbon.co.uk/mcp/cdop_<keyid>.<64hex>
```

The path form and the header form are equivalent. Anonymous read access needs neither.

### Verifying the connection

Call `whoami`. It returns the role the server sees (`anonymous` or the key's role), the API and schema versions, and the root links.

## Tools

| Tool                 | Description                                                                                                                                                                          | Milestone |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| `search_projects`    | Filter projects with CDOP field names (`standard`, `country_code`, `status`, `q`, `modified_since` and the rest); returns compact index rows with links and a `next` cursor.         | M1        |
| `get_project`        | One project with `status`, `lifecycle_stage`, `registry_status` and its links.                                                                                                       | M1        |
| `get_cdop_document`  | A schema-pure document for a project or unit (`pod` = `full-list`, `location-details`, …) plus an Ajv `conformance` report.                                                          | M1        |
| `list_units`         | Unit blocks for a project, issuance or account; `limit` up to 250.                                                                                                                   | M1        |
| `get_unit`           | One credit block with its state, reason, CDOP status, owner and lineage links.                                                                                                       | M1        |
| `list_issuances`     | Issuance batches for a project.                                                                                                                                                      | M1        |
| `list_validations`   | Validation events for a project.                                                                                                                                                     | M1        |
| `list_verifications` | Verification events for a project (monitoring period, quantities, deductions).                                                                                                       | M2        |
| `list_estimations`   | Estimations with per-vintage rows.                                                                                                                                                   | M1        |
| `get_status_history` | Status records for a project or unit, newest first, with timestamps and actors.                                                                                                      | M1        |
| `list_events`        | Pull a page of CloudEvents since a sequence (streaming stays with SSE and webhooks).                                                                                                 | M2        |
| `explain_schema`     | Describe a field path or entity from the vendored schema: type, format, enum, cardinality, mutability, public or private, data source, field id.                                     | M1        |
| `list_enum`          | The values of an enum by field path (for example `unit.status[].status`).                                                                                                            | M1        |
| `validate_payload`   | Run Ajv on any payload against a pod schema; returns errors with instance and schema paths.                                                                                          | M1        |
| `get_state_machine`  | The transition table for `project`, `unit`, `issuance`, `estimation` or `geolocation_file`, with the lifecycle mapping tables.                                                       | M2        |
| `propose_transition` | Dry-run an action on a resource: says whether it is legal from the current state for the caller's role and what it would emit. With a keyed role and `execute: true` it performs it. | M2        |
| `whoami`             | The caller's role, versions and root links.                                                                                                                                          | M1        |

Results follow the platform's discipline: index-versus-detail (lists are compact, details are full), `structuredContent` with a text fallback, a `hint` when a result was truncated, and links in every payload.

## Resources

| URI                              | Content                                                                                |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| `cdop://schemas/{file}`          | A vendored schema file, for example `cdop://schemas/Full_List.schema.json`.            |
| `cdop://enums/{field_path}`      | The enum for a field path, for example `cdop://enums/project.status[].project_status`. |
| `cdop://state-machines/{entity}` | The transition table for an entity.                                                    |
| `cdop://openapi`                 | The OpenAPI 3.1 document.                                                              |
| `cdop://rels/{rel}`              | The documentation page of a link relation.                                             |
| `cdop://feedback`                | The schema-feedback register (`SCHEMA-FEEDBACK.md`).                                   |
| `cdop://projects/{id}`           | A resource template: one project by id.                                                |

## Prompts

| Prompt                  | What it does                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `explore_project`       | Walk a project from its root link through status history, documents, geometry and units, and summarise.                 |
| `schema_gap_report`     | Compare a document with its schema and the feedback register, and draft new `CDOP-FB` entries for anything unexplained. |
| `retire_units_workflow` | Find active blocks for an account, dry-run a retirement with `propose_transition`, then execute with a keyed role (M2). |
| `sync_since`            | Pull events since a sequence, group them by project, and report what changed (M2).                                      |

## Authentication

- Anonymous: every read tool and resource. Rate limited per IP.
- `Authorization: Bearer cdop_<keyid>.<64hex>`: unlocks write tools according to the key's role (`developer`, `vvb`, `code_admin`, `registry`, `admin`, `sandbox`). Keys are stored as SHA-256 hashes.
- `/mcp/<token>`: the same key in the path, for clients that cannot set headers. Treat the URL as a secret.

The REST API and the MCP server share one authentication middleware, so a key behaves the same on both.

## Trying it

```bash
npx -y @modelcontextprotocol/inspector
```

In the inspector choose the Streamable HTTP transport and enter `https://cdop.rethinkcarbon.co.uk/mcp` (or your local URL), then list the tools.

Then in a client: `search_projects` with `standard: "wcc"`, `get_cdop_document` with `pod: "full-list"` and read the `conformance` block, `list_enum` with `unit.status[].status`, and `propose_transition` on an active unit with `action: "retire"` (M2).

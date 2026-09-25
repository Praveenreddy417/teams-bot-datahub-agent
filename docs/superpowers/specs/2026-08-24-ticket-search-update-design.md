# Ticket Search & Update (ServiceNow Connector) — Design

## Purpose

Let a Teams user search an existing ticket (currently ServiceNow, ADO reserved for later) by incident number, view its details, and — if the ticket is Open — add a work note update, all via Adaptive Cards in the existing bot.

## Trigger

Typing `/ticket` in the bot sends an empty search card (dropdown + input). This mirrors existing text commands (`/help`, `/whoami`, `/diag`) in [app.ts](../../../app.ts). `buildHelpCard` in [src/Cardbuilder.ts](../../../src/Cardbuilder.ts) gets a new `FactSet` row `{ title: "/ticket", value: "Search & update a ServiceNow ticket" }` next to `/help`/`/whoami`.

## New files

### `src/TicketConnectorService.ts`

Mirrors the style of [src/Ticketservice.ts](../../../src/Ticketservice.ts) (never throws; returns typed result; logs request/response).

```ts
export interface TicketSearchPayload {
  tickting_tool: "ServiceNow" | "ADO";
  incident_nb: string;
}

export interface TicketDetails {
  incident_number: string;
  short_description: string;
  description: string;
  state: string;
  priority: string;
  impact: string;
  urgency: string;
  category: string;
  opened_at: string;
  status: string;
}

export interface TicketSearchResult {
  success: boolean;
  message: string;
  ticket?: TicketDetails;
}

export interface TicketUpdatePayload {
  incident_nb: string;
  work_notes: string;
}

export interface TicketUpdateResult {
  success: boolean;
  message: string;
  incidentNumber?: string;
}

export function searchTicket(payload: TicketSearchPayload): Promise<TicketSearchResult>;
export function updateTicket(payload: TicketUpdatePayload): Promise<TicketUpdateResult>;
```

- `searchTicket` — `POST TICKET_SEARCH_URL` (default `https://apibaseqa.easystepin.com:9093/ws/rest/teams_bot/Tickets_Connectors/Get_ServiceNow`) with `{ tickting_tool, incident_nb }`. Success = `Status_Code === "200"` and `Status_Response` is `"Success"` (case-insensitive). On success, `ticket` is the response minus the status fields.
- `updateTicket` — `POST TICKET_UPDATE_URL` (default `https://apibaseqa.easystepin.com:9093/ws/rest/teams_bot/Tickets_Connectors/Update`) with `{ incident_nb, work_notes }`. Success same rule; `Status_Message` becomes the result message.
- `closeTicket` — `PUT TICKET_CLOSE_URL` (default `https://apibaseqa.easystepin.com:9093/ws/rest/teams_bot/Tickets_Connectors/Close`) with `{ incident_nb, state: "7", close_code, close_notes }`. `state` is fixed to `"7"` (ServiceNow's Resolved/Closed code) — not user-entered. Same success rule; `Status_Message` becomes the result message.
- HTTP/network errors and non-200 responses both resolve to `{ success: false, message }` — never throw, same as `createTicket`.

### `src/TicketSearchCard.ts`

Card builders, same shape/style conventions as [src/Cardbuilder.ts](../../../src/Cardbuilder.ts) and [src/Ticketresultcard.ts](../../../src/Ticketresultcard.ts):

- `buildTicketSearchCard(errorMessage?)` — `Input.ChoiceSet` `id: "tickting_tool"` with choices ServiceNow (value `ServiceNow`) and ADO (value `ADO`), default ServiceNow; `Input.Text` `id: "incident_nb"` placeholder `INC0010064`; one `Action.Submit` "🔍 Search" with `data: { actionType: "searchTicket" }`. If `errorMessage` given, show it in attention color above the inputs (used for "not found" / "ADO not available yet" / validation).
- `buildTicketDetailCard(ticket: TicketDetails)` — header showing `incident_number` + `status`, `FactSet` with short_description, description, state, priority, impact, urgency, category, opened_at. If `ticket.status.toLowerCase() === "open"`, add two buttons: `Action.Submit` "✏️ Update Ticket" (`data: { actionType: "openUpdateNotes", incident_nb }`) and `Action.Submit` "🔒 Close Ticket" (`data: { actionType: "openCloseTicket", incident_nb }`). Neither shown once Closed.
- `buildUpdateNotesCard(incident_nb: string)` — shows the incident number, `Input.Text` `id: "work_notes"` `isMultiline: true`, `Action.Submit` "✅ Submit Update" with `data: { actionType: "submitTicketUpdate", incident_nb }`.
- `buildUpdateResultCard(result: TicketUpdateResult)` — success/attention container (same visual pattern as `buildTicketResultCard`) showing incident number + message. No further action buttons — confirmation only, no re-fetch.
- `buildCloseTicketCard(incident_nb: string)` — `Input.Text` `id: "close_code"` (defaulted to `"Solution provided"`) and `Input.Text` `id: "close_notes"` `isMultiline: true`, `Action.Submit` "🔒 Confirm Close" with `data: { actionType: "submitTicketClose", incident_nb }`.
- `buildCloseResultCard(result: TicketCloseResult)` — same confirmation-only pattern as the update result card.

## Wiring into `app.ts`

All new branches go inside the existing `if (activity.value)` block in the `message` handler, alongside the current `createTicket` branch:

```
actionType === "searchTicket"
  → tool = value.tickting_tool, incident_nb = value.incident_nb.trim()
  → if !incident_nb: re-send search card with "Enter an incident number." error
  → if tool === "ADO": re-send search card with "ADO is not available yet — please choose ServiceNow." error
  → else: call searchTicket({ tickting_tool: tool, incident_nb })
      → not found / failure: re-send search card with result.message as error
      → success: send buildTicketDetailCard(result.ticket)

actionType === "openUpdateNotes"
  → send buildUpdateNotesCard(value.incident_nb)   // incident_nb round-trips via card action `data`, no server-side session needed

actionType === "submitTicketUpdate"
  → call updateTicket({ incident_nb: value.incident_nb, work_notes: value.work_notes })
  → send buildUpdateResultCard(result)

actionType === "openCloseTicket"
  → send buildCloseTicketCard(value.incident_nb)

actionType === "submitTicketClose"
  → call closeTicket({ incident_nb: value.incident_nb, close_code: value.close_code, close_notes: value.close_notes })   // state "7" is added inside closeTicket, not user input
  → send buildCloseResultCard(result)
```

Plain-text branch: add `if (textLower === "/ticket") { await context.send(buildTicketSearchCard()); return; }` next to the existing `/help`/`/whoami`/`/diag` checks.

## Manifest

[appPackage/manifest.json](../../../appPackage/manifest.json) `bots[0].commandLists[0].commands` currently only lists `Hi`. Add a `/ticket` entry: `{ "title": "/ticket", "description": "Search & update a ServiceNow ticket." }`, so Teams shows it as a suggested command.

## Config

Two new optional env vars in `env/.env.local`, each with the given URL as the code-level default (same pattern as `TICKET_CREATE_URL` in [src/Ticketservice.ts](../../../src/Ticketservice.ts)):

- `TICKET_SEARCH_URL`
- `TICKET_UPDATE_URL`
- `TICKET_CLOSE_URL`

## Error handling

- Empty incident number, ADO selection, ticket-not-found, and update failure all re-render the relevant card with an inline error message (attention color) rather than a generic error card — keeps the user in the flow instead of dead-ending.
- Unexpected exceptions (network errors thrown despite the service's try/catch, malformed JSON, etc.) fall through to the handler's existing outer `catch` → `buildErrorCard`.

## Out of scope

- ADO connector implementation (no API given yet — dropdown option shown but blocked with a message).
- Any server-side session/state for the search→update flow — incident number is carried entirely through Adaptive Card `Action.Submit` `data`, consistent with how the existing MDM alert card carries its fields.

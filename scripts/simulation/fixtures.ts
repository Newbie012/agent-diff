export type FileFixture = {
  readonly path: string
  readonly before: ReadonlyArray<string>
  readonly after: ReadonlyArray<string>
}

export type BranchFixture = {
  readonly name: string
  readonly files: ReadonlyArray<FileFixture>
}

const incidentsBefore = [
  "import { client } from './client'",
  "",
  "export const fetchIncidents = async (tenant: string) => {",
  "  const res = await client.get(`/tenants/${tenant}/incidents`)",
  "  return res.json()",
  "}",
  "",
  "export const fetchIncident = async (tenant: string, id: string) => {",
  "  const res = await client.get(`/tenants/${tenant}/incidents/${id}`)",
  "  return res.json()",
  "}",
]

const incidentsAfter = [
  "import { client } from './client'",
  "import { IncidentNotFound, Upstream } from './errors'",
  "",
  "export const fetchIncidents = async (tenant: string) => {",
  "  const res = await client.get(`/tenants/${tenant}/incidents`)",
  "  if (!res.ok) throw new Upstream(res.status)",
  "  return res.json()",
  "}",
  "",
  "export const fetchIncident = async (tenant: string, id: string) => {",
  "  const res = await client.get(`/tenants/${tenant}/incidents/${id}`)",
  "  if (res.status === 404) throw new IncidentNotFound(id)",
  "  if (!res.ok) throw new Upstream(res.status)",
  "  return res.json()",
  "}",
]

const errorsAfter = [
  "export class IncidentNotFound extends Error {",
  "  constructor(readonly id: string) {",
  "    super(`incident ${id} does not exist`)",
  "  }",
  "}",
  "",
  "export class Upstream extends Error {",
  "  constructor(readonly status: number) {",
  "    super(`incidents upstream returned ${status}`)",
  "  }",
  "}",
]

const panelBefore = [
  "export function IncidentPanel({ tenant }: { tenant: string }) {",
  "  const { data } = useIncidents(tenant)",
  "",
  "  if (!data) return <Spinner />",
  "",
  "  return (",
  "    <ul>",
  "      {data.map((incident) => (",
  "        <li key={incident.id}>{incident.title}</li>",
  "      ))}",
  "    </ul>",
  "  )",
  "}",
]

const panelAfter = [
  "export function IncidentPanel({ tenant }: { tenant: string }) {",
  "  const { data, error } = useIncidents(tenant)",
  "",
  "  if (error instanceof IncidentNotFound) return <Empty reason=\"deleted\" />",
  "  if (error) return <Failed onRetry={() => refetch(tenant)} />",
  "  if (!data) return <Spinner />",
  "",
  "  return (",
  "    <ul>",
  "      {data.map((incident) => (",
  "        <li key={incident.id}>{incident.title}</li>",
  "      ))}",
  "    </ul>",
  "  )",
  "}",
]

const legacyBefore = [
  "export const normalise = (raw: any) => ({",
  "  id: raw.incident_id,",
  "  title: raw.incident_title,",
  "})",
]

const configBefore = [
  "# Incidents",
  "",
  "The incidents API returns an empty array when a tenant has none.",
  "A missing tenant is indistinguishable from an empty one.",
]

const configAfter = [
  "# Incidents",
  "",
  "The incidents API returns an empty array when a tenant has none.",
  "",
  "A missing incident raises `IncidentNotFound`, and any other non-2xx",
  "raises `Upstream` carrying the status. Callers can tell the three apart.",
]

export const fixtures: ReadonlyArray<BranchFixture> = [
  {
    name: "cdr-42-distinguish-missing-incidents",
    files: [
      { path: "src/api/incidents.ts", before: incidentsBefore, after: incidentsAfter },
      { path: "src/api/errors.ts", before: [], after: errorsAfter },
      { path: "docs/incidents.md", before: configBefore, after: configAfter },
    ],
  },
  {
    name: "cdr-57-panel-handles-failure",
    files: [
      { path: "src/ui/IncidentPanel.tsx", before: panelBefore, after: panelAfter },
      { path: "src/api/legacy.ts", before: legacyBefore, after: [] },
    ],
  },
  {
    name: "cdr-61-retry-upstream",
    files: [
      {
        path: "src/api/retry.ts",
        before: [],
        after: [
          "export const retry = async <A>(run: () => Promise<A>, times = 3): Promise<A> => {",
          "  try {",
          "    return await run()",
          "  } catch (cause) {",
          "    if (times <= 1) throw cause",
          "    return retry(run, times - 1)",
          "  }",
          "}",
        ],
      },
    ],
  },
]

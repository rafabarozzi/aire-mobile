export const demoOrgs = [
  { id: "varejo", name: "Banco Varejo" },
  { id: "relacional", name: "Banco Relacional" },
];
const ids = [1, 2, 3].map((n) => "10000000-0000-4000-8000-00000000000" + n);
export function demo(tenant, scenario = "normal", clock = Date.now()) {
  const stamp = (m) => new Date(clock + m * 60000).toISOString();
  const journeys =
    tenant === "varejo"
      ? [
          { id: "pix", name: "Transferências Pix", health: "Indisponível" },
          { id: "cartoes", name: "Compras com cartão", health: "Degradada" },
          {
            id: "credito",
            name: "Contratação de crédito",
            health: "Sem leitura",
          },
          { id: "saldo", name: "Consulta de saldo", health: "Saudável" },
        ]
      : [
          {
            id: "recebiveis",
            name: "Antecipação de recebíveis",
            health: "Sem leitura",
          },
        ];
  const incidents =
    tenant === "varejo"
      ? [
          [
            "Transferências Pix interrompidas",
            "Clientes não conseguem concluir transferências.",
            "P1",
            "pix",
            "unavailable",
            "investigation",
            "datadog",
            "Pagamentos",
            -3,
            null,
          ],
          [
            "Compras com autorização lenta",
            "Parte das compras leva mais tempo para confirmar.",
            "P2",
            "cartoes",
            "degraded",
            "mitigation",
            "dynatrace",
            "Cartoes",
            12,
            -5,
          ],
          [
            "Propostas aguardando análise",
            "A extensão do impacto ainda está em avaliação.",
            "P3",
            "credito",
            "assessing",
            "monitoring",
            "manual",
            "Credito",
            20,
            25,
          ],
        ].map(
          (
            [
              title,
              business_impact,
              severity,
              journey,
              impact,
              state,
              origin,
              team,
              next,
              eta,
            ],
            n,
          ) => ({
            id: ids[n],
            tenant,
            title,
            business_impact,
            severity,
            journeys: [{ id: journey, impact }],
            state,
            origin,
            team,
            version: 2,
            coordinator: "gestao",
            affected_public: null,
            extent: null,
            duplicate_of: null,
            policy_override: null,
            pause: null,
            rooms:
              n === 2
                ? []
                : [
                    {
                      provider: n ? "slack" : "teams",
                      room_id: "demo-" + n,
                      state: n ? "requested" : "open",
                      confirmation: null,
                    },
                  ],
            references:
              n === 0
                ? [
                    {
                      provider: "servicenow",
                      identifier: "INC-DEMO-42",
                      sync_state: "synced",
                      ticket_state: "Em andamento",
                    },
                  ]
                : [],
            last_update: stamp(-12),
            next_update: stamp(next),
            forecast: {
              at: eta ? stamp(eta) : null,
              status:
                eta === null ? "unknown" : eta < 0 ? "overdue" : "confirmed",
              author: eta ? "gestao" : null,
              recorded_at: eta ? stamp(-12) : null,
            },
          }),
        )
      : [];
  async function wait() {
    await new Promise((r) => setTimeout(r, 220));
    if (scenario === "error") throw new Error("Falha simulada");
  }
  return {
    async overview() {
      await wait();
      return { incidents, journeys, catalogAvailable: true };
    },
    async detail(id) {
      await wait();
      const incident = incidents.find((i) => i.id === id);
      if (!incident)
        throw Object.assign(new Error("Indisponível"), { status: 404 });
      return {
        incident,
        events: ["Incidente identificado", "Equipe responsável acionada"].map(
          (s, n) => ({
            id: "20000000-0000-4000-8000-0000000000" + id.slice(-1) + (n + 1),
            incident_id: id,
            version: n + 1,
            kind: n ? "updates" : "create",
            origin: incident.origin,
            author: incident.team,
            fact_at: stamp(n ? -12 : -30),
            recorded_at: stamp(n ? -12 : -30),
            data: { situation: s },
          }),
        ),
      };
    },
    async joinRoom(id, room) {
      return id === ids[0] && room.state === "open" ? "demo" : null;
    },
  };
}

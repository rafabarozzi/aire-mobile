# Integração móvel v1

## Leituras existentes

Referência inspecionada em [aire-operations, revisão 26647cb](https://github.com/rafabarozzi/aire-operations/tree/26647cbfad5f26a50507a6f8bc396b63517a82e6/contracts/v1). O app usa apenas leituras, em HTTPS com bearer do tenant ativo.

| Tela | Recurso Operations v1 | Interpretação |
| --- | --- | --- |
| Central | GET /v1/incidents?limit=100&offset=N | Paginar até a última página, deduplicar por ID, excluir resolved, closed e duplicatas. Ordenar pelo maior impacto observado nas jornadas, depois por severidade e título. |
| Detalhe | GET /v1/incidents/{id} | Conferir tenant e ID. Exibir impact, equipe, forecast, next_update, origin, references e rooms separadamente. |
| Linha do tempo | GET /v1/incidents/{id}/timeline?after_version=N&limit=100 | Avançar pela versão do evento e mostrar os eventos recentes primeiro, com horário do fato. |
| Comunicação | GET /v1/publications/management/{id} | Disponível em Operations para usuários com read:management. Consumo das publicações aprovadas é uma extensão futura. |

As origens são manual, datadog e dynatrace. ServiceNow e Jira Service Management identificam o destino de registro do INC. Um impacto recovered pertence àquela associação incidente/jornada. A saúde global depende de uma leitura independente. Até existir o catálogo autorizado, a integração real exibe apenas jornadas referenciadas e **Sem leitura**. O relógio local, atualizado a cada 15 s, distingue previsão indefinida, confirmada e vencida. O aviso de próxima comunicação respeita a pausa explícita do contrato.

O contrato Room publica provider, room_id e state. O app não monta uma URL a partir de room_id. A demonstração exercita acesso concedido. O adaptador real mantém a ação indisponível até existir uma operação autorizada que devolva um link efêmero para o usuário e incidente, com domínio HTTPS permitido e validação de tenant/RBAC no servidor.

## Identidade e organizações

O [portal AIRE](https://github.com/rafabarozzi/aire-front/blob/main/docs/identity.md) suporta Google e Entra ID e mantém uma sessão de navegador em cookie HttpOnly. O aplicativo usa navegador do sistema e Authorization Code com PKCE S256 e state. O emissor móvel deve federar os provedores da organização e emitir tokens AIRE. Registrar cliente público e o redirect exato com.northeia.aire://oauth/callback. O app não utiliza client secret nem ID token como autorização da API. Identificadores de pacote, redirect e posse do domínio devem ser confirmados pela integração antes de assinatura ou distribuição.

**Contrato proposto ao serviço de identidade, ainda não publicado**:

| Operação | Autorização e resposta esperada |
| --- | --- |
| GET /mobile/v1/me | Access token do cliente móvel. Retorna organizations, lista de objetos com id e name autorizados. |
| POST /mobile/v1/organization-session | Mesmo bearer e corpo com organization_id. O servidor revalida vínculo e retorna tenant, access_token e expires_at (ISO com fuso). |
| Leituras Operations | Token RS256 com iss, aud=aire-operations-v1, sub, exp, iat, tenant, roles e azp. O backend precisa incluir o client_id na allowlist e conceder reader ou papel autorizado. |

O token base fica em SecureStore. O token curto por organização permanece apenas na memória. A inicialização começa com sessão limpa e exige novo login. A troca desmonta a visão, descartando cache, favoritos, preferências sintéticas e token do tenant anterior. A sessão expirada e respostas 401/403 encerram o acesso. Favoritos duram a sessão da organização nesta versão.

Listas e detalhes já visitados são mantidos em memória. Uma leitura falha conserva a última resposta válida com aviso. Sem rede o app indica offline; após 2 minutos sem sincronização marca a leitura como desatualizada. Ao voltar ao primeiro plano ou a cada minuto em primeiro plano, consulta novamente. Nenhum dado de incidente ou evento é escrito em disco pelo app.

## Notificações

O transporte proposto usa token nativo APNs/FCM com expo-notifications. A ação de registro físico permanece desabilitada até o gateway implementar o contrato. A simulação usa um registro em memória por organização e o mesmo contrato de registro/revogação.

| Operação proposta | Comportamento exigido ao gateway |
| --- | --- |
| PUT /mobile/v1/device | Bearer do tenant. Recebe device {platform, token} e preferences {tenant, severities, journeys}. Revalidar escopo permitido, fazer upsert idempotente e expirar associação junto à sessão. Lista vazia de jornadas permite todas as autorizadas; severidades vazias silenciam o dispositivo. |
| POST /mobile/v1/device/revoke | Mesmo device e bearer. Remoção idempotente da associação, inclusive para tokens rotacionados. |
| Envio | Filtrar tenant, associação ativa, vínculo atual, jornada e severidade. Deduplicar por organização, dispositivo e event_id antes do envio. Remover tokens inválidos e cancelar vínculos após logout, troca de conta ou revogação de acesso. |

Usar texto fixo na tela bloqueada, por exemplo **AIRE · Nova atualização disponível**. O payload de dados aceita apenas tenant, incident_id, event_id e kind (opened, impact_changed, updated, normalized). O cliente rejeita eventos desconhecidos, guarda os 200 últimos identificadores da sessão e valida a organização antes de navegar para com.northeia.aire://incident/{tenant}/{uuid}. A consulta de detalhe usa a API com autorização atual. A deduplicação durável e a revalidação de acesso são responsabilidades do remetente. Em homologação, validar também rotação de token, falha de revogação offline, entrega duplicada após reiniciar o app, abertura fria e entrega após retirada de permissão.

## Escolha e validação de plataforma

React Native + Expo atende à base compartilhada e permite development builds com módulos nativos para navegador, Keychain/Keystore e notificações. O código JavaScript é compartilhado e os binários têm provisionamento separado. Um requisito corporativo de broker nativo, MDM ou acesso condicional por dispositivo deve ser validado com o tenant real de Entra antes de aprovar a distribuição.

| Ambiente | Evidência ou dependência |
| --- | --- |
| Local, sem contas externas | Testes de domínio, navegação simulada, contrato de transporte e exportação Hermes iOS/Android. |
| Aparelho ou simulador | Development build instalado. Validar fontes ampliadas, leitor de tela, retorno, offline e callback OIDC. |
| Homologação SSO | Cliente móvel registrado, federação Google/Entra, redirects autorizados, gateway de identidade, assinatura confiável em Operations e usuários em duas organizações. |
| Push real | Habilitar entitlement iOS, chave APNs, projeto Firebase/FCM e configuração Android, permissões do usuário, gateway de dispositivos e distribuição de builds assinados. |
| Distribuição interna | Android pode usar APK assinado. No iOS, distribuição ad hoc requer aparelhos registrados e perfil válido; TestFlight requer App Store Connect. Não há automação de build remoto, submissão ou publicação neste repositório. |

Documentação oficial consultada: [autenticação](https://docs.expo.dev/guides/authentication/), [armazenamento seguro](https://docs.expo.dev/versions/v56.0.0/sdk/securestore/), [configuração push](https://docs.expo.dev/push-notifications/push-notifications-setup/), [credenciais de assinatura](https://docs.expo.dev/app-signing/app-credentials/) e [distribuição interna](https://docs.expo.dev/build/internal-distribution/).

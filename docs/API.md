# API da versão 7

Servidor: `server/index.mjs`. As operações usam JSON. Login e instalação retornam token Bearer; as demais rotas exigem `Authorization: Bearer <token>`. `X-Campaign-ID` seleciona explicitamente uma campanha autorizada; o servidor conserva uma escolha por sessão quando esse cabeçalho está ausente.

| Rotas principais | Operação |
|---|---|
| `GET /auth/status` | Informa se a instalação inicial é necessária |
| `POST /auth/bootstrap` | Instalação com `bootstrap_token`, nome, login e senha |
| `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | Autenticação |
| `POST /auth/password`, `GET/PATCH /api/profile` | Própria senha e perfil |
| `GET/POST /api/campaigns`, `PATCH /api/campaigns/:id` | Campanhas |
| `POST /api/campaigns/:id/select` | Escolha por conexão |
| `GET /api/campaign`, `GET /api/sync` | Dados autorizados e revisão |
| `GET /api/characters`, `GET/PATCH/DELETE /api/characters/:id` | Fichas |
| `POST /api/admin/characters`, `POST /api/characters/import` | Cadastro/importação pelo narrador |
| `GET /api/characters/:id/upgrade-preview`, `POST /api/characters/:id/upgrade` | Planejamento e compra com XP |
| `POST /api/admin/xp/distribute` | XP por personagem para um conjunto de fichas |
| `GET/POST/PATCH /api/quests[/id]` | Leitura autorizada e gestão pelo narrador |
| `POST /api/quests/:id/complete` | Entrega única pelo narrador, com valores finais opcionais no corpo |
| `GET /api/network?character_id=:id` | Mural do personagem do próprio jogador |
| `POST/PATCH/DELETE /api/network/nodes[/id]` e `/links[/id]` | Mural; corpo inclui `character_id` |
| `/api/maps`, `/api/maps/:id`, `/api/maps/:id/pins[/id]` | Atlas e marcadores |
| `/api/submissions`, `/api/submissions/:id/approve`, `/review` | Propostas de personagens e parecer |
| `/api/admin/accounts`, `/api/characters/:id/assign`, `/api/admin/trash` | Acessos, transferências e restauração |
| `GET/PUT /api/game`, `DELETE /api/rulebook/catalog/:key/:id` | Livro |
| `GET /api/json/workspace`, `GET /api/json/player`, `POST /api/json/replace` | Backups e importação |

Para leituras com parâmetros estruturados (por exemplo, cotação de evolução), o cliente codifica o objeto em `?data=<JSON>`. Credenciais são enviadas somente no corpo de requisições POST. O cabeçalho `X-Portal-Revision` acompanha as respostas autenticadas.

Edições de fichas usam `revision`; livro usa `_expected_revision`; registros usam `_revision` retornada como `revision` no envio. Conflitos são HTTP 409. A distribuição de XP recebe `request_id`, `character_ids`, `revisions`, `amount`, `reason` e `confirmed: true`.

O mural rejeita narradores e verifica a propriedade do personagem em toda ação, incluindo ligações e movimento. Missões são filtradas por participação. O servidor não oferece as antigas rotas de importação pública ou tokens de narrador por URL.

O contrato completo de cada comando permanece nos módulos de serviço em `core/`, utilizados pela API. Verifique [PERMISSOES.md](PERMISSOES.md).

## Rotas da versão 7

- `GET /api/portal-state`: estado inicial autorizado em uma resposta, sem contas internas ou sessões.
- `GET /api/members/:id`: perfil público de participante da campanha.
- `GET/POST /api/social`, `DELETE /api/social/:id`: recados, lembretes e cutucadas. `to` restringe o destinatário; ausência indica a campanha.
- `DELETE /api/notifications[/id]`, `POST /api/notifications/read-all`: gerência da própria caixa.
- `DELETE /api/quests/:id`: exclusão pelo narrador, sem estornar entregas.
- `POST /api/quests/:id/complete`: aceita `xp_reward`, `money_reward`, `items` e `completion_note` finais; salva `delivered_rewards` e mantém a previsão.
- `DELETE /api/campaigns/:id`: exige `confirmation` igual ao nome da campanha.
- `DELETE /api/characters/:id/logs/:kind`: `history`, `transactions` ou `rolls`; exige revisão e índice, ou `confirmation: "LIMPAR"`.
- `DELETE /api/submissions/:id`: autor ou narrador, com revisão.
- `DELETE /api/admin/trash/purge`: confirmação textual; pode indicar `type` e `id` para um registro.
- `DELETE /api/admin/snapshots`: elimina revisões da campanha.
- `POST /api/admin/reset`: exige `confirmation: "ZERAR PORTAL"`, revoga o acesso e volta ao bootstrap.

O frontend usa `X-Portal-Session: cookie`, credenciais de mesma origem e cookie persistente HttpOnly. Respostas de login nesse modo não incluem o token no JSON. Bearer continua disponível para clientes programáticos. Alterações autenticadas somente por cookie exigem Origin autorizado.

Mapas aceitam `mode: "image"` ou `"geographic"`. O geográfico usa `center: {lat,lng,zoom}`; marcadores incluem `lat/lng`, posições normalizadas `x/y`, `images` e `npcs`. Os limites e permissões são validados no servidor.

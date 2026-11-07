# API da versão 9

Servidor: `server/index.mjs`. As operações usam JSON. O site autentica por cookie HttpOnly; clientes programáticos podem usar `Authorization: Bearer <token>`. Login e instalação retornam token somente no modo Bearer. `X-Campaign-ID` seleciona explicitamente uma campanha autorizada; o servidor conserva uma escolha por sessão quando esse cabeçalho está ausente.

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

## Portal, comunidade e administração

- `GET /api/portal-state`: estado inicial autorizado em uma resposta, sem contas internas ou sessões.
- `GET /api/members/:id`: perfil público de participante da campanha.
- `GET/POST /api/social`, `DELETE /api/social/:id`: mensagens privadas e interações sociais; criar exige `to` de um participante da campanha. Publicações públicas antigas são migradas para Anotações.
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

## Expansão 8

As rotas abaixo usam a mesma autenticação, seleção de campanha e revisão da versão anterior.

| Rota | Método | Controle |
| --- | --- | --- |
| `/api/intel` | GET | Apresentações das informações; conteúdo reservado só ao narrador ou depois de comprado |
| `/api/intel` | POST | Narrador cadastra título, categoria, teaser, capa, segredo, imagens e preços |
| `/api/intel/:id` | GET/PATCH/DELETE | Consulta autorizada; escrita só do narrador, com `revision` |
| `/api/intel/:id/purchase` | POST | Jogador paga com uma ficha própria; revisão, preço, saldo e confirmação conferidos |
| `/api/discipline-market/:id/acquire` | POST | Jogador adquire disciplina permitida pelo preço configurado, nível inicial 0 |
| `/api/maps/:id/characters/:characterId` | PUT/PATCH/DELETE | Responsável pela ficha controla posição e visibilidade |
| `/api/social/:id/respond` | POST | Destinatário responde desafio social, sem alterar XP/dinheiro |
| `/api/characters/:id/full` | POST ou PUT | Narrador edita a ficha completa; aceita `log_message` |

Compra de informação:

```json
{
  "character_id": 234567,
  "character_revision": 3,
  "revision": 1,
  "quoted_xp": 7,
  "quoted_money": 200,
  "confirmed": true,
  "request_id": "um-identificador-unico-da-confirmacao"
}
```

Repetir o mesmo identificador, personagem e compra já concluída devolve o resultado sem novo débito. Outra tentativa de comprar um eco já revelado retorna conflito. O pagamento não pode ser dividido. A resposta inclui `information` e `character`; `purchase` guarda a pessoa, personagem, valores e instante da investigação. Conteúdo reservado não aparece no snapshot, na pesquisa ou no backup autorizado de um jogador antes da revelação.

Aquisição de disciplina usa `character_id`, `character_revision`, `quoted_cost`, `confirmed` e `request_id`. O servidor calcula o preço por `game.discipline_market.costs[id]`, com herança de `default_cost` (inicialmente 10). Permissões ficam em `allowed_ids`. Cotação divergente retorna 409 sem débito. Zero é um preço válido. Evolução de disciplina ausente não concede o traço; primeiro é necessária aquisição ou concessão do narrador.

O mapa armazena `character_markers` com `character_id`, `x`, `y`, `visibility`, `_revision`, `updated_at` e, em base geográfica, `lat`/`lng`. Visibilidade padrão `private`: responsável e narrador. `campaign`: demais participantes também veem. A projeção inclui somente o resumo e retrato do personagem. Não inclui sua ficha inteira. A API exige revisão 0 na primeira posição e a revisão corrente nas seguintes.

Escala de imagem em PATCH do mapa:

```json
{"revision": 2, "scale": {"pixels": 500, "meters": 1000}}
```

`pixels` mede a referência na imagem original. A distância usa a largura/altura originais e essa razão; zoom da tela não participa. Medições são temporárias no cliente. Na base geográfica, a fórmula geodésica usa coordenadas, incluindo cruzamento da linha de mudança de data.

O salão não aceita mais mensagens sem `to`. Tipos: `message`, `reminder`, `poke`, `kudos`, `icebreaker`, `challenge`. Os três primeiros recursos sociais rápidos possuem intervalo para repetição do mesmo remetente/destinatário. Desafios usam `game: "rps"`, `choice: "rock" | "paper" | "scissors"`, destinatário e prazo de 48 horas. A escolha alheia é retirada das respostas antes da conclusão; o destinatário responde em `/respond`. Narradores não recebem mensagens ou desafios privados entre outras contas pelas rotas normais.

`PATCH /api/profile` aceita atualização parcial de preferências: `audio_enabled`, `music_enabled`, `sfx_volume` e `music_volume` (inteiros de 0 a 100), `animations`, `social_mood` (`chat`, `chill`, `busy`) e `social_note` (até 120 caracteres). A capa `cover` e a cor `accent` são metadados da campanha. O antigo seletor `system` não é mais utilizado.

O conjunto de documentos conserva o formato `coroa-document-set-v4`; a revisão de esquema passa a 9. Cada campanha pode ter um novo `intel.json`, referenciado em `campaign.json`. Conjuntos antigos sem esse documento continuam aceitos. Não há alteração de tabela ou função SQL.

## Objetivos e enquadramento · versão 9

`PATCH /api/characters/:id` aceita `patch.aspirations: {ambition, desire}` (textos de até 30.000 caracteres) e `patch.portrait_frame: {x, y, zoom}`. Posições são números de 0 a 100; zoom de 1 a 3. A foto original continua em `profilepicture`. Revisão e vínculo da ficha são exigidos.

`POST /api/characters/:id/aspiration` recebe `revision`, `kind: "ambition" | "desire"`, `outcome: "complete" | "abandon"` e `confirmed: true`. Limpa apenas aquele objetivo, conserva seu texto no histórico e não altera XP. Repetições e revisões antigas são recusadas. Narrador pode administrar a ficha; outro jogador não pode encerrá-la.

Navegação, filtros e rascunho de rolagem ficam na memória do cliente. O histórico do navegador contém apenas identificadores opacos das entradas, sem JSON de ficha, imagens ou credenciais.

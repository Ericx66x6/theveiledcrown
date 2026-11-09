# API · A Coroa Velada 10.2

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

## Jogador de testes (9.1)

- `POST /api/player-test`: sessão real de narrador obrigatória. Campos opcionais: `campaign_id`, `character_id` (cópia de ficha ativa), `xp` (padrão 100), `money` (padrão 1000), `include_maps` (padrão true). Retorna conta temporária de jogador, `campaign_id` temporário e `player_test.id`. Não altera a sessão autenticada ou o repositório real.
- As solicitações do teste incluem `X-Player-Test: <player_test.id>` e o `X-Campaign-ID` temporário, além do cookie ou Bearer normal do narrador. O identificador sozinho não autentica nem concede acesso; o servidor exige o mesmo narrador e a mesma sessão que criaram o teste.
- `DELETE /api/player-test`: encerra o teste corrente e retorna a conta normal do narrador. Pode informar o `campaign_id` original.
- `410 / PLAYER_TEST_EXPIRED`: não repita a operação na campanha real. O cliente bloqueia a tela do teste e retorna ao narrador.
- O teste é um workspace JSON temporário na memória da API, com limite de sessões e expiração por inatividade, sem gravação no Supabase. Reiniciar a API o descarta.
- `POST /auth/logout` continua encerrando a sessão real, inclusive durante o teste. Alteração de senha e novo login são bloqueados dentro do contexto de teste.

## Posição de personagens (9.1)

Em `PUT/PATCH/DELETE /api/maps/:map/characters/:character`, narradores podem posicionar ou remover qualquer personagem ativo da campanha; jogadores só os próprios. `revision` da posição é obrigatória. O narrador mantém a visibilidade existente; uma posição criada por ele começa privada. Só o jogador altera `visibility` entre `private` e `campaign`. Coordenadas e acesso ao mapa continuam validados.


## Criação guiada 9.2.1

`POST /api/submissions` e `PATCH /api/submissions/:id` conservam o contrato `{character, revision}`. A ficha do assistente inclui `character.creation`: `version:1`, `clan`, três IDs em `disciplines`, `primary_paths`, seleções `traits` e mapas `initial`/`bonus`. As categorias usam os mesmos nomes dos catálogos, incluindo `atributes` e `precedents`. Em atributos, o mapa inicial contém o nível absoluto; nos bônus, contém quantos níveis adicionais foram comprados.

Para jogadores, a API reconstrói todos os traços pelo plano, recalcula geração, potência, XP inicial e capital e recusa distribuições inválidas. Cada reserva inicial deve ter gasto exatamente igual ao orçamento; bônus devem terminar em zero, sem descarte. POST e PATCH recusam sobras ou a remoção de `character.creation` por jogadores quando o assistente está ativo. `caracteristics` recebe as seleções e detalhes aprováveis; os custos vêm do catálogo, não do cliente. A conta dona e o nome do jogador são determinados pela autenticação. Os campos narrativos continuam opcionais.

O relatório contém `issues`, `warnings`, `totals` das reservas e `derived` para geração/capital. Propostas antigas sem plano são mantidas, com exigência de revisão manual quando o assistente está ativo. A aprovação continua exclusiva do narrador, com revisão obrigatória; divergências exigem `override:true` e justificativa em `reason`. A aprovação repetida é recusada, sem duplicar ficha ou capital.

Depois de aprovada, `creation` serve de registro das escolhas. `primary_paths` liga disciplina e linha primária; evoluir qualquer uma pela rota normal atualiza ambas e cobra a cotação uma única vez. Adquirir novas linhas, aplicar efeitos situacionais e editar fichas antigas continuam sob as regras normais da campanha.

## Tipos de JSON (9.2.2)

O game-data pode informar `format: coroa-game-data-v1`; arquivos antigos com os catálogos e `xp_cost` continuam aceitos sem marcador. O identificador não substitui a validação completa. `/api/game`, importação de fichas e restauração de portal identificam arquivos destinados a outra rota e retornam orientação específica. A importação de regras que viole uma ficha existente informa nome/ID e o erro de validação, conservando as regras e as fichas anteriores.

## Cadastro e recompensas (9.3.0)

| Rota | Contrato |
| --- | --- |
| `POST /auth/register` | Público: `display_name`, `username`, `password` (10–128 caracteres), `avatar` opcional em data URL. Resposta `status: pending`, sem token/cookie de sessão. |
| `GET /api/admin/registrations` | Narrador: fila e histórico de avaliações, sem hashes. |
| `POST /api/admin/registrations/:id/approve` | Narrador: `revision`, `campaign_ids` de pelo menos uma campanha aberta, `note` opcional. |
| `POST /api/admin/registrations/:id/reject` | Narrador: `revision`, `note` opcional. |
| `GET /api/rewards` | Jogador: regra, presença, créditos pendentes e até 25 recibos privados não reconhecidos da campanha. |
| `POST /api/rewards/check-in` | Jogador: corpo vazio; servidor decide o dia pelo fuso da regra. Repetições no mesmo dia não criam outro progresso. |
| `POST /api/rewards/claim` | Jogador: `credit_id`, `character_id`, `revision` da ficha e `confirmed: true`. Resgate idempotente para o mesmo personagem. |
| `POST /api/rewards/ack` | Jogador: `ids`, de 1 a 50 recibos próprios. Reconhece animações sem remover histórico ou notificações. |

`GET /api/portal-state` inclui `rewards` para o jogador e `registrations` para o narrador. A configuração fica em `game.login_rewards`; é salva na rota existente `PUT /api/game`, com `_expected_revision`. Ver [JOGO-VIVO.md](JOGO-VIVO.md).
# Protocolo de desempenho da versão 10

O contrato anterior continua disponível. O frontend 10 envia `X-Coroa-Client: 10` e negocia o suporte pelo cabeçalho de resposta `X-Coroa-Protocol: 10`. Sem esse cabeçalho, o cliente não envia os metadados de atualização de tela para servidores antigos.

- `GET /api/portal-state` aceita `incremental`, `known_account_id`, `known_campaign_id`, `known_game_revision` e `known_character_revisions`. Responde `game:null` quando o livro não mudou e `players` apenas com fichas alteradas; `player_ids` contém a lista autorizada completa, permitindo remover fichas excluídas, arquivadas ou redesignadas. Os dados são filtrados novamente no servidor em toda consulta.
- Mutações podem incluir `__portal_view` com a mesma visão conhecida. A API remove esse controle antes da operação de domínio e responde `{_coroa_update:10,result,state,view}` após o commit. O transporte entrega `result` ao chamador e aplica `state` uma vez no contexto correspondente. Mudanças de conta, campanha ou modo de teste descartam respostas antigas.
- `GET /api/sync` mantém `{revision}`; não remonta o livro nem baixa imagens. Leituras usam cache de revisão curto (750 ms), e mutações consultam a revisão do banco antes de gravar. Outra aba verifica a revisão a cada 20 s ou ao recuperar o foco.
- `GET|HEAD /api/media/<sha256>.<jpg|png|webp>` exige sessão e autorização para a imagem. Os bytes são privados, com ETag e `Vary: Cookie, Authorization`; o bucket não se torna público. Novas requisições consultam a autorização antes de servir o cache. Uma cópia já baixada pelo usuário não pode ser desfeita retroativamente.
- `POST /api/media/portable` recebe `{document}` e substitui referências autorizadas por imagens embutidas, para download de JSONs parciais. Não grava o documento. Os endpoints de backup completo e pacote do jogador já retornam JSON portátil.
- `Server-Timing` apresenta `db`, `commit` e `app` em milissegundos. JSONs maiores podem usar gzip. Respostas de dados continuam `no-store`; o cache persistente de documentos não fica no navegador.
- `COROA_MAINTENANCE=1` mantém `GET /api/health` disponível e responde 503 / `MAINTENANCE` às demais rotas de dados e autenticação. A configuração é aplicada ao iniciar o processo.

O codec de persistência `coroa-storage-v10` é interno. Backups continuam no formato portátil existente. Escritas usam revisão esperada e uma transação SQL; somente conflitos conhecidos podem ser reavaliados automaticamente. Uma falha de confirmação não é repetida cegamente. As RPCs novas `coroa_poll_state` e `coroa_commit_documents` são exclusivas de `service_role` e exigem a migração documentada em `ATUALIZAR.md`.

## Memórias, documentos e conquistas (10.1)

Estas rotas usam a mesma sessão e `X-Campaign-ID`. Operações fora do papel ou da propriedade autorizada são recusadas no servidor.

| Rota | Contrato principal |
| --- | --- |
| `GET/POST /api/recaps` | Lista autorizada; jogador cria rascunho com `character_id`, `title`, `scene`, `events`, `pending`, `next`, `cast` |
| `GET/PATCH/DELETE /api/recaps/:id` | Jogador edita rascunho/complemento do próprio relato com `revision`; narrador lê e remove |
| `POST /api/recaps/:id/submit` | Autor envia com `revision`; exige estrutura, mínimo configurado, ausência de cópia exata e de outro relato pendente naquela ficha |
| `POST /api/recaps/:id/review` | Narrador: `revision`, `outcome: reward/changes/review`, `note`; recompensa exige também `character_revision` e `confirmed:true` |
| `GET/POST /api/feedbacks` | Autor e narrador consultam; criação recebe `kind`, `title`, `content`, `impact`, `suggestion` |
| `GET/PATCH/DELETE /api/feedbacks/:id` | Autor edita/remove antes da avaliação com `revision`; narrador pode remover depois |
| `POST /api/feedbacks/:id/review` | Narrador: `revision`, `reply`, `xp`; positivo exige `character_id`, `character_revision`, `confirmed:true` e ficha ativa do autor |
| `GET/POST /api/documents` | Lista filtrada; criação pelo narrador com título, `kind`, `body`, `issuer`, `caption`, `image`, `access`, `account_ids` |
| `GET/PATCH/DELETE /api/documents/:id` | Leitura autorizada; alterações só narrador com `revision` |
| `POST /api/documents/:id/read` | Registra a leitura do destinatário, idempotente |
| `GET /api/achievements` | Galeria da própria conta; narrador pode passar `account_id` de membro da campanha |
| `POST /api/achievements` | Narrador concede `account_id`, `request_id`, `name`, `icon`, `description`, `confirmed:true`; repetir o mesmo `request_id` devolve o feito existente |
| `DELETE /api/achievements/:id` | Narrador remove da conta indicada em `account_id`, com `confirmed:true` |
| `POST /api/achievements/ack` | Própria conta confirma recibos em `ids`; disponível também sem campanha vinculada |
| `GET/POST /api/characters/:id/blood-bonds` | Responsável ou narrador; criação exige `character_revision` e `confirmed:true` |
| `PATCH/DELETE /api/characters/:id/blood-bonds/:bond` | Edição/remoção com `revision` do vínculo, `character_revision` e confirmação |
| `POST /api/characters/:id/blood-bonds/:bond/renew` | Mesmo controle de revisão; `last_scene` e `strengthen` opcional |
| `POST /api/characters/:id/blood-bonds/:bond/weaken` | Mesmo controle; exige estágio `fading`, reduz exatamente um nível |

Relatos usam `game.chronicle.recap_min_words` (padrão 80, entre 50 e 600). Cada tópico também tem mínimo próprio; variedade de palavras e completude não substituem a avaliação humana. `changes` exige observação, `reward` entrega +1 XP uma vez à ficha original ainda pertencente ao autor. Feedback pode ser avaliado com zero XP e recompensado depois; só há uma entrega positiva.

`kind` de feedback: `narration`, `story`, `system`, `bug`, `idea`, `praise`. Documentos: `letter`, `news`, `decree`, `evidence`, `lore`; `access: campaign/restricted`. Em acesso restrito, `account_ids:[]` reserva aos narradores. Respostas para jogadores removem a lista de destinatários e leituras alheias. Imagens mantêm a autorização em `/api/media`.

Laços recebem `name`, `description`, `last_scene`, `image`, `direction: bound_to/holds`, `level:0..5` e `stage:fervor/echo/distant/ashes/fading`. O estágio não modifica o nível automaticamente. Renovar retorna a `fervor`; `strengthen:true` aumenta um nível até 5. Vínculo rompido só é reatado com reforço explícito. Desgaste volta a `distant` se ainda houver níveis. Todas as alterações são registradas no histórico da ficha.

A galeria pertence à conta: entradas automáticas de evolução/disciplinas e títulos manuais. O portal inicial traz contagem, últimas marcas e recibos; a lista completa é buscada ao abrir a galeria. Os recibos manuais são reconhecidos por `/api/achievements/ack`; XP/evolução/laços continuam usando `/api/rewards/ack`.

O formato interno é `coroa-storage-v10.1`, com leitura de v10 e v4. O protocolo HTTP `X-Coroa-Client:10` e o formato dos backups portáteis permanecem compatíveis. Não é necessária RPC ou migração SQL nova para quem já aplicou a da 10.0. Revisar evolução no cliente calcula a cotação localmente; `upgrade-preview` continua disponível a integrações, e `upgrade` valida a compra no servidor.

## Criação ilustrada e moralidade (10.2)

- `moral_principle`: texto de até 1.000 caracteres por campanha, devolvido pelas consultas autorizadas. `POST /api/campaigns` e `PATCH /api/campaigns/:id` aceitam o campo somente para narrador; a edição usa a revisão da campanha. Jogadores leem o princípio e não o substituem.
- `moralityes`: convicções pessoais da própria ficha, editáveis pelo jogador responsável ou narrador, com revisão e validação da ficha. Não altera automaticamente a Humanidade.
- `clan_flaw_detail`: texto narrativo opcional de até 3.000 caracteres, preservado no envio, aprovação, ficha e backup. Não concede pontos.
- `character_creation.guided.clans[].discipline_choices`: alternativas de disciplinas para um clã flexível. O jogador escolhe exatamente três IDs diferentes permitidos; os clãs fixos continuam usando `disciplines`. A API reconstrói a ficha e valida o gasto completo.
- `guide`: textos introdutórios de cada clã, configuráveis no game-data; nenhum HTML ou código do JSON é executado.

A aprovação continua exclusiva do narrador. Não há novas rotas públicas, mudança de autenticação, nova migração SQL ou novo formato interno nesta versão. A normalização acrescenta os valores ausentes; não sobrescreve fichas aprovadas nem saldos de campanhas anteriores.

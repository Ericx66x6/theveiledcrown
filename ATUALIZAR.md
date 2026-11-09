# A Coroa Velada 10.2 oficial · tutorial de atualização

A 10.2 transforma a criação de personagem em um percurso ilustrado: 14 clãs, dicas para iniciantes, fraquezas, história guiada, foto e convicções. Qualidades e defeitos ficam separados, e a reserva de pontos acompanha o jogador até o envio. **Personagens em avaliação** substitui o nome Minhas propostas.

**Já usa a 10.1? Não execute SQL novo nem `storage:migrate`.** O formato interno continua `coroa-storage-v10.1`. Você atualiza o código do Render e do Vercel, preservando o mesmo Supabase, contas e imagens. Não importe o novo `data/game_data.json` sobre uma campanha existente: ele é o modelo de uma instalação nova. As regras personalizadas continuam valendo.

## 1. Identificar sua versão e guardar o backup

1. Na versão atual, entre como narrador, abra **Arquivos e backups** e baixe o **backup completo do portal**. Guarde também o ZIP anterior e os commits/deployments atuais do Render e Vercel.
2. Abra a URL do Render com `/api/health` no final. Anote `version` e `storage`.
3. Avise a mesa da breve pausa e peça que terminem as alterações. Pause os deploys automáticos enquanto substitui os arquivos.
4. Se já usa a versão 10 ou superior, coloque `COROA_MAINTENANCE=1` no Render e publique essa alteração. O health deve indicar `maintenance:true`.

| Sua instalação atual | Preparação no Supabase | Conversão depois de publicar a API 10.2 |
| --- | --- | --- |
| 10.1, `incremental-v10.1` | Nenhuma | Nenhuma |
| 10.0, `incremental-v10` | Nenhum SQL novo | `npm run storage:migrate`, em manutenção |
| 9.x | Executar a migração incremental abaixo | `npm run storage:migrate`, em manutenção |
| Instalação totalmente nova | Seguir `TUTORIAL.md` e `supabase/INSTALAR.sql` | Seguir a instalação, sem importar dados antigos |

**Somente se vier da 9.x:** execute no SQL Editor do mesmo Supabase o arquivo completo `supabase/migrations/202611080001_incremental_v10.sql`. Ele acrescenta as funções incrementais. A 9.x não possui o bloqueio de manutenção: mantenha a mesa fora até a API nova estar publicada em manutenção.

Não apague buckets, tabelas, imagens ou contas. Não use Reset portal para atualizar.

## 2. Substituir os arquivos no GitHub

1. Extraia o ZIP **10.2.0** em uma pasta nova. Entre na pasta `theveiledcrown`: `package.json`, `client`, `core`, `server` e `supabase` ficam no mesmo nível.
2. Abra seu repositório pelo GitHub Desktop ou VS Code.
3. Copie o conteúdo dessa pasta para a raiz do repositório, substituindo os arquivos. Preserve `.git` e seu `.env` local. Não coloque uma pasta extra envolvendo o projeto.
4. Confira `"version": "10.2.0"` no `package.json` e os arquivos novos:

   - `client/creation-guide.js`, `client/creation-controls.js` e `client/creation-game.css`;
   - `core/clan-guide.js` e `data/clan_guide.json`;
   - os **14 retratos WebP** em `public/images/clans/`.

5. Faça commit e push na branch conectada aos serviços. Pelo terminal, dentro do repositório:

```sh
git status
git add .
git commit -m "A Coroa Velada 10.2 oficial"
git push
```

Revise o status antes do commit. `.env`, credenciais, `node_modules`, `.qa` e `dist` ficam fora. Envie os arquivos extraídos, não apenas o ZIP. Use GitHub Desktop para preservar toda a estrutura, inclusive os arquivos de configuração.

## 3. Publicar o backend no Render

Use o serviço atual, sem criar outro banco. Preserve suas variáveis.

| Campo | Valor |
| --- | --- |
| Runtime | Node |
| Branch | A branch atualizada, normalmente `main` |
| Root Directory | Vazio, se o projeto está na raiz |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| `NODE_VERSION` | `24` |
| `NODE_ENV` | `production` |
| `TRUST_PROXY` | `1` |
| `COROA_MAINTENANCE` | `1` durante a troca |

Mantenha `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (ou `SUPABASE_SERVICE_ROLE_KEY`), `SUPABASE_IMAGE_BUCKET`, `BOOTSTRAP_TOKEN` e `ALLOWED_ORIGINS` como já funcionam. A chave privada fica somente no Render. O bucket continua privado.

Em **Manual Deploy → Deploy latest commit**, publique e aguarde **Live**. Abra `/api/health` na URL do Render:

```json
{"status":"ok","version":"10.2.0","storage":"incremental-v10.1","maintenance":true}
```

O `storage` continuar em **10.1** é esperado: mudou a versão do aplicativo, não o formato do banco.

### Somente se você estava na 10.0 ou 9.x

Com a API **10.2 em manutenção**, execute no Shell do Render:

```sh
npm run storage:migrate
```

A saída informa `status: "concluido"`, `format: "incremental v10.1"` e quantidades de campanhas, fichas e contas. Confira os números. Não deixe outro servidor antigo gravando no mesmo banco durante a conversão.

Sem Shell: instale Node.js 24 no computador, abra a pasta do projeto e execute `npm ci`. Crie um `.env` **local**, excluído do Git, com `SUPABASE_URL`, sua chave privada existente, o nome real de `SUPABASE_IMAGE_BUCKET` e `COROA_MAINTENANCE=1`. Confira que o Render também está em manutenção e execute `npm run storage:migrate` no terminal local. Em caso de erro, mantenha a manutenção e resolva antes de liberar.

**Quem já estava na 10.1 pula toda esta conversão.**

## 4. Publicar o frontend no Vercel

Use o mesmo projeto ligado ao mesmo repositório.

| Campo | Valor |
| --- | --- |
| Framework | Other |
| Root Directory | Raiz do projeto |
| Install Command | `npm ci --include=dev` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js | `24.x` |
| `COROA_API_BASE` | A URL HTTPS atual do Render, sem `/api` no final |

Preserve `vercel.mjs`, o encaminhamento de `/auth` e `/api` e `COROA_SITE_URL`, se já configurado. Publique o mesmo commit. Não coloque a chave Supabase no Vercel ou no código do navegador.

No Render, altere `COROA_MAINTENANCE` para `0` e publique novamente. O health deve mostrar **10.2.0**, `incremental-v10.1` e `maintenance:false`. Recarregue o site pelo domínio normal do Vercel; a apresentação mostra **V10.2 OFICIAL**.

## 5. Usar a criação nova

### Clãs e identidade

- **Conhecer** um clã abre seu retrato, conceito, ideologia, perfis de inspiração, poderes e fraqueza. Somente **Escolher [clã]** confirma a linhagem.
- Os 13 clãs anteriores mantêm as combinações de disciplinas da sua mesa. Caitiff escolhe **três dons diferentes** entre Animalismo, Auspícios, Rapidez, Dominação, Fortitude, Ofuscação, Potência e Presença.
- **Clã personalizado** pede confirmação e avisa para conversar com o narrador; a aprovação continua manual.
- Necromancia e Taumaturgia continuam exigindo a linha inicial. Uma disciplina escolhida pode permanecer no nível 0.
- Foto e enquadramento, história, detalhe pessoal da fraqueza e convicções podem ser preenchidos na criação. O botão de ajuda organiza quatro respostas num rascunho de história que o jogador pode reescrever.
- As fraquezas são resumos da 3ª edição/Revised, separados dos defeitos compráveis: **não concedem pontos bônus**. Consequências narrativas ficam a cargo do narrador. Aparência 0 dos Nosferatu é aplicada às novas criações guiadas e bloqueada na evolução; a atualização não recalcula fichas antigas aprovadas.

### Princípio da crônica e convicções pessoais

Em **Histórico e convicções**, o narrador registra o **princípio compartilhado**, escolhido em conjunto pela mesa. Também pode alterá-lo na configuração da campanha. Há um texto por campanha; ele aparece na criação e na ficha de todos. O jogador pode escrever e alterar as **próprias convicções**, separadamente. Uma violação não desconta Humanidade automaticamente: vocês resolvem a cena e o narrador aplica a consequência.

### Distribuição sem atalhos

A ordem continua obrigatória: identidade → atributos → habilidades → antecedentes → disciplinas → qualidades/defeitos → bônus em atributos → habilidades → antecedentes → disciplinas → revisão.

| Reserva inicial | Pontos | Limite inicial por traço |
| --- | --- | --- |
| Atributos | 15 extras; base 1, com exceção de Aparência Nosferatu 0 | 4 |
| Habilidades | 27 entre os três grupos | 3 |
| Antecedentes | 5 | 5 |
| Disciplinas | 3 entre os três dons | 3 |

Todas as reservas iniciais precisam ser gastas por completo. Nos bônus: **15 PB + defeitos − qualidades**, até quatro defeitos; atributo custa 4, habilidade 2, antecedente 1 e disciplina 6 PB por nível. Bônus permitem chegar a 5, respeitando restrições. A reserva é compartilhada: pode passar por uma categoria sem comprar nela. Se sobrar depois das disciplinas, volta aos atributos até zerar. Não é permitido enviar com pontos sobrando.

Qualidades e defeitos são **opcionais**, com abas, cores, preços e efeitos distintos. Defeitos acrescentam PB e consequências; qualidades gastam PB. A barra inferior mantém saldo e Continuar visíveis, inclusive em listas longas. Tocar num aumento bloqueado explica o limite ou a falta de pontos. Requisitos do catálogo continuam validados no servidor.

O rascunho permanece **somente nesta aba** enquanto ela estiver aberta. Para guardar no servidor, conclua e envie para avaliação. Depois, o jogador acompanha o parecer em **Personagens em avaliação**; o narrador pode aprovar, pedir ajustes ou recusar. **Apagar envio** remove a avaliação; uma ficha já aprovada permanece na campanha.

## 6. Conferir e reabrir para a mesa

1. Confira campanhas, fichas, XP, fotos, mapas e regras existentes.
2. Use **Testar como jogador** para explorar os clãs sem mudar as fichas reais. Confira em computador e celular o retrato, as abas, os botões e a barra de pontos.
3. Escolha Caitiff e confira os oito dons disponíveis; escolha três diferentes. Teste a linha inicial de Giovanni/Tremere.
4. Tente aumentar um atributo acima de 4 ou uma habilidade acima de 3 na distribuição inicial: deve explicar o limite. Não deve permitir avançar com sobra.
5. Na etapa opcional, teste defeito, qualidade e retirada. Confira o saldo e a explicação de restrições. Na distribuição final, gaste tudo e revise.
6. Envie uma ficha por uma conta de teste e confira o parecer como narrador. Confirme foto, história, convicções, fraqueza e pontos antes de aprovar.
7. Registre um princípio numa campanha e confira que outra campanha mantém o próprio texto.
8. Faça um novo backup completo. Reative os deploys automáticos, se desejar, e libere a mesa.

Os testes de código desta entrega estão em `docs/VALIDACAO-V102.md`. **A revisão visual da interface nova no navegador foi bloqueada pela revisão automática por limite de uso da ferramenta.** As verificações automatizadas não substituem essa conferência visual no seu celular.

## 7. Problemas e retorno

| Sintoma | O que conferir |
| --- | --- |
| Health não mostra 10.2.0 | Branch e commit do Render; o deploy precisa terminar |
| Site parece a versão anterior | Commit do Vercel, recarregamento e envio dos novos módulos e imagens |
| Retratos dos clãs não abrem | As 14 imagens em `public/images/clans/` e o build do Vercel |
| Caitiff não aparece | Render e Vercel na 10.2; normalização do catálogo da campanha. Não substitua o livro inteiro |
| Manutenção continua | `COROA_MAINTENANCE=0` no Render e novo deploy |
| `MIGRATION_REQUIRED` | Origem 9.x: execute a migração SQL indicada no início |
| Bônus ficam negativos | Retirou um defeito ou gastou mais do que a reserva; devolva compras antes de seguir |
| Alteração de regras mudou o limite | Retorne à etapa indicada e redistribua. As escolhas compatíveis são mantidas |

Para voltar **da 10.2 à 10.1**, guarde backup atualizado, coloque manutenção e publique os códigos anteriores do Render e do Vercel juntos. Não é necessária conversão do banco. Campos novos não terão interface na versão anterior: mantenha o backup da 10.2 para retomá-los.

Para voltar à **10.0 ou 9.x**, o formato interno exige conversão: ainda com a API 10.2 em manutenção e um backup atualizado, execute `npm run storage:legacy -- --confirm-legacy`. Só depois publique o backend/frontend anteriores. Veja também `docs/ATUALIZAR-V10.1.md`. Não remova a migração SQL nem apague tabelas.

## Referências de infraestrutura

- Node no Render: https://render.com/docs/node-version
- Node no Vercel: https://vercel.com/docs/functions/runtimes/node-js/node-js-versions
- Chaves Supabase e uso exclusivo da chave privada no backend: https://supabase.com/docs/guides/getting-started/api-keys
- Clãs, diferenças de edição e regras da mesa: `docs/CLAS-E-REFERENCIAS.md`.

Nenhum serviço de produção foi alterado durante a preparação deste pacote. A atualização conserva as otimizações incrementais da 10.0/10.1; não houve nova medição de latência em produção.

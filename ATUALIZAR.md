# A Coroa Velada 10.1 oficial · atualização

Esta versão acrescenta Onde paramos?, Galeria da eternidade, Documentos da crônica, Voz da mesa e Laços de sangue. Também devolve o carregamento ao centro da tela e abre a revisão da evolução em uma confirmação sobre fundo escuro.

**Se você já está na 10.0: não precisa executar SQL novo, criar outro bucket, trocar serviços ou cadastrar contas novamente.** Os registros passam a usar o formato interno `coroa-storage-v10.1`, com relatos, documentos, feedbacks e conquistas separados para gravações incrementais. Faça a conversão controlada abaixo antes de reabrir.

O livro de regras e as fichas atuais são preservados. **Não importe `data/game_data.json` para atualizar.** Esse arquivo é o modelo de uma instalação nova. Não há IA nesta entrega.

## 1. Guardar uma cópia e preparar a pausa

1. Entre como narrador na versão atual e abra **Arquivos e backups**.
2. Baixe o **backup completo do portal**, aguarde o download e guarde-o fora da pasta que vai substituir. Uma ficha individual não substitui esse backup.
3. Guarde o ZIP anterior, o commit atual do Render e o deployment atual do Vercel.
4. Avise a mesa da pausa e peça que terminem as alterações.
5. No Render, adicione `COROA_MAINTENANCE=1` e publique a versão atual. A 10.0 já reconhece essa opção. Confira `maintenance:true` em `/api/health`.
6. Durante a atualização, mantenha os deploys manuais. Se o Vercel publica cada push automaticamente, pause essa publicação até a etapa 5.

Não apague tabelas, buckets ou imagens. Não use Reset portal, `db reset` nem restauração de backup como forma de atualizar.

### Se ainda estiver na 9.x

Antes de publicar a API nova, execute no **SQL Editor do mesmo Supabase** todo o arquivo:

```text
supabase/migrations/202611080001_incremental_v10.sql
```

Essa migração acrescenta as funções incrementais e preserva as tabelas existentes. Depois siga as etapas desta página, publicando diretamente a 10.1 em manutenção. A 9.x não reconhece a manutenção; mantenha os jogadores fora até o backend novo estar publicado. A referência completa da passagem 9.x → 10.0 foi preservada em `docs/ATUALIZAR-V10.0.md`. Para instalação do zero, use `TUTORIAL.md` e `supabase/INSTALAR.sql`.

## 2. Atualizar o GitHub inteiro

1. Extraia o ZIP **10.1.0** numa pasta nova. Dentro de `theveiledcrown`, `package.json`, `server/`, `client/` e `supabase/` devem estar no mesmo nível.
2. Abra seu repositório no GitHub Desktop ou VS Code.
3. Copie os arquivos de **dentro** dessa pasta para a raiz do repositório, substituindo os anteriores. Preserve `.git` e qualquer `.env` local. Não crie uma pasta adicional envolvendo o projeto.
4. Confira os novos módulos `client/chronicle.js`, `client/achievements.js`, `client/blood-bonds.js`, `client/chronicle.css`, `core/chronicle-service.js` e `core/blood-bonds-service.js`.
5. Confira `"version": "10.1.0"` no `package.json` e faça commit/push na branch conectada aos serviços.

Pelo terminal do VS Code, dentro do repositório:

```sh
git status
git add .
git commit -m "A Coroa Velada 10.1 oficial"
git push
```

Revise o `git status` antes de enviar. `.env`, credenciais, `node_modules`, `.qa` e `dist` não devem ser publicados. Envie os arquivos extraídos, não apenas o ZIP. O GitHub Desktop facilita preservar todas as pastas e os arquivos que começam com ponto.

## 3. Publicar o Render em manutenção

Use o serviço existente e preserve as variáveis que já funcionam.

| Campo | Valor |
| --- | --- |
| Runtime | Node |
| Branch | A branch atualizada, normalmente `main` |
| Root Directory | Vazio se o projeto está na raiz |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| `NODE_VERSION` | `24` |
| `NODE_ENV` | `production` |
| `TRUST_PROXY` | `1` |
| `COROA_MAINTENANCE` | `1` nesta etapa |

Preserve `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (ou `SUPABASE_SERVICE_ROLE_KEY`), `SUPABASE_IMAGE_BUCKET`, `BOOTSTRAP_TOKEN` e `ALLOWED_ORIGINS`. A chave privada continua somente no Render. O bucket permanece privado.

Use **Manual Deploy → Deploy latest commit** e aguarde **Live**. Abra a URL real do Render seguida de `/api/health`. Confira:

```json
{"status":"ok","version":"10.1.0","storage":"incremental-v10.1","maintenance":true}
```

A ordem dos campos não importa. Só continue quando a versão for **10.1.0** e a manutenção estiver ativa. Não deixe outro servidor antigo gravando no mesmo banco durante a conversão.

## 4. Converter a organização dos documentos

### Com Shell no Render

Na aba **Shell** do serviço atualizado, execute:

```sh
npm run storage:migrate
```

O comando usa as mesmas variáveis do serviço. Aguarde a conclusão. Exemplo com números fictícios:

```json
{"status":"concluido","format":"incremental v10.1","revision":123,"campaigns":2,"characters":8,"accounts":6}
```

Confira se as quantidades correspondem ao portal. A conversão organiza o acervo uma vez, sem reiniciar personagens, conceder XP ou substituir suas regras. Repetir o comando em manutenção não duplica as fichas.

### Sem Shell no Render

1. Instale Node.js 24 e abra a pasta extraída da 10.1 no VS Code.
2. No terminal dessa pasta, execute `npm ci`.
3. Crie um arquivo local **`.env`** na raiz com os valores existentes do Render:

   ```dotenv
   SUPABASE_URL=https://SEU-PROJETO.supabase.co
   SUPABASE_SECRET_KEY=COLE-A-CHAVE-PRIVADA-DO-RENDER-AQUI
   SUPABASE_IMAGE_BUCKET=coroa-imagens
   COROA_MAINTENANCE=1
   ```

4. Preserve o nome real do seu bucket. Esse arquivo fica somente no computador, excluído pelo `.gitignore`.
5. Confira novamente que o **Render** informa `maintenance:true`. A variável no computador não coloca o servidor em manutenção.
6. Execute `npm run storage:migrate` e confira a saída acima. Se houver erro, mantenha a manutenção e corrija antes de reabrir.

## 5. Publicar o Vercel

Use o projeto existente ligado ao mesmo repositório.

| Campo | Valor |
| --- | --- |
| Framework | Other |
| Root Directory | Raiz do projeto |
| Install Command | `npm ci --include=dev` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js | `24.x` |
| `COROA_API_BASE` | A mesma URL HTTPS do Render, sem `/api` no final |

Preserve `vercel.mjs`, o encaminhamento de `/auth` e `/api`, e `COROA_SITE_URL`, se configurado. Publique o commit novo. A chave Supabase não vai para o Vercel nem para o navegador.

No Render, altere `COROA_MAINTENANCE` para **`0`**, salve e publique novamente. Confira a versão 10.1.0 com `maintenance:false`. Abra o domínio normal do Vercel e recarregue uma vez; o rodapé mostra **V10.1 OFICIAL**.

## 6. Usar as novas áreas

| Área | Jogador | Narrador |
| --- | --- | --- |
| **Onde paramos?** | Escolhe a própria ficha, escreve os quatro tópicos, salva rascunho e envia | Lê por personagem, pede complemento, marca como lido ou concede **+1 XP uma única vez** |
| **Galeria da eternidade** | Consulta feitos de todos os seus personagens e títulos da conta | Em Galeria dos jogadores, escolhe a pessoa e concede nome, ícone e descrição; também pode remover marcas |
| **Documentos da crônica** | Abre somente os documentos liberados para sua conta | Cria cartas, notícias, decretos e evidências em texto/imagem; escolhe toda a campanha ou jogadores específicos |
| **Voz da mesa** | Envia feedback privado sobre história, narração, sistema, bugs, sugestões ou elogios | Responde, registra sem XP ou concede um valor de XP para uma ficha ativa do autor |
| **Laços de sangue** | Anota as ligações de cada personagem, fotos, descrições e estágio do sangue | Pode consultar e ajustar os vínculos das fichas |

### Relatos que ajudam a continuar a história

Os relatos são separados por personagem, visíveis ao responsável pela ficha e ao narrador. O guia pergunta onde parou, o que aconteceu, o que ficou pendente e qual é o próximo passo. O padrão é **80 palavras ao todo**, com um mínimo em cada tópico e variedade de palavras. Em **Guia dos relatos**, o narrador pode ajustar o mínimo total de 50 a 600.

Essas verificações ajudam a estruturar a memória; não certificam a qualidade. **Não há XP automático por quantidade de texto.** Você lê e decide se o conteúdo ajuda a retomar a história. Pode pedir complemento com uma observação, e o jogador edita e reenvia o mesmo relato. Cópias exatas de relatos já enviados para aquela ficha são recusadas, e só há um relato aguardando avaliação por personagem. Textos curtos podem ser salvos como rascunhos.

A recompensa vai à ficha do relato, com histórico e notificação, somente se ela ainda pertencer ao autor. Se foi transferida, o sistema recusa premiar o novo dono pelo texto de outra pessoa.

### Galeria e feedback

Feitos e títulos ficam na **conta**, não na ficha. Evoluções e disciplinas aprendidas passam a formar a galeria automaticamente; a atualização recupera também os recibos de evolução que ainda existirem no acervo anterior. Não inventa conquistas históricas cujos registros já tenham sido apagados. Reconhecimentos manuais aparecem numa celebração ao próximo acesso e continuam guardados depois de vistos. Conceder um título, por si só, não concede XP.

Feedbacks são privados entre autor e narrador. Responder com **0 XP** registra a leitura; você pode conceder XP depois se aproveitar a contribuição. Há uma entrega de XP por feedback. Escolha a ficha do autor que recebe: as histórias permanecem separadas. Após a avaliação, o texto fica preservado. O narrador pode apagar o registro, sem desfazer uma recompensa já entregue.

### Documentos e laços

Documentos aceitam texto e imagem JPG/PNG/WebP, com assinatura e descrição; esta versão não possui visualizador de PDF. O acesso reservado usa **contas selecionadas**, valendo para todos os personagens daquela pessoa. Nenhum jogador selecionado significa um documento reservado aos narradores. Revogar o acesso também bloqueia novas leituras da imagem pela API; uma cópia já baixada não pode ser recolhida.

Laços ativos vão de **1 a 5**; **0** registra um vínculo rompido. Use **Quem me prende** ou **Quem eu prendo**. Os estágios são Fervor rubro, Eco nas veias, Sangue distante, Fios de cinza e À beira da ruptura. O jogador marca conforme o roleplay, e o narrador pode ajustar. Não existe contagem de dias reais ou relógio do universo.

Marcar o último estágio **não reduz o nível sozinho**. Depois, **Enfraquecer um nível** pede confirmação e registra a perda. **Renovar o sangue** registra o encontro e retorna ao Fervor rubro; reforçar um nível é uma escolha explícita, limitada a 5. As animações distinguem estar preso, dominar alguém e perder força no laço. Cada alteração fica no histórico da ficha.

### Carregamento e evolução

O carregamento volta ao centro, com fundo escuro e bloqueio temporário da interação. Aparece quando uma ação realmente precisa esperar o servidor; operações concluídas rapidamente não precisam piscar a tela. Não há duração mínima artificial. A sincronização de fundo continua silenciosa.

**Revisar evolução** abre um diálogo com nível atual, nível desejado, custo e saldo restante, usando os dados já carregados. Essa etapa não consulta nem grava a ficha. Ao confirmar, o servidor confere novamente saldo, revisão, regras e custo; se algo mudou, pede uma nova revisão. Evoluções continuam com celebração, registro na galeria e histórico.

## 7. Conferir antes de liberar a mesa

1. Confira suas campanhas, fichas, mapas, fotos e regras personalizadas.
2. Em uma conta de testes, envie um relato e avalie como narrador. Confira o +1 XP, o histórico e a notificação. Reabra o relato: a entrega não deve aparecer novamente.
3. Crie um documento reservado a um jogador. Confirme que outro jogador da mesma campanha não consegue abri-lo.
4. Conceda um título e entre como destinatário. Confira a celebração e a galeria, inclusive trocando de personagem.
5. Envie e responda um feedback; confira a ficha escolhida para receber XP.
6. Registre um laço, mude o estágio e confirme um desgaste. Recarregue e confira o nível salvo.
7. Abra a evolução, clique em Revisar e cancele. O saldo deve permanecer igual. Confirme uma evolução de teste e confira o custo.
8. Baixe um backup completo novo depois da conferência. Reative os deploys automáticos, se desejar, e libere a mesa.

## 8. Resolver problemas e voltar de versão

| Situação | O que conferir |
| --- | --- |
| Health mostra 10.0 ou 9.x | Serviço, branch e commit do último deploy do Render |
| Site não mostra as novas áreas | Commit/deploy do Vercel, recarregamento e `COROA_API_BASE` |
| `MIGRATION_REQUIRED` | Instalação anterior à 10: aplique o SQL indicado na etapa 1 |
| Portal continua em manutenção | `COROA_MAINTENANCE=0` no Render e novo deploy |
| Relato não envia | Complete os quatro tópicos, o mínimo total e a variedade; confira se já há outro relato aguardando leitura naquela ficha |
| Recompensa recusada | Confira revisão, recompensa anterior e se a ficha ativa ainda pertence ao autor |
| Documento ou foto retorna 403 | Sessão, campanha, destinatários e encaminhamento `/api`; mantenha o bucket privado |
| Conexão caiu depois de confirmar XP | Reabra saldo/histórico e o registro avaliado antes de repetir |

A 10.1 lê dados das versões anteriores, mas a 10.0 **não lê diretamente o formato interno 10.1**. Não faça rollback somente do código depois da conversão.

Para retornar a um código anterior, primeiro baixe um backup completo atualizado, coloque a **10.1 em manutenção** e, com as variáveis do serviço, execute:

```sh
npm run storage:legacy -- --confirm-legacy
```

O comando converte os dados atuais para o formato v4 compatível. Só depois publique o backend/frontend anteriores e confira antes de liberar. As áreas novas não existirão na interface antiga. Preserve o backup atualizado para recuperar todo o acervo na 10.1; restaurar um backup anterior perde alterações feitas depois dele. Não remova a migração SQL nem execute exclusões de tabelas.

A validação desta entrega está em `docs/VALIDACAO-V101.md`. O relatório `docs/DESEMPENHO-10.md` registra a medição anterior da arquitetura 10.0, não uma nova medição desta versão nem uma promessa de latência em produção. Nenhum serviço real foi alterado durante a preparação deste pacote.

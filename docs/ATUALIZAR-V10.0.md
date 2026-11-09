# A Coroa Velada 10.0 oficial · tutorial de atualização

Esta atualização mantém o jogo atual e acelera a comunicação entre navegador, Render e Supabase. Não é necessário criar contas, campanhas, buckets ou serviços novamente. **Há uma migração SQL obrigatória**, seguida da publicação do backend e do frontend.

Fichas, XP, dinheiro, mapas, fotos, login, recompensas, históricos e regras personalizadas permanecem. **Não importe `data/game_data.json` para atualizar:** ele é o modelo de uma instalação nova. Seu livro atual continua no banco.

## O que fica mais rápido

- Gravação apenas dos registros modificados, em uma transação no Supabase.
- Fotos e mapas carregados separadamente, com autenticação e cache privado, sem viajar dentro de todas as respostas JSON.
- A resposta de um salvamento já pode atualizar a tela, evitando outra consulta de fichas e regras.
- Sincronização com uma revisão pequena e busca das alterações quando necessário.
- Aviso discreto nos salvamentos comuns; a navegação não fica coberta pelo carregamento central.
- Restauração do login em uma consulta; presença diária verificada depois de abrir a tela.

O banco continua em JSONB. Backups JSON e ZIP continuam portáteis, com imagens incluídas. O navegador não usa localStorage nem IndexedDB. “Salvo” continua significando confirmação do banco.

## 1. Preparar

1. Avise os jogadores que haverá uma pausa para atualizar. Peça que concluam as alterações antes dela.
2. Entre como narrador na versão atual. Em **Arquivos e backups**, baixe um **backup completo do portal** e aguarde o download terminar. Guarde também o ZIP 9.3.1. Ficha individual e game-data não substituem o backup completo.
3. Extraia o ZIP 10.0 numa pasta nova. Dentro de `theveiledcrown`, confira `package.json`, `server`, `client` e `supabase` no mesmo nível.
4. Anote o commit atual do Render e o deployment atual do Vercel. Preserve as variáveis nos painéis; não publique credenciais no GitHub.
5. Prefira deploy manual durante a atualização. Se o Vercel estiver publicando cada push automaticamente, pause essa publicação enquanto segue os passos.

A ordem é **SQL → API em manutenção → conversão → frontend → reabrir**. Não apague tabelas, buckets ou imagens. Não use `db reset`, “Reset portal” ou importação de backup para atualizar.

## 2. Supabase · aplicar o SQL

1. Abra o **mesmo projeto Supabase** usado hoje.
2. Entre em **SQL Editor → New query**.
3. Abra este arquivo do ZIP em um editor de texto:

   ```text
   supabase/migrations/202611080001_incremental_v10.sql
   ```

4. Copie **todo o conteúdo**, cole na consulta e clique em **Run**.
5. Confira que termina sem erro. No Table Editor, `coroa_documents` passa a ter a coluna `revision`, e aparece `coroa_deleted_documents`. As tabelas e imagens atuais continuam lá.

A migração acrescenta índices, controle de alterações e funções de gravação incremental. Pode ser executada novamente se necessário. Mantém a função antiga compatível enquanto a API anterior ainda estiver publicada. As novas funções ficam restritas ao servidor.

**Instalação existente usa somente esse arquivo.** `supabase/INSTALAR.sql` é o instalador completo para projetos novos. Não precisa mudar o bucket para público nem contratar outro plano Supabase para habilitar esta atualização.

## 3. GitHub · substituir todos os arquivos

O **GitHub Desktop** facilita a atualização completa:

1. Abra ou clone `Ericx66x6/theveiledcrown` no Desktop.
2. Abra a pasta local do repositório. Preserve `.git` e qualquer `.env` local; nunca publique o `.env`.
3. Copie o conteúdo da pasta `theveiledcrown` do ZIP para a raiz do repositório, substituindo os arquivos. Não crie uma segunda pasta envolvendo o projeto.
4. Confira os arquivos novos, principalmente a migração SQL, `server/storage-documents.mjs`, `server/media-access.mjs` e `tools/storage-maintenance.mjs`.
5. Faça commit com a mensagem `A Coroa Velada 10.0 oficial — desempenho e gravação incremental` e clique em **Push origin**.

Se usar upload pelo navegador, envie os arquivos extraídos preservando todas as pastas e confira se incluiu tudo. Não envie somente o ZIP. Não envie `node_modules`, `dist`, `.qa` ou credenciais. Na raiz do GitHub, `package.json` deve mostrar `"version": "10.0.0"`.

Se você já conectou o projeto ao GitHub pelo **VS Code**, pode fazer o mesmo por ele: substitua os arquivos na pasta do repositório, revise as mudanças em **Controle do Código-Fonte** e confira que `.env` não aparece entre os arquivos a enviar. No terminal dessa pasta:

```sh
git status
git add .
git commit -m "A Coroa Velada 10.0 oficial"
git push
```

Use a branch conectada ao Render/Vercel. Se `git status` mostrar outra branch, confira essa configuração antes de publicar. Não é preciso executar `git init` novamente num repositório já conectado.

## 4. Render · publicar a API em manutenção

Use o serviço existente. Em **Settings**, confira:

| Campo | Valor |
| --- | --- |
| Runtime | Node |
| Branch | A branch atualizada, normalmente `main` |
| Root Directory | Vazio, se o projeto está na raiz |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

Em **Environment**, preserve os valores existentes e acrescente a manutenção:

| Variável | Valor |
| --- | --- |
| `SUPABASE_URL` | A mesma Project URL atual |
| `SUPABASE_SECRET_KEY` | A chave privada já configurada no servidor; `SUPABASE_SERVICE_ROLE_KEY` também continua aceita |
| `SUPABASE_IMAGE_BUCKET` | O mesmo bucket privado atual, normalmente `coroa-imagens` |
| `BOOTSTRAP_TOKEN` | Mantenha o atual |
| `NODE_VERSION` | `24` |
| `NODE_ENV` | `production` |
| `TRUST_PROXY` | `1` |
| `ALLOWED_ORIGINS` | As mesmas origens exatas do Vercel e do domínio próprio |
| **`COROA_MAINTENANCE`** | **`1` durante a atualização** |

A chave privada permanece só no backend. Não precisa gerar uma nova chave por causa desta versão.

Salve e use **Manual Deploy → Deploy latest commit**. Aguarde **Live**. Abra a URL real do Render seguida de `/api/health`. A resposta precisa conter:

```json
{"status":"ok","version":"10.0.0","storage":"incremental-v10","maintenance":true}
```

A ordem das propriedades não importa. Agora os acessos e gravações ficam temporariamente bloqueados com um aviso; a rota de saúde continua disponível. A versão antiga não reconhece essa variável: confirme **10.0.0** e manutenção **true** antes de converter os documentos.

## 5. Converter os documentos atuais

A API 10 lê o formato antigo, mas a conversão controlada prepara os registros antes de reabrir a mesa. **Faça com a API 10 em manutenção e sem outro servidor antigo gravando no mesmo Supabase.**

### Opção A · Shell do Render

Se seu serviço disponibilizar a aba **Shell**, abra-a e execute:

```sh
npm run storage:migrate
```

O comando usa as variáveis do próprio serviço. Aguarde a conclusão. Exemplo de saída, com números fictícios:

```json
{"status":"concluido","format":"incremental v10","revision":123,"campaigns":2,"characters":8,"accounts":6}
```

Confira se as quantidades correspondem ao portal. Não reabra se aparecer erro.

### Opção B · computador, sem Shell no Render

1. Instale **Node.js 24** e abra a pasta extraída da 10.0 no VS Code.
2. Abra **Terminal → New Terminal** nessa pasta e execute `npm ci`.
3. Crie um arquivo local **`.env`** na raiz com estes nomes e os valores existentes do Render:

   ```dotenv
   SUPABASE_URL=https://SEU-PROJETO.supabase.co
   SUPABASE_SECRET_KEY=COLE-A-CHAVE-PRIVADA-DO-RENDER-AQUI
   SUPABASE_IMAGE_BUCKET=coroa-imagens
   COROA_MAINTENANCE=1
   ```

   Preserve o nome real do bucket. Crie esse arquivo no seu editor local, nunca no GitHub. O `.gitignore` já exclui `.env`.

4. Confirme novamente que o servidor publicado informa manutenção `true`. Definir a variável no computador **não** coloca o Render em manutenção.
5. Execute `npm run storage:migrate` e confira a saída descrita na opção A.
6. Remova o `.env` da pasta de distribuição ao terminar, ou mantenha-o somente no seu ambiente privado de desenvolvimento.

A conversão pode demorar mais que uma gravação comum: organiza o acervo uma vez. Não recria personagens nem concede XP. Repetir o comando, ainda em manutenção, não deve duplicar registros.

## 6. Vercel · publicar o frontend

Use o projeto existente ligado ao mesmo GitHub:

| Campo | Valor |
| --- | --- |
| Framework | Other |
| Root Directory | Raiz do projeto |
| Install Command | `npm ci --include=dev` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js | `24.x` |
| `COROA_API_BASE` | A mesma URL HTTPS do Render, sem `/api` no final |

Mantenha `vercel.mjs`. Ele encaminha `/auth` e `/api`, **inclusive as imagens privadas**, pelo domínio do site, mantendo cookie e fotos funcionando. Não coloque a chave Supabase no Vercel nem substitua esse encaminhamento por links de bucket público.

Publique o commit novo ou faça **Redeploy**. Se usar `COROA_SITE_URL` para compartilhamento, preserve seu valor. Não importe outro game-data, não restaure backup e não cadastre o narrador novamente.

## 7. Reabrir e conferir

1. No Render, altere `COROA_MAINTENANCE` para **`0`**, salve e publique novamente a API 10.
2. Aguarde **Live**. Confira o health: versão 10.0.0 e `maintenance:false`.
3. Abra o domínio normal do Vercel e recarregue uma vez. O rodapé mostra **V10.0 OFICIAL**.
4. Entre como narrador e confira campanhas, personagens, regras personalizadas, fotos e mapas.
5. Altere um valor pequeno numa ficha de teste. Aguarde a confirmação e recarregue: o valor precisa permanecer. Salvamentos comuns mostram um aviso discreto, sem cobrir a tela inteira.
6. Abra outra aba ou navegador como jogador. Confira atualização ao recuperar o foco ou na próxima verificação automática, a cada 20 segundos com a aba visível. Formulários em edição são preservados.
7. Confira XP em lote, evolução, dinheiro, notas e mapa privado usando dados de teste. O jogador continua vendo apenas o que seu acesso permite.
8. Baixe um backup completo novo. Ele continua incluindo as imagens dentro do JSON, sem depender dos links deste servidor.

Depois da conferência, reative os deploys automáticos se desejar e libere os jogadores. Reiniciar o Render não apaga gravações confirmadas.

## 8. Render Free e a demora depois de ficar parado

O código reduz o trabalho, mas não controla a suspensão do provedor. Segundo a documentação do Render, uma instância **Free** adormece após **15 minutos sem tráfego recebido** e pode levar **cerca de um minuto** para acordar. Se o atraso ocorre na primeira entrada após um período parado, a refatoração não elimina essa parte.

Para evitar suspensão por ociosidade, altere o **compute do Web Service** para uma instância paga adequada à sua conta. Fazer upgrade apenas do plano do **workspace** não remove a limitação da instância Free. A decisão de plano é sua; nenhum plano foi contratado nesta entrega.

API e banco próximos também ajudam: procure manter o serviço Render perto da região do Supabase. Mudar a região de um serviço Render existente exige outro serviço; não é necessário fazer isso para atualizar para 10.0. Meça antes de reorganizar a infraestrutura.

Fontes oficiais consultadas em 08/11/2026: [Render Free](https://render.com/docs/free), [regiões do Render](https://render.com/docs/regions), [chaves do Supabase](https://supabase.com/docs/guides/getting-started/api-keys).

## 9. Se algo não funcionar

| Sintoma | O que conferir |
| --- | --- |
| “Atualização SQL da versão 10.0 ainda não foi aplicada” / `MIGRATION_REQUIRED` | Execute o SQL da etapa 2 no projeto correto. Ele já solicita recarregar o schema. Se necessário, rode `notify pgrst, 'reload schema';` no SQL Editor. |
| Health ainda mostra 9.x | Confira serviço, branch, commit e logs do último deploy do Render. Não importe backup para corrigir código antigo. |
| “Portal está sendo atualizado” depois de tudo pronto | Confira `COROA_MAINTENANCE=0` no Render e publique novamente. |
| Funciona no Render, mas falha no Vercel | Confira `COROA_API_BASE`, redeploy do Vercel, `vercel.mjs` e origem exata do domínio em `ALLOWED_ORIGINS`. |
| Imagem retorna 403 | Confira login, permissão do mapa/personagem e encaminhamento `/api` no Vercel. O bucket permanece privado. |
| Imagem ausente / 404 | Confira o bucket e a existência do objeto original. Não apague os registros para corrigir; use backup completo se houve perda de arquivos. |
| Conflito / campanha mudou em outra conexão | Atualize e confira o valor salvo antes de repetir. Evite duas edições simultâneas da mesma ficha. |
| Conexão caiu durante pagamento ou recompensa | Reabra e confira saldo/histórico antes de repetir: a conexão pode cair depois do commit. |
| Tudo demora só depois de ficar parado | Veja a etapa 8 sobre a instância Free. |

O cabeçalho `Server-Timing`, na aba Network do navegador, informa leitura (`db`), gravação (`commit`) e processamento total (`app`). O relatório `docs/DESEMPENHO-10.md` explica a comparação local. Os tempos dele não são promessa de latência em produção.

## 10. Voltar à versão anterior, se necessário

O armazenamento interno mudou. **Não publique apenas o código 9.3.1 sobre um banco já convertido:** ele não entende o formato novo.

Para voltar preservando alterações feitas depois da atualização:

1. Na 10.0, baixe um backup completo atualizado. Ative `COROA_MAINTENANCE=1` no Render, publique e confira o health. Garanta que nenhum outro servidor esteja gravando.
2. No Shell do Render, ou no terminal local com o `.env` da etapa 5 e manutenção `1`, execute:

   ```sh
   npm run storage:legacy -- --confirm-legacy
   ```

3. Aguarde `"format":"compatível com 9.3.1"`. O comando reconverte **os dados atuais**, sem restaurar um ponto antigo no tempo.
4. Publique backend e frontend **9.3.1** guardados no início. A versão antiga ignora a variável de manutenção: só publique depois da conversão e mantenha os jogadores avisados até conferir o funcionamento.
5. Confira fichas, saldos, fotos e login. Remova a variável temporária ao terminar.

Não remova a migração SQL: ela mantém as funções antigas. Restaurar backup anterior é o último recurso, pois perde alterações posteriores à data dele. Os tutoriais antigos estão em `docs/HISTORICO-ATUALIZACOES-V9.md` apenas para referência.

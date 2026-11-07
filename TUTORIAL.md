# A Coroa Velada 8 · instalação online

Para atualizar uma instalação existente, siga primeiro [ATUALIZAR.md](ATUALIZAR.md).

Esta entrega usa o GitHub para o código, o Render para uma API em **Node.js 24**, o Supabase para documentos JSON e imagens e o Vercel para o site. O ZIP é o código-fonte: extraia antes de enviar ao GitHub. A versão offline foi removida.

Não há credenciais reais no pacote. Você precisa copiar a **Project URL** do Supabase e gerar uma **nova chave privada**. Configure os valores nos painéis indicados abaixo; não precisa enviá-los por mensagem.

## 1. Preparar o Supabase

### Trocar a chave compartilhada

Como uma chave privada foi compartilhada na conversa, abra seu projeto no [Supabase](https://supabase.com/dashboard), vá a **Settings → API Keys**, crie uma nova secret key e revogue a anterior. Se outro serviço ainda a usa, atualize esse serviço com a nova chave antes da revogação.

Guarde a nova `sb_secret_…` para o **Environment do Render**. Ela não entra no GitHub, Vercel, HTML ou JavaScript do navegador. A chave publishable não é necessária nesta arquitetura, pois todas as operações passam pela API autenticada do portal.

No botão **Connect** do projeto, copie a **Project URL**, no formato `https://SEU-PROJETO.supabase.co`. Use a URL do projeto, sem `/rest/v1`, sem caminho de bucket e sem string de conexão PostgreSQL. Se a Data API estiver desabilitada, habilite-a nas configurações de API do projeto, mantendo o schema `public` exposto.

### Instalar tabelas, funções e imagens

1. No Supabase, abra **SQL Editor → New query**.
2. No ZIP extraído, abra `supabase/INSTALAR.sql` com um editor de texto.
3. Copie **todo** o conteúdo para a consulta e clique em **Run**.
4. Confira no **Table Editor** as tabelas `coroa_documents` e `coroa_revision`.
5. Confira em **Storage** o novo bucket **`coroa-imagens`**, marcado como **Private**.

O instalador não apaga seus buckets antigos de imagens ou fichas. Pode mantê-los. Esta versão passa a usar:

| Local | Conteúdo |
| --- | --- |
| `public.coroa_documents` | Documentos JSONB separados por caminho: contas, campanhas, regras e personagens |
| `public.coroa_revision` | Revisão usada para impedir que dois salvamentos sobrescrevam dados silenciosamente |
| Storage `coroa-imagens` | Fotos, retratos, imagens de NPCs e mapas JPG, PNG ou WebP |

JSONB é o documento JSON armazenado no banco. Você continua podendo baixar os JSONs pelo painel, mas não precisa criar arquivos nem fazer upload manual de cada ficha no Supabase. As imagens são enviadas ao Storage pela API; os documentos guardam referências. Os backups autorizados reconstituem as imagens dentro do JSON.

O bucket novo tem limite de 45 MiB por objeto. Em **Storage → Settings**, deixe o limite global de upload em pelo menos 45 MiB, respeitando o limite do seu plano. A interface pode reduzir imagens antes do envio e também possui limites de tamanho. Não marque o bucket como público e não adicione políticas de acesso anônimo para ele: só o servidor deve acessá-lo. O SQL inclui proteção mesmo se seu projeto já tiver políticas antigas mais amplas para outros buckets.

Se aparecer que `coroa-imagens` precisa ser privado, abra as configurações desse bucket, desative o acesso público e execute o instalador novamente. Não remova tabelas ou buckets para tentar corrigir isso.

## 2. Enviar o projeto ao GitHub

Use o repositório novo **[Ericx66x6/theveiledcrown](https://github.com/Ericx66x6/theveiledcrown)**.

1. Extraia o ZIP. Entre na pasta `theveiledcrown` que está dentro dele.
2. Abra o repositório no GitHub e escolha **Add file → Upload files**. Para o repositório vazio, também pode usar o link **uploading an existing file**.
3. Arraste os arquivos e as pastas **de dentro** de `theveiledcrown` para a área de upload. Não envie apenas o ZIP nem uma pasta extra envolvendo tudo.
4. Clique em **Commit changes** e confirme a branch `main`.
5. Na página inicial do repositório, confira que `package.json`, `render.yaml`, `vercel.mjs`, `TUTORIAL.md`, `client/`, `server/` e `supabase/` aparecem na raiz.

O GitHub limita o upload pelo navegador a 100 arquivos por vez e 25 MiB por arquivo. Se a seleção ultrapassar esse número, envie os arquivos da raiz primeiro e depois grupos de pastas, sempre a partir da página **raiz** do repositório, preservando a estrutura. O GitHub Desktop também pode publicar a pasta extraída inteira.

Não envie `node_modules`, `.git`, `.qa`, `dist` nem um arquivo `.env` com valores reais. Eles não estão no ZIP. Os arquivos `.env.render.example` e `.env.vercel.example` são apenas modelos sem credenciais; podem ficar no repositório. Caso o seletor de arquivos esconda arquivos iniciados por ponto, ao menos confira `package.json`, `render.yaml` e `vercel.mjs`: eles já definem a instalação principal. Para preservar todo o código e o CI, use o GitHub Desktop se necessário.

## 3. Criar a API no Render

No [Render](https://dashboard.render.com), escolha **New → Web Service**, conecte sua conta GitHub e selecione `Ericx66x6/theveiledcrown`. Autorize o acesso ao repositório caso ele seja privado.

Preencha assim:

| Campo | Valor |
| --- | --- |
| Name | `theveiledcrown-api` ou outro nome disponível |
| Branch | `main` |
| Language / Runtime | `Node` |
| Root Directory | Deixe vazio: o `package.json` está na raiz |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

Escolha a região e o plano adequados à sua conta. O projeto não precisa de disco persistente no Render: os dados duráveis ficam no Supabase. O servidor usa a porta `PORT` fornecida pelo Render; não precisa criar uma variável `PORT` manualmente.

### Variáveis do Render

Em **Environment**, cadastre:

| Nome exato | Valor |
| --- | --- |
| `SUPABASE_URL` | Project URL copiada do Supabase |
| `SUPABASE_SECRET_KEY` | **Nova** chave privada do projeto |
| `SUPABASE_IMAGE_BUCKET` | `coroa-imagens` |
| `BOOTSTRAP_TOKEN` | Uma chave aleatória de instalação com pelo menos 32 caracteres |
| `NODE_VERSION` | `24` |
| `NODE_ENV` | `production` |
| `TRUST_PROXY` | `1` |
| `ALLOWED_ORIGINS` | Inicialmente vazio ou ausente; preencheremos após criar o Vercel |

Use um gerador de senhas para `BOOTSTRAP_TOKEN`. Se tiver Node instalado, este comando gera uma chave de 64 caracteres:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Essa chave é só para criar o primeiro narrador; não é a senha da conta e não é a chave do Supabase. Guarde-a até terminar o primeiro acesso. Não coloque aspas extras nos valores do painel.

**Não configure `COROA_API_BASE` no Render.** Ela será usada no build do Vercel. No Render, o servidor também disponibiliza o frontend em sua própria origem para facilitar o primeiro acesso e o diagnóstico.

Clique em **Deploy Web Service**. Ao ficar **Live**, copie o endereço HTTPS que o Render realmente gerou. A seguir, chamaremos esse endereço de **URL-DO-RENDER**.

Abra `URL-DO-RENDER/api/health`. A resposta esperada contém:

```json
{"status":"ok","version":"9.0.0"}
```

Depois abra somente `URL-DO-RENDER`. Clique em **Entrar** para chegar ao formulário do primeiro acesso. Preencha nome, login, senha com pelo menos dez caracteres e a `BOOTSTRAP_TOKEN` configurada no Render. Clique em **Criar portal e entrar**.

O primeiro narrador e a campanha inicial são gravados no Supabase. Não precisa cadastrar esse usuário no Supabase Auth. O portal tem seu próprio sistema de contas e permissões. Após a instalação, o formulário passa a pedir apenas login e senha. Não há um personagem automático do narrador.

O arquivo `render.yaml` oferece a mesma configuração para quem preferir **New → Blueprint**. Use um dos caminhos, para não criar dois serviços. No Blueprint, o Render gera a `BOOTSTRAP_TOKEN`; consulte seu valor no Environment antes do primeiro acesso. O YAML deixa o deploy automático desligado; atualizações podem ser feitas por **Manual Deploy → Deploy latest commit**.

## 4. Publicar o site no Vercel

No [Vercel](https://vercel.com/new), escolha **Add New → Project**, importe `Ericx66x6/theveiledcrown` e confira:

| Campo | Valor |
| --- | --- |
| Framework Preset | `Other` |
| Root Directory | Raiz do repositório; não selecione `client` |
| Install Command | `npm ci --include=dev` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js Version | `24.x` |

`vercel.mjs` já declara os comandos, a pasta de saída e os encaminhamentos da API. Apague um eventual `vercel.json` antigo; mantenha apenas `vercel.mjs`. Em **Environment Variables**, adicione **antes de publicar**:

| Nome | Valor |
| --- | --- |
| `COROA_API_BASE` | A URL HTTPS exata do serviço Render, por exemplo `https://nome-real.onrender.com` |

O valor deve ser só a origem, sem `/api`, `/api/health`, token, usuário ou senha. Marque **Production**. Se também for usar Preview, configure a variável nesse ambiente e libere depois a origem correspondente no Render. Não coloque a chave privada nem a publishable do Supabase no Vercel.

Clique em **Deploy**. Depois copie o **domínio de produção** que o Vercel realmente atribuiu ao projeto. Use o domínio estável de produção ao compartilhar com os jogadores, pois cada deploy também pode ter um endereço próprio.

Se o projeto já tinha sido publicado antes de adicionar a variável, vá em **Deployments → Redeploy**. A URL da API é incluída durante o build; alterar a variável exige uma nova compilação.

## 5. Liberar o domínio do Vercel na API

Volte ao Render → seu serviço → **Environment**. Agora defina:

```text
ALLOWED_ORIGINS=https://DOMINIO-REAL-DO-VERCEL.vercel.app
```

Substitua pelo domínio copiado, sem barra final nem caminhos. Clique em **Save and deploy** e aguarde **Live**.

Se usar domínio próprio e o domínio original do Vercel, separe por vírgulas, por exemplo:

```text
ALLOWED_ORIGINS=https://DOMINIO-REAL-DO-VERCEL.vercel.app,https://SEU-DOMINIO.com.br
```

Não use `*`. Não basta autorizar `vercel.app`; a origem precisa ser exata. Um deploy de Preview com outro endereço também precisa de autorização explícita se você quiser usá-lo.

Abra o domínio de produção do Vercel, atualize a página e entre com o mesmo narrador criado no Render. Os dois endereços usam o mesmo servidor e os mesmos dados.

## 6. Conferir o funcionamento

Faça esta primeira conferência com uma ficha de teste:

1. Em **Cadastrar ficha**, digite nome, jogador, clã e níveis, como Força 3 e Destreza 2. O ID é gerado automaticamente. Pode criar o acesso junto da ficha ou vincular um acesso existente depois.
2. Em **Jogadores e acesso**, crie os participantes, ative/desative acessos e vincule personagens. Uma conta pode controlar várias fichas.
3. Em **Personagens → Distribuir XP**, marque os destinatários, preencha valor e motivo e confirme a recompensa.
4. Em **Missões**, atribua uma missão à ficha. Os números são uma previsão. Na entrega, o narrador pode ajustar XP, dinheiro e itens antes de confirmar. A recompensa é entregue uma vez e o jogador apenas consulta o andamento.
5. Envie um retrato e um mapa. Em **Storage → coroa-imagens**, devem aparecer objetos em `portal-v6/media/…`. Os nomes usam o conteúdo da imagem, não o nome do personagem.
6. Crie um mapa liberado aos jogadores e outro privado. Entre como participante em uma janela separada e confira que só o mapa autorizado aparece.
7. Confira as notas, a evolução com confirmação e o círculo de relações do personagem. O narrador não abre esse mural pelas rotas normais do portal.
8. Atualize a página, entre de novo e confira os dados. Os salvamentos concluídos devem continuar lá. Reiniciar o serviço Render também não deve apagá-los.

O login usa cookie persistente HttpOnly e volta automaticamente ao recarregar ou reabrir a aba. O navegador não grava o acesso em localStorage. O novo `vercel.mjs` encaminha `/auth` e `/api` ao Render mantendo a origem do site. Clique em Sair para encerrar o acesso; troca de senha, revogação da conta e limpeza dos cookies também encerram o login.

Outros clientes verificam mudanças a cada 20 segundos e ao recuperar o foco. Um formulário em edição não é substituído automaticamente. Se duas pessoas alterarem a mesma versão de uma ficha, a API pode pedir atualização antes de repetir a ação; confira os valores atuais para evitar duplicar uma recompensa ou compra.

Não há controle de sessões, noites ou horário do universo. Datas reais nos históricos servem para registrar alterações.

## 7. Trazer suas fichas e fazer backups

Para uma instalação nova, abra **Livro de regras** e importe seu `game_data.json` se quiser usar suas regras anteriores. Depois, em **Personagens → Importar JSON**, envie cada ficha. Vincule as fichas às contas em **Jogadores e acesso**. Os buckets antigos não são importados automaticamente e podem continuar preservados enquanto você confere a migração.

Se possui um backup completo gerado pelo portal, vá a **Arquivos e backups → Importar backup JSON ou ZIP**. Essa operação substitui o conjunto de contas e campanhas do portal: baixe um backup atual antes, confira o arquivo e digite `IMPORTAR` quando solicitado. Ao concluir, os acessos são encerrados; entre com um login contido no backup importado. Não use o ZIP do código-fonte como backup de dados.

Em **Arquivos e backups**, você pode baixar um JSON completo ou um ZIP com vários documentos JSON. O pacote inclui dados e imagens reconstituídas. Guarde-o em local privado: contém informações da campanha e os hashes de senha. O backup administrativo completo contém também dados necessários à recuperação, inclusive registros pessoais. Os downloads de jogadores são filtrados para o conteúdo autorizado.

Imagens antigas que existam somente em URLs de outro projeto devem ser reenviadas pela interface para entrar no novo bucket privado. Confira todas as fichas e mapas antes de pensar em excluir qualquer dado antigo. Arquivos de imagem sem referência não são apagados automaticamente, para preservar a possibilidade de recuperação.

## 8. Atualizações futuras

Edite o código e faça commit na `main`. O Vercel normalmente cria um novo deploy a partir da integração Git. No Render, confirme se **Auto-Deploy** está ligado; se estiver desligado, use **Manual Deploy → Deploy latest commit**.

Se trocar o endereço da API, atualize `COROA_API_BASE` no Vercel e refaça o deploy. Se trocar o domínio do site, atualize `ALLOWED_ORIGINS` no Render. Se uma próxima versão incluir migrações SQL, execute as novas migrações antes do servidor que depende delas. Não recrie tabelas para atualizar a interface.

## 9. Problemas comuns

| Sintoma | O que conferir |
| --- | --- |
| Vercel pede `COROA_API_BASE` | Adicione a variável no ambiente correto e faça **Redeploy** |
| Erro de `package.json` ou comando não encontrado | Os arquivos provavelmente ficaram dentro de uma pasta extra no GitHub; deixe `package.json` na raiz |
| Render exige URL/chave | Confira os nomes `SUPABASE_URL` e `SUPABASE_SECRET_KEY` em Environment e salve/republique |
| URL do Supabase inválida | Use a Project URL HTTPS, sem `/rest/v1`, credenciais ou conexão PostgreSQL |
| Bucket ausente ou público | Execute `supabase/INSTALAR.sql`, confira nome `coroa-imagens` e acesso **Private** |
| Falha em função/RPC ou banco | Confira se todo o SQL foi executado no mesmo projeto da URL/chave, se a Data API está ativa e veja os logs do Render |
| Falha ao enviar imagem | Use JPG/PNG/WebP, confira o limite global do Storage e tente uma imagem menor |
| Funciona no Render, falha no Vercel | Confira `COROA_API_BASE` no build e `ALLOWED_ORIGINS` com a origem exata do domínio aberto |
| Login inicial não aceita a chave | Use a `BOOTSTRAP_TOKEN` do Render, não a secret key do Supabase; a instalação só fica disponível antes da primeira conta |
| A página pede login após atualizar | Faça um login após a atualização; confira `vercel.mjs`, o encaminhamento da API e a permissão de cookies do próprio site |
| Conflito de revisão | Atualize a ficha e confira o resultado da última operação antes de repetir |

Ao compartilhar um erro, envie a mensagem e o trecho relevante do log, ocultando chaves, senhas e tokens. Não publique o conteúdo do Environment.

## Referências oficiais

- [Supabase: rotação de chaves expostas](https://supabase.com/docs/guides/security/rotate-leaked-api-keys)
- [Supabase: buckets privados e públicos](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Supabase: limites de upload](https://supabase.com/docs/guides/storage/uploads/file-limits)
- [GitHub: adicionar arquivos ao repositório](https://docs.github.com/pt/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)
- [Render: publicar Node](https://render.com/docs/deploy-node-express-app)
- [Render: variáveis de ambiente](https://render.com/docs/configure-environment-variables)
- [Render: versão do Node](https://render.com/docs/node-version)
- [Vercel: configurar a compilação](https://vercel.com/docs/builds/configure-a-build)
- [Vercel: versões do Node](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)

Os mapas geográficos usam OpenFreeMap/OpenStreetMap e não precisam de outra chave. As anotações compartilhadas exibem autoria, criação e perfil. A comunidade de cada campanha permanece isolada das demais.

## Recursos da versão 9 · Beta

Após a instalação, o narrador pode cadastrar informações em **Ecos do Véu**, liberar disciplinas em **Legados do Sangue** e personalizar cor/capa da campanha. O guia [ATUALIZAR.md](ATUALIZAR.md) explica esses controles, a escala dos mapas, o novo salão e a centralização das anotações. Nenhuma chave adicional é necessária.

Para domínio próprio, `COROA_SITE_URL` no Vercel define a origem pública do compartilhamento. Na URL padrão do Vercel, a origem de produção é detectada automaticamente. Consulte [ATUALIZAR.md](ATUALIZAR.md) para enquadramento, consulta rápida, ambição/desejo, áudio e preços dos legados.

# Atualizar para A Coroa Velada 8

A versão 8 usa seus serviços atuais: GitHub, API Node.js 24 no Render, Supabase e Vercel. **Não há SQL novo, bucket novo nem variável nova para esta atualização.** As contas, fichas, campanhas e imagens atuais continuam no mesmo Supabase.

## 1. Faça um backup e envie o código completo

No painel do narrador, use **Arquivos e backups → Exportar portal completo**. Guarde esse arquivo antes da atualização. Não use os botões de reset, importação ou limpeza para instalar o código.

O ZIP é código-fonte. Extraia e envie **o conteúdo da pasta `theveiledcrown` para a raiz** de `Ericx66x6/theveiledcrown`, substituindo os arquivos antigos. Na raiz devem aparecer `package.json`, `vercel.mjs`, `render.yaml`, `client`, `core` e `server`.

Esta entrega tem mais de 100 arquivos; o GitHub limita o upload pelo navegador a 100 por vez. Recomendo atualizar com **GitHub Desktop**:

1. Use **File → Clone repository** e escolha `Ericx66x6/theveiledcrown`.
2. Clique em **Fetch origin / Pull origin** para receber a versão atual.
3. Abra a pasta clonada pelo **Show in Explorer**.
4. Copie todo o conteúdo extraído de `theveiledcrown` para essa pasta e confirme a substituição. Inclua os arquivos iniciados por ponto, como `.gitignore` e `.env.render.example`.
5. Apague um eventual **`vercel.json` antigo**. O projeto usa somente **`vercel.mjs`**. Não apague a pasta `.git` do checkout.
6. No Desktop, revise as alterações, escreva `Atualização 8 — Ecos do Véu e Legados do Sangue`, faça **Commit to main** e depois **Push origin**.

Se preferir o navegador, envie primeiro `client`, `core`, `shared`, `server`, `tools` e `data` em um commit; depois envie os outros arquivos e pastas. Faça os deploys finais somente depois que o pacote inteiro estiver no GitHub. Não envie o ZIP fechado, `node_modules`, `dist`, `.qa`, `.git` ou um arquivo `.env` com credenciais.

## 2. Atualize a API no Render primeiro

Mantenha o serviço existente e confira:

| Campo | Valor |
| --- | --- |
| Branch | `main` |
| Runtime / Node | Node.js 24 |
| Build | `npm ci --include=dev && npm run build` |
| Start | `npm start` |
| Health check | `/api/health` |

Mantenha suas variáveis atuais: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_IMAGE_BUCKET`, `BOOTSTRAP_TOKEN`, `NODE_ENV`, `NODE_VERSION`, `TRUST_PROXY` e `ALLOWED_ORIGINS`. A chave privada continua somente no Render. Confira `TRUST_PROXY=1` e o domínio de produção do Vercel em `ALLOWED_ORIGINS`.

Use **Manual Deploy → Deploy latest commit** se o deploy automático estiver desligado. Aguarde **Live** e abra a URL do Render seguida de `/api/health`. A resposta precisa conter **`"version":"8.0.0"`**.

## 3. Atualize o frontend no Vercel

Mantenha `vercel.mjs` e a variável **`COROA_API_BASE` com a URL HTTPS atual do Render**, sem `/api` ou outros caminhos. O encaminhamento de `/auth` e `/api` pelo domínio do próprio site continua mantendo o login por cookie protegido.

| Campo | Valor |
| --- | --- |
| Framework | Other |
| Root Directory | Raiz do repositório |
| Install | `npm ci --include=dev` |
| Build | `npm run build` |
| Output | `dist` |
| Node | 24.x |

Após a API 8 ficar Live, publique o commit completo no Vercel. Se o Vercel compilou um upload incompleto ou publicou antes do Render terminar, faça **Redeploy**. Um aviso de que `engines` escolheu Node 24 em vez da versão configurada no painel não é erro; selecionar 24.x no painel deixa as configurações alinhadas.

Não crie outro narrador e não importe o backup para efetuar a atualização. Abra seu domínio normal e confira o indicador **V8**. Se houver um erro de rota nova, confira primeiro se o Render já informa versão 8.

## 4. Personalize sua campanha

Em **Minhas campanhas → Editar mesa**, escolha a cor e envie uma capa JPG, PNG ou WebP. Botões, iluminação, bordas, fundos e elementos da interface acompanham a cor da campanha aberta. As imagens mantêm suas cores originais. O campo de seleção de sistema de RPG foi removido.

O botão de alto-falante no topo controla **todos os efeitos sonoros**, inclusive dados, transições, confirmações e carregamento. A preferência fica salva na conta. O navegador libera áudio depois do primeiro toque/clique; não é necessário baixar arquivos de som ou configurar chaves.

## 5. Prepare os Ecos do Véu

O narrador abre **Ecos do Véu → Cadastrar informação** e preenche:

- Título, categoria, apresentação pública e capa opcional.
- Custo em XP e, se quiser, dinheiro.
- Conteúdo reservado e até seis imagens reservadas.

Os jogadores veem a apresentação e o preço. Ao comprar, escolhem **um personagem próprio**, conferem o saldo e confirmam. Esse personagem paga o custo inteiro; não existe divisão entre contas ou fichas. O conteúdo reservado só é enviado ao jogador depois da compra. A partir daí, toda a campanha pode consultar a descoberta, com o nome de quem investigou e os valores pagos.

O servidor confere saldos, preço e revisão e impede pagamentos duplicados ou concorrentes. Apagar uma descoberta não devolve recursos já pagos; o histórico do personagem conserva o registro. O narrador consulta e administra as informações, mas a compra é feita pelo acesso do jogador.

## 6. Libere os Legados do Sangue

No acesso do narrador, abra **Legados do Sangue**, marque as disciplinas permitidas e clique em **Salvar legados permitidos**. A seleção é independente por campanha e acompanha o `game_data` em `discipline_market.allowed_ids`.

O jogador paga sempre **10 XP** para acrescentar uma disciplina permitida ao personagem, com **nível 0**. Depois usa a evolução normal para comprar os níveis. Uma disciplina já conhecida não é comprada de novo. Retirar uma disciplina do catálogo não remove o que já foi adquirido.

O catálogo começa sem permissões automáticas na atualização: o narrador escolhe o que fica disponível. A concessão administrativa e as fichas enviadas para aprovação continuam disponíveis.

## 7. Posicione personagens e calibre o mapa

Cada jogador escolhe seu personagem no painel do mapa e usa **Marcar minha posição / Mudar minha posição**. O marcador tem retrato e nome. Por padrão, só o jogador responsável e o narrador veem a posição; o jogador pode compartilhar com a campanha ou voltar a reservar. O narrador vê todos, mas cada jogador controla seus próprios marcadores.

Para mover um marcador diretamente, dê **dois toques/cliques e arraste no segundo**. Um arraste simples não altera a posição salva. Também existe o posicionamento deliberado por botão e toque no mapa.

Nos mapas por imagem, o narrador usa **Calibrar escala**:

1. Toque no início de uma distância conhecida.
2. Toque no fim dessa referência.
3. Informe quantos **metros reais** a linha representa e salve.

A escala considera os pixels da imagem original, não os pixels da tela, e continua correta em qualquer zoom. Ao trocar a imagem, calibre novamente. Mapas geográficos calculam a distância pelas coordenadas e dispensam calibração.

Em **Medir distância**, o jogador parte de sua posição e toca no destino. O narrador pode escolher origem e destino livremente. A linha e o total em quilômetros ficam temporariamente no mapa. **Fechar medição** remove essa visualização e volta à navegação normal. Nenhuma rota de carro, barco, avião ou caminhada é calculada: o trajeto pertence ao roleplay. A base geográfica continua usando OpenFreeMap e depende da disponibilidade desse serviço externo.

## 8. Confira a ficha, o caderno e o salão

- O XP aparece em uma faixa evidente enquanto o jogador usa sua ficha. Ganhos de XP geram notificação, e evoluções registram nome do traço, níveis, custo e saldo.
- O narrador pode escrever uma **mensagem no histórico** ao editar a ficha completa ou ajustar traços. O histórico permanece salvo; só o narrador pode apagar registros. A interface carrega mais alterações por demanda.
- A busca do topo funciona em todas as páginas; `Ctrl+K` / `Cmd+K` também abre a pesquisa. Buscar traços e buscar no livro atravessa as categorias. `Força` aparece mesmo com Perícias abertas.
- Testes de disciplinas reconhecidos mostram os valores da ficha e a soma dos dados. O botão **Preparar rolagem** monta a parada. Combinações com termos desconhecidos ou alternativas pedem conferência manual, sem inventar valores. A oposição do teste fica separada.
- Aliados, contatos, domínios, favores, lacaios e itens podem receber imagens. Os cartões e os downloads dos personagens ficaram mais claros.

As anotações antigas das fichas, ambições/desejos e recados públicos antigos do salão são centralizados em **Anotações**, mantendo o conteúdo. As notas de ficha ficam privadas para a conta responsável; recados antes públicos entram no diário compartilhado. Notas de personagens ainda sem conta responsável são conservadas no JSON e migram quando o acesso é vinculado. Datas originais registradas em notas antigas continuam indicadas.

O **Salão da campanha** fica para conversar fora do jogo: mensagens privadas por notificação, cutucadas, brindes, perguntas para puxar assunto e desafios de pedra, papel e tesoura. Os desafios não usam recursos nem dão recompensas de jogo. A escolha fica oculta até a resposta; convites duram 48 horas. Presença e notificações usam a sincronização periódica do portal.

## Conferência após publicar

Abra dois acessos em navegadores ou dispositivos diferentes. Confira login, upload de capa, catálogo permitido, compra de uma informação de teste, marcador reservado/compartilhado, histórico e mensagens. O relatório [VALIDACAO.md](VALIDACAO.md) distingue os testes executados da conferência que depende dos seus serviços publicados.

Referências: [GitHub — envio de arquivos](https://docs.github.com/pt/repositories/working-with-files/managing-files/adding-a-file-to-a-repository) · [Áudio no navegador](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay). A instalação do zero continua em [TUTORIAL.md](TUTORIAL.md).

# Atualizar para A Coroa Velada 9.2.1 · Beta

A versão 9.2.1 usa seus serviços atuais: GitHub, API Node.js 24 no Render, Supabase e Vercel. **Não há SQL, bucket ou variável obrigatória nova.** Para domínio próprio, há uma variável pública opcional para o compartilhamento. As contas, fichas, campanhas e imagens atuais continuam no mesmo Supabase.

## 1. Faça um backup e envie o código completo

No painel do narrador, use **Arquivos e backups → Exportar portal completo**. Guarde esse arquivo antes da atualização. Não use os botões de reset, importação ou limpeza para instalar o código.

O ZIP é código-fonte. Extraia e envie **o conteúdo da pasta `theveiledcrown` para a raiz** de `Ericx66x6/theveiledcrown`, substituindo os arquivos antigos. Na raiz devem aparecer `package.json`, `vercel.mjs`, `render.yaml`, `client`, `core` e `server`.

Esta entrega tem mais de 100 arquivos; o GitHub limita o upload pelo navegador a 100 por vez. Recomendo atualizar com **GitHub Desktop**:

1. Use **File → Clone repository** e escolha `Ericx66x6/theveiledcrown`.
2. Clique em **Fetch origin / Pull origin** para receber a versão atual.
3. Abra a pasta clonada pelo **Show in Explorer**.
4. Copie todo o conteúdo extraído de `theveiledcrown` para essa pasta e confirme a substituição. Inclua os arquivos iniciados por ponto, como `.gitignore` e `.env.render.example`.
5. Apague um eventual **`vercel.json` antigo**. O projeto usa somente **`vercel.mjs`**. Não apague a pasta `.git` do checkout.
6. No Desktop, revise as alterações, escreva `Beta 9.2.1 — criação em etapas obrigatórias`, faça **Commit to main** e depois **Push origin**.

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

Use **Manual Deploy → Deploy latest commit** se o deploy automático estiver desligado. Aguarde **Live** e abra a URL do Render seguida de `/api/health`. A resposta precisa conter **`"version":"9.2.1"`**.

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

Após a API 9.2.1 ficar Live, publique o commit completo no Vercel. Se o Vercel compilou um upload incompleto ou publicou antes do Render terminar, faça **Redeploy**. Um aviso de que `engines` escolheu Node 24 em vez da versão configurada no painel não é erro; selecionar 24.x no painel deixa as configurações alinhadas.

Não crie outro narrador e não importe o backup para efetuar a atualização. Abra seu domínio normal e confira o indicador **V9.2.1 BETA**. Se houver um erro de rota nova, confira primeiro se o Render já informa versão 9.2.1.

## 4. Personalize sua campanha

Em **Minhas campanhas → Editar mesa**, escolha a cor e envie uma capa JPG, PNG ou WebP. Botões, iluminação, bordas, fundos e elementos da interface acompanham a cor da campanha aberta. As imagens mantêm suas cores originais. O campo de seleção de sistema de RPG foi removido.

O alto-falante do topo abre **O som da sua noite**. Efeitos e trilha ambiente têm interruptores e volumes separados; **Silenciar tudo** desliga os dois. A conta guarda as preferências. A trilha começa desativada; depois da sua escolha, toca uma composição instrumental de graves, drones e pulsos. Ela pausa ao ocultar a aba. O navegador libera áudio após uma interação; não há arquivos de som externos ou chaves adicionais.

## 5. Prepare os Ecos do Véu

O narrador abre **Ecos do Véu → Cadastrar informação** e preenche:

- Título, categoria, apresentação pública e capa opcional.
- Custo em XP e, se quiser, dinheiro.
- Conteúdo reservado e até seis imagens reservadas.

Os jogadores veem a apresentação e o preço. Ao comprar, escolhem **um personagem próprio**, conferem o saldo e confirmam. Esse personagem paga o custo inteiro; não existe divisão entre contas ou fichas. O conteúdo reservado só é enviado ao jogador depois da compra. A partir daí, toda a campanha pode consultar a descoberta, com o nome de quem investigou e os valores pagos.

O servidor confere saldos, preço e revisão e impede pagamentos duplicados ou concorrentes. Apagar uma descoberta não devolve recursos já pagos; o histórico do personagem conserva o registro. O narrador consulta e administra as informações, mas a compra é feita pelo acesso do jogador.

## 6. Libere os Legados do Sangue

No acesso do narrador, abra **Legados do Sangue**, marque as disciplinas permitidas e clique em **Salvar legados permitidos**. A seleção é independente por campanha e acompanha o `game_data` em `discipline_market.allowed_ids`.

O narrador define **Custo geral em XP** e pode preencher **Preço individual em XP** em cada disciplina. Campo individual vazio herda o custo geral; `0` libera gratuitamente. O valor inicial continua sendo 10 XP, até o narrador personalizar. O jogador confirma o preço exibido e acrescenta a disciplina ao personagem com **nível 0**. Depois usa a evolução normal para comprar os níveis. Uma disciplina já conhecida não é comprada de novo. Retirar uma disciplina do catálogo não remove o que já foi adquirido.

O catálogo começa sem permissões automáticas na atualização: o narrador escolhe o que fica disponível. A concessão administrativa e as fichas enviadas para aprovação continuam disponíveis.

## 7. Posicione personagens e calibre o mapa

Cada jogador escolhe seu personagem no painel do mapa e usa **Marcar minha posição / Mudar minha posição**. O marcador tem retrato e nome. Por padrão, só o jogador responsável e o narrador veem a posição; o jogador pode compartilhar com a campanha ou voltar a reservar. O narrador vê e posiciona todos os personagens; cada jogador controla somente os seus. A decisão de compartilhar continua sendo do jogador.

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

**Ambição e desejo voltam a ter uma área própria**, acessível na ficha e no menu do personagem. Cada campo é independente e pode ser alterado livremente. **Concluir** ou **Desistir** pede confirmação, registra o texto no histórico e limpa somente o campo escolhido. Cada resultado tem sua animação; não há recompensa automática em XP. Objetivos antigos em `goals` e as notas criadas automaticamente pela versão 8 voltam a essa área. Se houver mais de uma versão do texto, as anteriores ficam no histórico. Anotações criadas manualmente permanecem no caderno.

As anotações comuns das fichas e recados públicos antigos do salão continuam em **Anotações**, com autoria e data. Notas sem conta responsável são conservadas no JSON até o vínculo de acesso.

O **Salão da campanha** fica para conversar fora do jogo: mensagens privadas por notificação, cutucadas, brindes, perguntas para puxar assunto e desafios de pedra, papel e tesoura. Os desafios não usam recursos nem dão recompensas de jogo. A escolha fica oculta até a resposta; convites duram 48 horas. Presença e notificações usam a sincronização periódica do portal.

## 9. Use a consulta e o botão Voltar

**Sangue e poderes → disciplina** abre uma consulta compacta. As abas por nível mostram o poder, o teste e os valores da ficha. **Evoluir disciplina** fica depois da consulta e abre o planejamento de XP somente quando escolhido.

O **Voltar** aparece em todas as páginas internas. Ao preparar uma rolagem por um poder, você pode voltar para a mesma disciplina, no mesmo nível e posição da página. O histórico do navegador também funciona; filtros e escolhas da rolagem são mantidos durante essa navegação. **Início** leva ao painel do narrador ou à seleção dos personagens. Voltar não desfaz alterações já salvas. Recarregar a página começa uma nova trilha de navegação.

A pesquisa do topo encontra disciplinas, rituais e poderes por nome. Um poder encontrado abre diretamente sua consulta. Campos de pesquisa dos traços e do livro preservam o cursor enquanto você digita.

## 10. Enquadre o retrato e abra o mapa no celular

Em **Visão geral → Retrato**, use posição horizontal, posição vertical e aproximação. A prévia tem a proporção usada na ficha. Salve o enquadramento; a imagem original continua guardada e pode ser reenquadrada depois. **Centralizar** reinicia a prévia e **Remover o retrato** apaga a foto atual da ficha.

No celular, a galeria de mapas vira um seletor compacto. **Posição e distância** recolhe os controles menos usados e **Ver mapa** leva direto à área interativa. No desktop, a galeria e os controles continuam à vista.

## 11. Confira os detalhes de lançamento

O pacote inclui favicon SVG/ICO/PNG, ícones para celular, manifesto, título, descrição, Open Graph e imagem social de 1200 × 630. Esses arquivos são públicos e não contêm informações dos jogadores.

No Vercel, a origem principal de produção é detectada por `VERCEL_PROJECT_PRODUCTION_URL`. Se usar domínio próprio, adicione no Vercel a variável opcional **`COROA_SITE_URL=https://seu-dominio.com.br`**, sem caminho, e faça outro build. Ela serve ao endereço canônico, à imagem de compartilhamento e ao sitemap; não é a URL do Render e não contém uma chave.

Depois de publicar, compartilhe a URL pública da apresentação no WhatsApp e confira a miniatura. A geração foi validada no pacote; a leitura pelo WhatsApp depende do domínio publicado e do cache do serviço. O manifesto permite adicionar um ícone à tela inicial; o portal continua online e não adiciona cache de fichas para uso offline.

## Conferência após publicar

Abra dois acessos em navegadores ou dispositivos diferentes. Confira login, ambição/desejo, enquadramento, Voltar depois de uma rolagem preparada, preços dos legados, som, capa, compra de informação, marcador reservado/compartilhado e histórico. O relatório [VALIDACAO.md](VALIDACAO.md) distingue os testes executados da conferência que depende dos seus serviços publicados.

Referências: [GitHub — envio de arquivos](https://docs.github.com/pt/repositories/working-with-files/managing-files/adding-a-file-to-a-repository) · [Áudio no navegador](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay). A instalação do zero continua em [TUTORIAL.md](TUTORIAL.md).

## Testar as correções da versão 9.2

1. No acesso do narrador, abra **Mapa da campanha → Posição e distância**. Escolha um personagem e use **Marcar posição** ou **Mudar posição**, depois toque no destino no mapa. Também pode abrir a bolha de um personagem e tocar em **Mover personagem**.
2. Para arrastar, toque duas vezes e arraste no segundo toque. Um deslize simples não move o personagem. A mudança é salva ao soltar; se falhar, o marcador volta à posição anterior.
3. O narrador pode posicionar ou remover marcadores. A escolha de compartilhar ou reservar a posição continua sendo do jogador.
4. No menu do narrador, toque em **Testar como jogador**. Crie uma ficha temporária ou copie uma ficha ativa, escolhendo o XP e dinheiro para os testes. Os mapas compartilhados podem ser copiados.
5. O aviso **Visão de jogador · teste** confirma que está no teste. Compras, dinheiro, anotações, mensagens e posições não alteram a campanha real. As permissões são de jogador, sem acesso administrativo ou aos murais e notas pessoais dos jogadores reais.
6. Use **Voltar ao narrador** para descartar o teste. Recarregar a página retorna ao acesso normal. O teste também expira após 30 minutos sem atividade ou quando a API reinicia; o login normal permanece válido.

Não exige SQL, buckets, contas ou variáveis novas. Atualize o **Render antes do Vercel**, pois o novo botão depende da nova API.


## Criação guiada da versão 9.2.1

O jogador usa **Meus personagens → Criar personagem**. A criação tem 11 passos: identidade → atributos → habilidades → antecedentes → disciplinas → qualidades e defeitos → bônus em atributos → bônus em habilidades → bônus em antecedentes → bônus em disciplinas → revisão. Cada tela cuida de uma distribuição; avançar exige seguir a ordem. Ambição, desejo, história e convicções são opcionais. A ficha só entra no jogo depois de **Avaliar fichas → Aprovar personagem**.

- Atributos começam em 1, com mais 15 pontos e limite inicial 4.
- Talentos, perícias e conhecimentos compartilham 27 pontos, com limite inicial 3.
- Antecedentes recebem 5 pontos. Disciplinas recebem 3 pontos entre os três dons do clã; nível 0 é conservado.
- Há 15 pontos bônus: atributo custa 4 por nível, habilidade 2, disciplina 6 e antecedente 1. O limite final é 5, respeitando restrições de características.
- Até 4 defeitos concedem seus valores em pontos bônus; qualidades gastam o preço do catálogo. Não se usa XP. Versões incompatíveis e pré-requisitos cadastrados são conferidos.
- Geração começa em 13 e diminui um por ponto no antecedente, até 8. Recursos fornece o capital inicial uma única vez: 0 → R$ 0; 1 → R$ 1.000; 2 → R$ 8.000; 3 → R$ 50.000; 4 → R$ 500.000; 5 → R$ 5.000.000. Não há renda periódica automática.
- Giovanni escolhe a linha inicial de Necromancia; Tremere escolhe a de Taumaturgia. A linha acompanha a pontuação na criação, sem consumir a reserva duas vezes. Na evolução com XP, disciplina e linha primária permanecem vinculadas e a compra é cobrada uma vez.
- **Clã personalizado** permite digitar o nome e escolher três disciplinas cadastradas. A escolha fica sinalizada para a aprovação manual do narrador. As combinações da lista seguem as regras da mesa, inclusive Toreador com Potência.
- **Cada reserva inicial precisa ser gasta por completo.** Os bônus são uma reserva única: escolha quanto gastar em cada categoria e siga a ordem. Se sobrarem bônus no fim, o botão abre uma nova volta pelo ciclo. O envio exige **zero restante**, com conferência também na API. Voltar mantém as escolhas; retirar um defeito exige ajustar compras se o saldo ficar negativo.

Em **Livro de regras**, o modo inicial é **Consultar**. Use **Visualizar** para abrir o texto inteiro e os poderes sem formulário de edição. **Gerenciar livro** exibe as ferramentas de alteração. Em **Regras e criação de fichas**, o narrador pode ajustar reservas, limites, custos e máximo de defeitos. Campos avançados e clãs permanecem em `character_creation.guided` no game-data.

### Atualizar o livro de uma campanha que já existe

**Se você já usa o game-data de criação entregue com a versão 9.2, não precisa importar outro JSON para esta correção 9.2.1.** A ordem das telas e a obrigatoriedade de gastar os pontos estão no código. Os valores e os catálogos personalizados continuam no seu game-data. Atualize frontend e API.

Atualizar o código não substitui automaticamente os catálogos personalizados no Supabase. Depois de fazer backup, importe o JSON de regras entregue em **Livro de regras → Gerenciar livro → Importar game-data**. O arquivo separado mantém as configurações do game-data que serviu de origem e acrescenta os antecedentes e a criação; confira os preços de legados e suas configurações antes de aplicar. O `data/game_data.json` do projeto é o modelo para novas instalações, com configuração inicial neutra.

A importação é somente do **game-data**; não importe um portal completo para atualizar regras. Fichas já aprovadas não recebem dinheiro de novo nem têm geração ou traços recalculados. IDs anteriores dos catálogos foram preservados. Uma proposta antiga sem distribuição por etapas continua visível para revisão manual do narrador. Se o jogador a editar, ela abre no assistente: nome e narrativa são mantidos e os pontos precisam ser redistribuídos. A aprovação manual de exceções pelo narrador continua exigindo justificativa.

Os efeitos estruturados são mostrados na consulta e conferidos no envio. Monstruoso fixa Aparência; Criança impõe os limites e requisito; as versões do Beijo de Procuração concedem os pontos indicados. Bônus situacionais de testes, acontecimentos do roleplay e efeitos ainda descritos como manuais continuam sob aplicação do narrador. Consulte **docs/CRIACAO.md** para os campos e limites desta versão.

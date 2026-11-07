# Validação · A Coroa Velada 9.2.0 · Beta

Verificação em 07/11/2026. Código para frontend Vercel, API Node.js 24 no Render e documentos JSONB/imagens privadas no Supabase. Nenhum serviço ou dado de produção do usuário foi alterado.

## Testes automatizados

`npm run test:all` passou com **192 testes, sem falhas**. O comando compila o frontend, executa regras, domínio, gestos, áudio, API HTTP, SQL e Storage e confere sintaxe e referências aos assets.

- O narrador cria, move e remove posições de personagens ativos em mapas por imagem e geográficos. A visibilidade definida pelo jogador é preservada; outros jogadores continuam impedidos de alterar a posição alheia. Revisões concorrentes e mapas sem acesso são recusados.
- Gestos conferem o ponteiro principal, ignoram um segundo dedo e cancelam sem salvar ao perder a captura. A posição final considera as coordenadas ao soltar, mesmo sem o último evento de movimento. Arraste simples não muda a posição salva.
- O modo de jogador do narrador usa as mesmas regras e rotas de jogador, em documentos temporários separados. Compra, dinheiro, anotações, relações, mensagens e mapas não gravam no repositório real. Notas privadas, murais e contas reais não são copiados.
- A API HTTP confere o narrador e sua sessão em cada requisição de teste. Testes de outra sessão, cabeçalho forjado, acesso administrativo e contextos expirados são recusados. Uma segunda aba permanece no acesso normal. Logout encerra o login real; sair do teste conserva o cookie do narrador.
- Respostas de requisições antigas são ignoradas após trocar de visão. A troca bloqueia os controles antigos antes de carregar a nova campanha; uma falha de carregamento oferece recarregar, sem repetir uma alteração de teste na campanha real.

- Ambição e desejo em campos separados: edição pela própria conta, confirmação obrigatória, revisão e propriedade. Concluir/desistir limpa só o objetivo escolhido, preserva o texto no histórico e não concede XP automaticamente. Repetições são recusadas.
- Migração de `goals` e das notas automáticas da versão 8 para os objetivos da ficha. Notas manuais permanecem; textos anteriores conflitantes são preservados no histórico. A migração repetida não duplica conteúdo.
- Legados com preço individual, herança do custo geral, gratuidade por preço zero e validação de custos. Cotação desatualizada não debita XP. Confirmação repetida não cobra novamente; aquisição permanece no nível 0.
- Enquadramento com posições de 0 a 100 e zoom de 1 a 3, validado no servidor. Foto original, enquadramento e objetivos sobrevivem ao ciclo de exportação/importação dos documentos JSON independentes.
- Preferências separadas de efeitos e trilha, com volumes de 0 a 100 e persistência por conta. Teste com contexto de áudio simulado verifica independência dos canais e encerramento dos sons da trilha ao ocultar a aba ou desativá-la.
- Busca por poderes individuais e rituais, com informação do nível e destino direto. Consulta apresenta o poder selecionado antes da ação de evolução.
- Histórico de navegação mantém entradas distintas e contexto; voltar/avançar e abrir outro destino preservam o passado e descartam somente o futuro abandonado. O navegador recebe identificadores opacos, sem JSON de ficha ou credenciais no histórico.
- Nova ação de objetivos e enquadramento atravessam a API HTTP real, incluindo a lista restrita de rotas e as permissões de ficha.
- Favicon, ícones, imagem de compartilhamento, manifesto e robots acessíveis sem login. Metadados usam a origem pública de produção, com opção de domínio próprio; configuração inválida é recusada.
- Regressões: login persistente, logout, acesso por campanha, evolução com confirmação e XP, informações sob sigilo até a compra, transações concorrentes, mapas pessoais, notas privadas, missões com recompensa ajustável, exclusões e restauração, círculo exclusivo do jogador e sincronização por revisão.
- Frontend sem localStorage, sessionStorage ou IndexedDB. Build de produção sem as identidades fictícias da prévia. Não foi acrescentado cache offline de fichas.

As migrações SQL e funções foram executadas em PostgreSQL via PGlite, com transações, conflito de revisão, RLS e recusa das permissões `anon`/`authenticated`. O adaptador Supabase usa transporte REST simulado com funções SQL reais. O adaptador de imagens usa Storage simulado para conferir upload privado, reconstituição, deduplicação e falhas. **Não houve conexão ao Supabase do usuário.**

## Criação e consulta da versão 9.2

- As treze listas de clã passaram pelas mesmas contagens e validação da ficha, incluindo as combinações fornecidas para Toreador, Ravnos e Tzimisce.
- Atributos em 1 + 15 pontos, habilidades com reserva compartilhada de 27, antecedentes 5 e disciplinas 3. A segunda reserva usa 15 bônus, os custos 4/2/6/1 e limite final 5.
- Nível 0 permanece nas disciplinas. Linhas primárias são escolhidas, conferidas contra a disciplina e ligadas sem dupla contagem. Evolução com XP de uma disciplina primária atualiza a linha e cobra uma vez.
- Testes de Geração 13–8 e todos os níveis de Recursos; capital inicial recalculado pelo servidor, sem duplicação na aprovação. Valores de dinheiro, XP, geração e estado adulterados pelo cliente não substituem o cálculo.
- Qualidades e defeitos usam preço do catálogo, limite de quatro defeitos, grupos de versões, requisitos e efeitos estruturados. Testes cobrem Monstruoso, Criança, Líder Nato e as concessões de Beijo de Procuração.
- Clã personalizado com três disciplinas, revisão obrigatória, recusa de pontos excedidos, aprovação repetida, registros legados e exportação/importação das escolhas em documentos separados.
- Remover antecedente não faz o normalizador recriá-lo. Renomear Geração/Recursos conserva o cálculo pelo metadado do efeito.
- A consulta do livro omite edição, JSON editável e exclusão. O leitor mostra o texto integral e os poderes; Gerenciar livro habilita as alterações.

## Navegador e mobile

A revisão usou navegador real e API HTTP com contas e dados fictícios. A prévia é descartável; `npm start` continua exigindo Supabase. A pasta `.qa/` gerada não acompanha o ZIP nem o build de produção.

Na versão 9.2, a revisão no navegador criou uma ficha Tremere do início ao fim no layout móvel: escolheu Linha do Sangue, distribuiu 15/15 atributos, 27/27 habilidades, 5/5 antecedentes e 3/3 disciplinas, gastou 17/17 bônus após um defeito e duas qualidades, acrescentou história/ambição/convicções, enviou e confirmou a proposta. O narrador recebeu a ficha no painel e a aprovou. Ao entrar novamente pelo jogador, o novo personagem apareceu com 0 XP e 11ª geração; o inventário mostrou R$ 50.000,00. Dominação permaneceu em 0 e Taumaturgia/Linha do Sangue em 3.

A digitação de `concentração` letra por letra preservou a ordem e encontrou a qualidade. A revisão foi conferida em 360 px sem transbordamento horizontal (largura e conteúdo de 345 px, descontada a barra do navegador da prévia). O fluxo também foi usado em 390 px. O livro abriu uma disciplina em Somente consulta, com poderes expansíveis e sem campos de edição. Não houve erro da aplicação nos registros do navegador durante esse fluxo. Fotos e trilhas de áudio não foram alteradas nesta versão.

Na versão 9.1, foram conferidos o posicionamento pelo narrador, criação de marcador para outro personagem no layout de 390 px, seleção de ficha para copiar, entrada com 100 XP, compra de informação fictícia e retorno ao painel. A ficha original continuou com 65 XP. Em 360 e 390 px, o formulário de testes e o aviso de jogador ficaram utilizáveis, sem transbordamento horizontal. A troca de visão retorna ao início da página. O duplo clique com arraste moveu o marcador no navegador com layout de 390 px; o aviso apareceu sobre o mapa e a posição/altura da área interativa permaneceu estável durante o fluxo.

- Digitação de `força` letra por letra manteve o texto na ordem certa, com o resultado Força. O campo permanece no DOM durante a filtragem.
- Disciplina abriu na consulta, com abas por poder. Percepção da Aura mostrou Raciocínio 2 + Empatia 3 = 5 dados; Preparar rolagem levou à parada preenchida e Voltar retornou ao mesmo poder.
- Consulta conferida em 360 e 390 px, sem transbordamento horizontal; cabeçalho compacto com aproximadamente 70 px de altura na prévia de 390 px.
- Pesquisa superior por `percepção da aura` no mobile encontrou o poder individual de Auspícios e abriu diretamente o nível 2.
- Concluir ambição pediu confirmação, mostrou a celebração e deixou a ambição vazia; o desejo permaneceu com seu texto. As animações respeitam a preferência por movimento reduzido.
- Desistir do desejo pediu confirmação, exibiu a animação própria e preservou a ambição.
- Na rolagem preparada, modificador 2 e dificuldade 8 foram mantidos após abrir Anotações e usar Voltar. Outro Voltar retornou ao mesmo poder de nível 2.
- Enquadramento com posição horizontal 0, vertical 100 e zoom 3 foi salvo e apareceu na imagem da ficha; o original continuou disponível. No mobile de 360 px, a prévia mediu 225 × 300 px e o formulário não transbordou horizontalmente.
- No mapa de 360 px, a borda superior da área interativa passou de aproximadamente 780 para 494 px na mesma prévia. O botão Ver mapa levou diretamente à região interativa. Posição e distância expandiu os controles de localização quando necessário.
- Narrador definiu custo geral de 12 XP e preço individual de 19 XP para Dominação. O jogador viu os preços corretos, confirmou 19 XP e passou de 65 para 46 XP, recebendo a disciplina no nível 0.
- Controles de áudio salvaram efeitos desligados com trilha ligada, exibindo os estados separados ao reabrir. Silenciar tudo ofereceu o desligamento conjunto. Não houve avaliação auditiva em aparelho físico.

Não houve ensaio de carga nem teste em celular físico. Presença e novidades usam consulta periódica, sem WebSocket, push ou e-mail agendado. Testes de poderes com termos desconhecidos ou alternativas ainda exigem conferência manual, informada na interface.

## Publicação

Siga **[ATUALIZAR.md](ATUALIZAR.md)**. Não há SQL, bucket ou variável obrigatória nova. Faça backup, envie o conteúdo completo do ZIP, publique primeiro a API no Render e confira `/api/health` com versão 9.2.0; depois publique no Vercel.

Favicon e imagem social foram gerados e servidos pela prévia. A miniatura real no WhatsApp depende da publicação no domínio final e da leitura/cache do serviço. A origem padrão do Vercel é detectada automaticamente; domínio próprio pode ser indicado em `COROA_SITE_URL` no Vercel.

A conferência em produção deve incluir login após reabrir o navegador, persistência após reiniciar o Render, upload de retrato/mapa e sincronização entre dois dispositivos. Esta entrega inclui código e instruções; **não é um deploy em produção já realizado**.

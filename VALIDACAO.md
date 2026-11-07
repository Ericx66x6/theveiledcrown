# Validação · A Coroa Velada 9.0.0 · Beta

Verificação em 07/11/2026. Código para frontend Vercel, API Node.js 24 no Render e documentos JSONB/imagens privadas no Supabase. Nenhum serviço ou dado de produção do usuário foi alterado.

## Testes automatizados

`npm run test:all` passou com **162 testes, sem falhas**. O comando compila o frontend, executa regras, domínio, gestos, áudio, API HTTP, SQL e Storage e confere sintaxe e referências aos assets.

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

## Navegador e mobile

A revisão usou navegador real e API HTTP com contas e dados fictícios. A prévia é descartável; `npm start` continua exigindo Supabase. A pasta `.qa/` gerada não acompanha o ZIP nem o build de produção.

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

Siga **[ATUALIZAR.md](ATUALIZAR.md)**. Não há SQL, bucket ou variável obrigatória nova. Faça backup, envie o conteúdo completo do ZIP, publique primeiro a API no Render e confira `/api/health` com versão 9.0.0; depois publique no Vercel.

Favicon e imagem social foram gerados e servidos pela prévia. A miniatura real no WhatsApp depende da publicação no domínio final e da leitura/cache do serviço. A origem padrão do Vercel é detectada automaticamente; domínio próprio pode ser indicado em `COROA_SITE_URL` no Vercel.

A conferência em produção deve incluir login após reabrir o navegador, persistência após reiniciar o Render, upload de retrato/mapa e sincronização entre dois dispositivos. Esta entrega inclui código e instruções; **não é um deploy em produção já realizado**.

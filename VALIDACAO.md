# Validação · A Coroa Velada 8.0.0

Verificação em 03/11/2026. Entrega de código para API Node.js 24 no Render, documentos JSONB/imagens privadas no Supabase e frontend no Vercel. Nenhum serviço ou dado de produção do usuário foi alterado.

## Testes automatizados

`npm run test:all` passou com **147 testes, sem falhas**. O comando compila o frontend, executa testes de regras, domínio, gestos, HTTP, SQL e Storage e confere sintaxe e referências aos assets.

- Ecos do Véu: conteúdo reservado ausente das respostas, pesquisa e backup do jogador antes da compra; revelação para toda a campanha depois do pagamento. Um personagem próprio paga XP e dinheiro completos. Revisões, saldo insuficiente, concorrência e repetição da mesma confirmação não produzem débito duplicado.
- Legados do Sangue: catálogo autorizado pelo narrador, custo fixo de 10 XP, aquisição no nível 0, bloqueio de duplicatas e evolução normal posterior. Evoluir uma disciplina ausente não permite contornar a aquisição.
- Marcadores pessoais: propriedade por personagem, posição reservada por padrão, compartilhamento opcional, narrador vê todos, outros jogadores recebem somente posições autorizadas e resumo público. Exclusão de ficha limpa suas posições.
- Distância em quilômetros: proporção com os pixels da imagem original e cálculo geodésico por coordenadas, sem depender do zoom. Arraste simples não salva alterações; segundo toque com arraste permite movimento. Marcadores alheios permanecem protegidos.
- Histórico sem corte automático nos últimos 100 registros; evolução conserva níveis, custo e saldo. Ganho de XP gera notificação. Edição administrativa aceita mensagem e descrição das mudanças; somente narrador apaga o histórico.
- Migração das anotações pessoais, ambições/desejos e antigas publicações do salão, preservando autoria, conteúdo e indicação da data original. Reimportar uma nota antiga modificada não elimina seu novo conteúdo.
- Mensagens e interações sociais privadas, presença por campanha, intervalo de cutucadas e desafios de pedra, papel e tesoura. Escolhas permanecem ocultas antes da resposta; desafios não alteram recursos do jogo.
- Imagens nas coleções da ficha, capa/cor da campanha, preferências de som na conta, testes automáticos de disciplinas e busca entre categorias sem expor segredos.
- Exercício pela API HTTP real das novas rotas: compra/repetição, disciplina no nível 0, posição de personagem, resposta de desafio e edição completa por PUT com mensagem no histórico.
- Regressões da versão anterior: login persistente por cookie HttpOnly e logout, autorização por campanha, notas privadas, exclusões e restauração, missões com recompensa ajustável e entrega única, XP em lote, revisão concorrente e círculo exclusivo do jogador.
- Exportação/importação dos documentos independentes, incluindo o novo `intel.json`, e leitura de pacotes antigos sem esse documento. Frontend sem localStorage, sessionStorage ou IndexedDB. O build de produção não inclui as identidades fictícias de QA.

As migrações SQL foram executadas em PostgreSQL via PGlite, incluindo repetição, transações, conflitos, RLS e recusa de acesso por `anon` e `authenticated`. O adaptador Supabase usa transporte REST simulado com funções SQL reais. Imagens usam transporte Storage simulado para conferir upload privado, deduplicação, reconstituição e falhas. **Não houve conexão ao Supabase do usuário.**

## Navegador e mobile

A interface foi conferida com API HTTP real e contas fictícias em ambiente descartável. Esses dados ficam na memória da prévia; `npm start` exige Supabase e não ativa QA. A pasta gerada `.qa/` não acompanha o ZIP nem o build de produção.

- Compra de informação por 7 XP e R$ 200: Helena passou de 65 para 58 XP e de R$ 1.200 para R$ 1.000; conteúdo e comprovante identificaram Marina/Helena e os valores pagos.
- Aquisição de Dominação por 10 XP: saldo passou de 58 para 48 XP e a disciplina apareceu como nível 0.
- Poder de Auspícios exibiu Raciocínio 2 + Empatia 3 = 5 dados. Preparar rolagem montou a parada e permitiu rolar 5 D10. Poderes de níveis ainda não adquiridos ficaram como consulta.
- Busca por Força com Perícias abertas retornou o atributo Força, nível 3. A pesquisa do topo permaneceu acessível nas páginas da campanha.
- Campanha alterada para azul: botões, bordas, iluminação e fundos acompanharam a cor, conservando as cores originais das fotos. Edição da campanha mostrou capa e removeu a seleção de sistema.
- Marcador pessoal reservado apareceu para o narrador. Compartilhar pelo acesso do jogador salvou a posição como compartilhada. Retrato do marcador medido em 44 × 44 px, com `object-fit: cover`.
- Distância inicial de 4,184 km entre dois pontos; calibração dos mesmos 418,4 pixels originais como referência de 1.000 metros; nova medição exibiu exatamente 1 km. Medição e linha são temporárias.
- Base geográfica OpenFreeMap renderizou ruas de São Paulo em Canvas, com marcador e controles do atlas.
- Desafio social concluído: papel venceu pedra, ambos os movimentos apareceram no resultado e não houve recompensa de gameplay.
- Painel do narrador, ficha e atlas do jogador em 360 px; catálogo de informações e salão em 390 px, sem transbordamento horizontal do documento. Galeria de mapas mantém rolagem própria. HUD de XP, botões do topo, navegação e retrato ampliado permanecem acessíveis.
- Botão único de som mudou para o estado desativado e manteve essa escolha após recarregar. Preferência de conta e ciclo de persistência também foram cobertos pelos testes; o navegador libera áudio após uma interação. Não foi feita avaliação auditiva em aparelho físico.
- Carregamento apresentou indicação central durante abertura do mapa geográfico e gravações, com aviso em caso de falha.

Não houve teste em aparelho físico nem ensaio de carga. Presença, avisos e novidades usam consulta periódica, sem WebSocket, push ou e-mail agendado. Testes de disciplinas com termos desconhecidos ou alternativas exigem conferência manual e mostram essa limitação na interface.

## Atualização e limites

Siga **[ATUALIZAR.md](ATUALIZAR.md)** para atualizar uma instalação existente preservando os dados. Não há SQL, bucket ou variável nova nesta versão. Mantenha o Supabase atual e remova um eventual `vercel.json` antigo; use `vercel.mjs`. Publique primeiro a API no Render e confira `/api/health` com versão 8.0.0; depois publique o frontend no Vercel. A instalação inicial continua em [TUTORIAL.md](TUTORIAL.md).

Dados duráveis permanecem no Supabase, com revisão nas gravações. As abas consultam alterações a cada 20 segundos e ao recuperar o foco; formulários em edição adiam a atualização visual. O login usa cookie persistente de primeira parte. Logout, troca de senha, desativação da conta ou limpeza dos cookies encerram o acesso.

Mapas geográficos dependem de internet e do OpenFreeMap. As distâncias são em linha reta; trajetos pertencem ao roleplay. Notas de fichas sem responsável são conservadas até vincular um jogador. Imagens sem referência permanecem no bucket privado para não invalidar backups anteriores. Backups administrativos contêm os dados integrais de recuperação; restrições de privacidade se aplicam às rotas normais.

A conferência após publicar deve testar upload de capa/mapa/retrato, login após reabrir o navegador, persistência após reiniciar o Render e sincronização entre dois dispositivos no domínio real. Esta entrega inclui código e instruções; **não representa um deploy em produção já realizado**.

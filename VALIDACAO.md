# Validação · A Coroa Velada 7.0.0

Verificação em 02/11/2026. Portal online com frontend Vercel, API Node.js 24 no Render e documentos JSONB/imagens privadas no Supabase. Nenhum serviço ou dado de produção do usuário foi alterado.

## Testes automatizados

`npm run test:all` passou com **118 testes**, sem falhas. O comando compila o frontend, executa os testes de regras, domínio, HTTP, SQL e Storage e confere sintaxe e referências aos assets.

- Sessão persistente sem vencimento no servidor, cookie HttpOnly, restauração do acesso, renovação do cookie e revogação por logout. O cookie conserva o acesso após recriar o servidor usando o mesmo repositório. Mutações com cookie exigem origem autorizada.
- Respostas públicas de campanha e carregamento inicial sem contas internas, hashes de senha ou sessões. O carregamento inicial reúne os dados autorizados em uma única consulta HTTP.
- Notas com autoria e criação preservadas, exclusão por autor/narrador e isolamento das notas privadas.
- Recados públicos e privados, cutucadas com intervalo, membros e presença limitados à campanha. O narrador não recebe mensagens privadas trocadas entre outras contas pelas rotas normais.
- Exclusão de notificações por conta, sem apagar a caixa de outros narradores.
- Missões controladas pelo narrador, recompensa final ajustável, previsão preservada, entrega única e recusa das antigas rotas de solicitação/conclusão pelo jogador.
- Mapas por imagem ou geográficos, validação de coordenadas, imagens e NPCs, acesso por campanha e proteção dos marcadores privados.
- Exclusão de propostas, logs, históricos, movimentações, campanhas, revisões e lixeira; reset protegido por confirmação. Remover o último registro de campanha permite criar outra mesa e exportar/importar o portal vazio.
- Fichas, acessos, propostas/revisão, vínculos, transferência, regras, evolução, recursos, dinheiro e XP em lote. Gravações concorrentes preservam o controle de revisão e a entrega única de recompensas.
- Mural pessoal por personagem, recusando narrador e outros jogadores nas rotas normais.
- Frontend sem localStorage, sessionStorage ou IndexedDB; nenhuma identidade fictícia de QA incluída no build de produção.
- Configuração do Vercel encaminhando `/auth` e `/api` para o Render na mesma origem do site. Mapa geográfico em bundle separado, com OpenFreeMap e renderização em Canvas.

As migrações SQL foram executadas em PostgreSQL via PGlite, incluindo repetição das migrações, transações, conflito de revisão, RLS e recusa de acesso por `anon` e `authenticated`. O adaptador Supabase foi testado com transporte REST simulado e funções SQL reais. O adaptador de imagens usa transporte Storage simulado para conferir bucket privado, upload, deduplicação, reconstituição e falhas. **Não foi feita conexão ao Supabase do usuário.**

## Navegador e mobile

A interface foi conferida com API HTTP real em ambiente descartável e contas fictícias. Os dados de QA ficam na memória do servidor de desenvolvimento; `npm start` exige Supabase e não ativa esse modo. A pasta gerada `.qa/` não acompanha o ZIP nem o build de produção.

- Acesso restaurado na entrada normal do site, após sair da página auxiliar de QA, usando o cookie. Logout retornou à apresentação e permaneceu encerrado após recarregar.
- Narrador sem personagem aberto inicia no conselho, sem ficha individual, saldo de XP pessoal ou perfil no menu lateral. O perfil continua acessível pelo avatar, com rótulo acessível no mobile.
- Avatares em **Jogadores e acesso** medidos em 40 × 40 px, recorte circular e imagem com `object-fit: cover`, inclusive com foto originalmente retangular.
- Anotação compartilhada com autor/data e abertura do perfil público.
- Envio de recado privado pelo narrador e recebimento pela conta fictícia de jogador; presença das duas contas e cutucada de volta, com notificação no narrador.
- Confirmação de exclusão de notificação informa que a ação afeta só a própria caixa. Exclusões e reset foram executados nos testes automatizados, sem apagar dados em serviços de produção.
- Missão com previsão de 8 XP/R$ 300 entregue pelo narrador com 11 XP/R$ 500. A interface exibiu o resultado final e manteve a previsão original, sem oferecer nova entrega.
- Atlas com navegação, bolha escura do local, galeria, endereço, atmosfera, risco e NPCs. Acréscimo de um NPC salvo pela API. Base geográfica com ruas de São Paulo renderizada sem WebGL.
- Painel/atlas em viewport de 360 px e salão do jogador em 390 px sem transbordamento horizontal do documento. Galeria de mapas tem rolagem própria. Botões do zoom com alvo de toque de pelo menos 44 px e botão Enquadrar com largura adequada.

Não houve teste em aparelho físico nem ensaio de carga. Lembretes são publicações com data no mural, sem agendamento de push/e-mail. Presença é consultada periodicamente, não usa WebSocket.

## Atualização e limites

Para quem já usa a versão 6, siga **[ATUALIZAR.md](ATUALIZAR.md)**. Preserve os dados e as variáveis atuais; não há SQL novo para esta atualização. Remova o antigo `vercel.json` e mantenha `vercel.mjs`. Publique primeiro a API no Render e depois o frontend no Vercel. A instalação inicial continua em [TUTORIAL.md](TUTORIAL.md).

Os dados duráveis permanecem no Supabase, com revisão em cada gravação. As abas consultam alterações a cada 20 segundos e ao recuperar o foco; formulários em edição adiam a atualização visual. O login usa cookie persistente de primeira parte, renovado durante o uso. Logout, troca de senha, desativação da conta ou limpeza dos cookies encerram o acesso.

O mapa geográfico depende da disponibilidade pública do OpenFreeMap e de internet. Mapas por imagem continuam disponíveis; imagens sem referência são conservadas no bucket privado para não invalidar backups anteriores.

A validação final após publicar deve conferir upload de mapa/retrato, login após fechar/reabrir o navegador, persistência após reiniciar o Render e sincronização entre dois dispositivos no domínio de produção. Esta entrega inclui código e instruções; não representa um deploy já realizado.

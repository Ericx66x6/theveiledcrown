# Validação · A Coroa Velada 6.0.0

Verificação em 02/11/2026. Entrega exclusivamente online, com frontend Vercel, API Node.js 24 no Render e documentos JSONB/imagens privadas no Supabase. Nenhum dado ou serviço de produção do usuário foi alterado.

## Testes automatizados

`npm run test:all` passou com **95 testes**, sem falhas. Inclui compilação, regras de negócio, API HTTP, banco e Storage, além da verificação de sintaxe e referências aos assets.

- Cadastro manual de fichas, propostas de jogadores, revisão/aprovação, contas, vínculos, transferência e lixeira.
- Custos e confirmação da evolução; recursos, dinheiro, regras, notas, campanhas e permissões.
- Missões atribuídas pelo narrador, solicitação do participante e conclusão administrativa com recompensa única.
- XP em lote, idempotência com requisições concorrentes e isolamento de seleção da campanha entre conexões.
- Mural privado por personagem, recusando narrador e outros jogadores nas rotas normais.
- Separação do catálogo de atributos do narrador e da evolução individual do jogador.
- Login/revogação, inicialização protegida, origens permitidas, arquivos privados e bloqueio de iframe em produção.
- Frontend sem localStorage, sessionStorage, IndexedDB, gravador de pastas ou identidade fictícia de QA.

As migrações SQL foram executadas em PostgreSQL via PGlite. Os testes aplicam as migrações duas vezes, verificam transações, conflito de revisão, RLS e recusa de acesso por `anon` e `authenticated`. Uma política antiga ampla de Storage é incluída no teste para conferir que o novo bucket continua protegido.

O adaptador Supabase usa transporte REST simulado com as funções SQL reais nesses testes. O adaptador de imagens foi verificado com transporte Storage simulado: bucket privado, extração das imagens dos documentos, envio, deduplicação, reconstituição, falha de upload e recusa de caminhos/conteúdo corrompido. Não foi feita uma conexão ao projeto Supabase do usuário.

## Navegador e mobile

A interface foi conferida com servidor HTTP e API reais em ambiente de teste descartável. Os dados e contas fictícios ficam na memória do servidor de QA; esse mecanismo não é usado por `npm start` nem é compilado no site de produção.

- Narrador inicia sem personagem, sem controles de tempo do mundo e sem mural pessoal de jogador.
- Cadastro manual criou Amélia da Névoa com clã Lasombra, Força 3 e Destreza 2, usando ID aleatório e gravação pela API.
- Distribuição de 5 XP a duas fichas: Helena passou de 65 para 70 e Lucien de 32 para 37.
- Ficha aberta pelo narrador oferece **Distribuir XP**, sem painel de saldo/evolução individual.
- Ajuste administrativo de Destreza 1 para 2 foi salvo sem gastar XP.
- Jogador visualiza seu mural, com NPC do personagem, e missões atribuídas com opção **Solicitar conclusão**.
- Painel do narrador em viewport de 360 px e área do jogador em 390 px sem transbordamento horizontal do documento.

Não houve teste em aparelho físico nem ensaio de carga. Os comandos de QA e dados de teste permanecem como ferramentas de desenvolvimento; os arquivos gerados `.qa/` não integram o ZIP nem o site publicado.

## Ativação e limites da conferência

Siga [TUTORIAL.md](TUTORIAL.md): executar `supabase/INSTALAR.sql`, configurar o Render e depois o Vercel. Faltam a Project URL e uma nova chave privada configuradas diretamente no Render. A chave compartilhada na conversa não foi usada nem incluída no código.

Os dados duráveis usam o Supabase, com verificação de revisão em cada gravação. Outras abas consultam alterações a cada 20 segundos e ao recuperar o foco; formulários em edição adiam a atualização automática. O token fica somente na memória da aba, exigindo novo login após recarregar.

O teste final no serviço real deve conferir envio de retrato/mapa, criação e login de um jogador, persistência após reiniciar o Render e comunicação pelo domínio de produção do Vercel. Essa validação depende da configuração feita na sua conta. A entrega não representa um deploy já realizado.

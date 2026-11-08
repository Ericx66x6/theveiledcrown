# Validação · A Coroa Velada 10.0 oficial

Verificação em 08/11/2026. Entrega de código para Vercel, API Node.js 24 no Render e Supabase. Nenhum serviço ou dado de produção do usuário foi alterado.

## Testes automatizados

`npm run test:all` passou com **246 testes, zero falhas**, incluindo compilação, testes de domínio e regras, API HTTP, SQL e imagens, sintaxe JavaScript e referências aos assets. A execução inclui as funcionalidades anteriores de criação guiada, evolução, mapas, missões, recompensas, cadastros, exclusões e permissões.

Verificações específicas da 10:

- Os registros separados remontam campanhas, contas, sessões, personagens, mapas e históricos. Dados v4 podem ser convertidos e continuam íntegros após reiniciar o adaptador.
- Uma gravação simples envia apenas registros alterados. A primeira gravação depois de um reinício também evita reenviar regras devido à ordem das chaves JSONB.
- Duas instâncias observam alterações e exclusões. Revisões antigas são recusadas; uma alteração não sobrescreve silenciosamente outra.
- Falha antes do commit não atualiza o cache como se tivesse salvado. Se a resposta se perde depois do commit, a leitura seguinte recupera o valor confirmado sem repetir o crédito automaticamente.
- Leituras e sincronização continuam disponíveis enquanto outra gravação aguarda confirmação.
- O instalador completo e a migração incremental são executados novamente sem apagar o estado. RPCs e tabelas continuam recusando acesso dos papéis `anon` e `authenticated`.
- A ausência da nova RPC retorna `MIGRATION_REQUIRED`, sem inicializar um portal vazio sobre os dados existentes.
- A conversão de retorno preserva os dados mais recentes e sessões no formato entendido pela 9.3.1.
- Rotas de imagens exigem sessão e visibilidade, inclusive quando os bytes estão em cache. Revogar um mapa bloqueia novas leituras. Copiar uma URL privada para o próprio perfil não concede acesso.
- O exportador verifica tanto URLs de imagem quanto referências internas aninhadas em JSON arbitrário; não permite usar o download para abrir uma imagem privada alheia.
- Backups completos e de jogador continuam portáteis e válidos, com imagens embutidas. Clientes anteriores ainda recebem imagens no formato compatível.
- A resposta de uma mutação pode trazer o delta da tela; o livro intacto não precisa ser retransmitido. JSON gzip, ETag e cabeçalhos de tempo são exercitados por HTTP.
- Mesclagem da tela remove fichas que saíram da lista autorizada. Respostas antigas não desfazem um valor confirmado mais recente; modo de teste e campanhas têm contextos distintos.
- O frontend só envia metadados de atualização depois de negociar protocolo 10, evitando inserir campos de controle no game-data de um backend antigo durante a publicação.
- Status restaura o acesso sem expor token ou hash. Sincronização não baixa imagens.
- Manutenção responde 503 às rotas de dados, mantém o health disponível e não consulta ou altera documentos por essas requisições.

O PostgreSQL é exercitado via PGlite com as funções SQL reais, conflitos, transações e permissões. O transporte Supabase REST e o Storage são simulados. Nenhuma chave de produção é usada nos testes.

## Revisão no navegador

Prévia HTTP com dados descartáveis, usando o adaptador incremental SQL e as novas rotas de imagens, sem banco real do usuário.

- Painel do narrador abre sem personagem próprio.
- Jogador recebe a celebração de 7 XP e o aviso de sequência interrompida, conservando a recompensa já conquistada.
- Retrato e avatar abrem pelas rotas privadas e os bytes carregam corretamente.
- Uma movimentação fictícia de +25 muda o saldo de 1.200 para 1.225 e cria o histórico. O formulário impede nova confirmação enquanto aguarda resposta; o salvamento comum não abre o carregamento modal.
- Uma aba normal, sem o atalho de identidade de teste, restaura o login por cookie e vê o saldo 1.225 já confirmado.
- Em 360 e 390 px, o atlas conserva os controles compactos. O jogador vê dois mapas liberados e não vê o mapa privado do narrador. A largura de conteúdo medida não ultrapassa a largura útil da tela.
- Recarregamento e navegação mantêm fotos, ficha e dados. A sincronização é adiada enquanto um menu, diálogo ou formulário está em uso, preservando a interação.

## Desempenho e limites

A comparação HTTP com a 9.3.1 está em `DESEMPENHO-10.md` e `DESEMPENHO-10.json`, com dados fictícios e metodologia explícita. Não é uma medição do seu ambiente de produção, nem uma garantia de tempo em redes e aparelhos diferentes.

Não houve deploy no GitHub, Render ou Vercel, execução no Supabase real ou contratação de plano. A atualização desses serviços e a conversão do armazenamento estão documentadas em `ATUALIZAR.md`. O game-data da campanha não deve ser substituído para efetuar a atualização.

# Validação · A Coroa Velada 10.1 oficial

Verificação em 09/11/2026. Código para Vercel, API Node.js 24 no Render e documentos/imagens no Supabase. A validação usa dados fictícios; não houve publicação nem alteração no Supabase real.

## Testes e compilação

`npm run test:all`: **259 testes, zero falhas**, compilação do frontend e verificação de sintaxe/assets. A bateria anterior continua cobrindo criação guiada, custos, XP, missões, login, rituais, mapas, privacidade, exclusões, transporte incremental e conflitos.

Cobertura acrescentada nesta versão:

- Relatos: rascunho curto permitido, envio exige estrutura, conteúdo restrito à ficha, narrador não reescreve o texto do jogador, pedido de complemento e reenvio; recompensa de +1 XP atômica, sem repetição.
- Histórias separadas de dois personagens da mesma conta. Premiar um não altera o XP do outro. Transferir a ficha impede conceder ao novo dono a recompensa pelo relato de outra pessoa.
- Feedback privado, tentativa de premiar ficha de outra pessoa recusada, recompensa variável registrada e repetição bloqueada.
- Documentos reservados filtrados no portal, leitura registrada, edição exclusiva do narrador, mudança de acesso e bloqueio de imagem privada mesmo quando os bytes estão em cache.
- Galeria na conta: evolução automática, feito manual idempotente, recibo persistente, reconhecimento e remoção. Marca removida não é recriada pela migração. Conta sem campanha ainda consulta a própria galeria e reconhece a celebração.
- Laços: propriedade, níveis 0–5, revisão obrigatória, estágio manual sem passagem automática do tempo, renovação, reforço, desgaste confirmado e recibos distintos por direção.
- API HTTP com PostgreSQL PGlite e SQL real: novos dados sobrevivem a reinício do repositório; exportações filtram conteúdo privado e embutem as imagens autorizadas.
- Leitura de um acervo produzido pelo codec real da 10.0. IDs importados como `index` não sobrescrevem arquivos de índice. Conversão de retorno para v4 conserva feedback, XP, laços e conquistas.
- Relatos, feedbacks e vínculos criados no modo Testar como jogador ficam no workspace temporário; não alteram documentos ou revisão da campanha real.

O transporte REST e o Storage do Supabase são simulados nos testes. Nenhuma credencial de produção é usada. A migração SQL da 10.0 continua suficiente; não foi acrescentada outra migração.

## Revisão no navegador

Prévia HTTP com banco SQL descartável, interface real e imagens servidas pelas rotas privadas.

- Narrador leu um relato completo, confirmou +1 XP e viu o estado Recompensado, seu parecer e o registro da entrega.
- Narrador criou um decreto, avaliou um feedback com 2 XP e concedeu um título com ícone para uma conta sem personagem.
- Jogador recebeu no login a celebração do XP acumulado, o título manual e o aviso de presença interrompida. XP e títulos permaneceram salvos após fechar as animações.
- Em tela mobile de 390 px, o jogador escreveu e enviou um relato de 118 palavras. O contador e os quatro tópicos responderam à digitação sem inverter o texto; o título manteve a ordem e a posição do cursor.
- Relatos de dois personagens apareceram separados. O jogador não viu a carta reservada a outro participante, mas pôde abrir os decretos públicos.
- Vínculo foi marcado À beira da ruptura, perdeu um nível após confirmação e mostrou a animação de libertação parcial. Outro vínculo foi renovado/reforçado e mostrou domínio. A renovação de um laço sobre a própria vontade mostrou as correntes fechando.
- Revisar evolução abriu o diálogo com nível 1 → 2, custo de 5 XP e saldo restante. Após confirmar, saldo e nível mudaram, com celebração e registro da evolução.
- O carregamento foi observado como diálogo de viewport inteiro, posição 0/0 e 390 × 844 px, com conteúdo centralizado. Uma latência artificial existia somente na primeira etapa de QA para observar a espera; foi removida antes da revisão final e não integra a aplicação publicada.
- A revisão final em 360 px confirmou a animação do laço sem barra lateral, galeria sem transbordamento horizontal e confirmação única ao sair de um rascunho não salvo.
- A galeria mantém filtros acessíveis por deslize no mobile. A navegação e o carregamento preservam o tema preto/vermelho e o contraste dos diálogos.

## Dados e limites da entrega

O arquivo original `data/game_data.json` não foi substituído. Configuração de relatos recebe padrão no normalizador e pode ser alterada pelo narrador. Os backups continuam no formato portátil existente; os novos registros acompanham os metadados das campanhas e contas.

A galeria completa é carregada ao abrir a área; o estado inicial leva apenas resumo e recibos pendentes. Relatos, documentos, feedbacks, conquistas e recibos têm registros separados no armazenamento incremental. A sincronização de fundo permanece silenciosa. A revisão da evolução usa a cotação local, e a confirmação é conferida pelo servidor.

O relatório `DESEMPENHO-10.md` descreve a aferição anterior da arquitetura 10.0. Não houve nova medição de latência em produção nesta entrega. Rede, tamanho do acervo e suspensão do serviço de hospedagem ainda afetam o tempo de resposta.

A estrutura dos relatos ajuda a escrever; a qualidade e o mérito de XP são avaliados pelo narrador. Documentos aceitam texto/imagem, sem visualizador PDF. O tempo dos laços é narrativo e manual. A recuperação de conquistas anteriores depende dos recibos ainda existentes no acervo. IA não foi implementada.

Atualização e retorno estão em `../ATUALIZAR.md`. Uma instalação 10.0 não exige SQL novo ou buckets novos, mas a conversão do formato interno deve ser feita em manutenção antes de liberar a mesa.

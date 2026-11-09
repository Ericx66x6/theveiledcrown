# Validação · A Coroa Velada 10.2 oficial

Verificação em 09/11/2026. Entrega para Node.js 24, Render, Supabase e Vercel. Código baseado na 10.1 (`bf13ab58`), sem publicação ou alteração em serviços de produção.

## Testes automatizados

`npm run test:all`: **266 testes, zero falhas**, frontend compilado e verificação de sintaxe/assets concluída. Os testes usam dados fictícios e, nas integrações SQL, PostgreSQL PGlite descartável com o SQL do projeto. REST/Storage do Supabase são simulados; não foram usadas credenciais de produção.

A cobertura anterior permanece: permissões, isolamento entre campanhas, sessões, custos, criação e passos obrigatórios, XP, missões, mapas, documentos, relatos, feedbacks, conquistas, vínculos, compras, exclusões, revisões concorrentes, migrações e armazenamento incremental. As verificações da 10.2 incluem:

- Campanha anterior recebe apresentação e Caitiff uma vez, sem substituir limites, nomes, textos personalizados ou poderes existentes. Repetir a normalização não duplica clãs.
- Caitiff escolhe três dons comuns diferentes; uma disciplina exclusiva é recusada no envio. A ficha permanece pendente e não entra nas fichas jogáveis antes da aprovação.
- Nosferatu tem Aparência 0, conserva a reserva de 15 pontos e não pode comprar aumento desse atributo com bônus/XP. A atualização não recalcula a ficha legada sem plano de criação.
- Controles explicam limite 4/3 na distribuição inicial, limite 5 nos bônus, pontos insuficientes e restrições de clã. A validação do servidor permanece independente dos botões.
- Princípio único por campanha, editável somente por narrador; convicções pessoais editáveis pelo responsável e bloqueadas para outras contas. Outra campanha conserva seu texto.
- Foto, enquadramento, história, detalhe da fraqueza e convicções sobrevivem ao envio, aprovação e montagem dos documentos de backup.
- Excluir uma disciplina no livro remove também sua referência das escolhas flexíveis do clã; normalizar não a recria.
- O health HTTP identifica aplicativo 10.2.0 e armazenamento incremental-v10.1; manutenção e proteção de alterações seguem funcionando.

Uma primeira execução encontrou somente a expectativa antiga de versão no teste do health (10.1.0). A expectativa foi atualizada para a versão desta entrega e a bateria completa foi executada novamente, com 266 aprovações.

## Conferência estática e arquivos

- Renderização das funções de interface em **196 combinações de clã/etapa/aba**, sem navegador: nenhum ID duplicado, `NaN` ou imagem ausente. Essa conferência valida o HTML produzido, não aparência ou interação visual.
- Quatorze retratos WebP válidos, 640 × 853 px, total de 864.644 bytes; os arquivos copiados para o build são idênticos aos originais do projeto. A montagem das artes foi inspecionada separadamente.
- O build inclui `creation-game.css` e todos os módulos e retratos novos. O assistente mantém uma barra inferior de saldo/continuação, catálogo paginado e regras de layout mobile/redução de movimento.
- Comparação profunda com o game-data da 10.1: todos os catálogos, custos, poderes, rituais e antecedentes preservados. Nos metadados de criação foram acrescentados somente o guia, Caitiff e a marca de normalização; combinações dos 13 clãs e reservas anteriores preservadas.
- JSONs válidos e `git diff --check` sem erros. O arquivo de entrega usa o commit no nome e seu conteúdo é comparado com todos os arquivos versionados antes de disponibilizar.

## Revisão no navegador: pendente

A abertura da prévia foi **bloqueada pela revisão automática por limite de uso da ferramenta**. Não houve revisão visual da nova criação no navegador, nem confirmação de interação em desktop/mobile nesta entrega. O bloqueio não foi contornado por outro navegador, automação ou acesso indireto.

A revisão visual registrada na 10.1 continua sendo evidência daquela versão, não desta interface nova. O tutorial inclui uma conferência de clãs, limites, pontos, retratos e envio em computador/celular antes de liberar para a mesa. A limitação não impede compilar ou testar os serviços e as regras, mas permanece necessária uma conferência visual no ambiente publicado.

## Compatibilidade e limites

Não há SQL novo nem mudança de formato ao passar de 10.1 para 10.2. Mantenha `coroa-storage-v10.1`; a normalização fornece os campos ausentes. Não importe o game-data inicial sobre uma campanha existente. Origem 10.0/9.x exige o caminho de conversão descrito em `../ATUALIZAR.md`.

Fraquezas são resumos introdutórios de Revised/3ª edição, acompanhadas narrativamente pelo narrador. Somente a restrição de Aparência Nosferatu ganha aplicação automática nesta alteração; não há desconto automático de Humanidade por convicções. Listas de clã, testes e pontos seguem as regras personalizadas da mesa.

O rascunho de criação fica na memória da aba e não persiste após fechá-la/recarregá-la; o envio concluído fica na API. Retratos dos clãs são recursos estáticos locais e não consultas externas durante o uso. Não há IA no aplicativo. As otimizações incrementais da versão anterior foram mantidas, sem nova aferição de latência em produção.

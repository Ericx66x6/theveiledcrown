# Qual JSON importar?

O livro de regras, uma ficha e o backup do portal são documentos diferentes. Um arquivo pode conter JSON válido e ainda assim estar no importador errado.

| Arquivo | O que contém | Onde importar |
| --- | --- | --- |
| `game_data*.json` | Disciplinas, características, antecedentes e configurações | Livro de regras → Gerenciar livro → Importar game-data |
| Ficha de personagem | Nome, ID, pontos e história de um personagem | Personagens → Importar JSON |
| Backup JSON/ZIP do portal | Contas, campanhas, personagens e regras | Arquivos da campanha → Importar backup JSON ou ZIP |

**Arquivos da campanha → Importar game-data (regras)** é outro acesso para importar somente o livro.

Para o JSON de regras desta entrega:

1. Entre como narrador e abra a campanha desejada.
2. Abra Livro de regras → Gerenciar livro.
3. Clique em Importar game-data e selecione `game_data_coroa_v9.2.2_validado.json`.
4. Use Validar e importar. A versão anterior do livro fica em backup.

Isso atualiza o catálogo e as configurações da campanha, conservando contas e fichas compatíveis. Um backup completo, por sua vez, substitui os dados do portal e exige a confirmação IMPORTAR; use-o para restauração, não para atualizar só o livro.

O JSON validado mantém os mesmos IDs, textos, custos e configurações do arquivo fornecido. A única adição é `"format": "coroa-game-data-v1"` para identificar seu conteúdo. Arquivos antigos sem esse campo continuam aceitos.

Se a importação apontar uma ficha incompatível, confira o personagem e o erro informado. Por exemplo, remover um ID usado por uma ficha ou baixar um limite abaixo de seus pontos atuais impede a importação. O sistema não remove traços dos jogadores para forçar a aceitação e não altera livro ou fichas quando a validação falha.

Se o arquivo correto continuar falhando em Importar game-data, guarde o texto exato do aviso e confira se frontend e API estão na versão 9.2.2. O arquivo desta entrega foi aceito na API de teste; isso não verifica os dados e a versão que estão publicados na sua campanha.

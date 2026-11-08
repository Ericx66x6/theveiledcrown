# Desempenho · A Coroa Velada 10.0

Medição local realizada em 08/11/2026, comparando o código 9.3.1 (`2f067155f357836e557538c9eca51295670f338e`) com a entrega 10.0. Os números abaixo são evidência de um cenário controlado; não foram medidos no seu Render ou Supabase e não representam garantia de latência em produção.

## Resultado

| Operação | 9.3.1 | 10.0 |
| --- | --- | --- |
| Primeira resposta da ficha, processo sem cache | 1288 ms | 285 ms |
| Resposta da ficha com cache / delta, mediana | 1095 ms | 54 ms |
| Salvar + atualizar a tela, mediana | 1636 ms | 286 ms |
| JSON enviado ao banco por salvamento, média | 2.308.584 bytes | 38.887 bytes |
| Requisições HTTP por salvar + atualizar | 2 | 1 |
| Sincronização sem mudanças, mediana | 721 ms | 1 ms |

O volume enviado ao banco por gravação caiu **98.3%** neste cenário. O ciclo salvar/atualizar ficou cerca de **5.7 vezes mais rápido** na execução registrada. A resposta aquecida transfere as alterações; não precisa repetir o livro ou as fotos.

## Como foi medido

- API HTTP real das duas versões, com os respectivos adaptadores de persistência.
- PostgreSQL local via PGlite, aplicando as funções SQL reais. Storage simulado em memória.
- Latência adicional controlada de 10 ms em cada chamada RPC/Storage; não é uma medição da rede dos provedores.
- Dados fictícios iguais: 12 personagens, quatro mapas, 32 locais, 30 snapshots e 30 entradas de histórico por personagem. Uma imagem JPEG de 346.271 bytes é reutilizada, permitindo deduplicação nas duas versões.
- Uma entrada com cache frio, quatro leituras aquecidas, quatro salvamentos de saldo e quatro sincronizações por versão. A criação dos dados e a conversão inicial ficam fora do intervalo cronometrado.
- A versão antiga precisa salvar e depois buscar novamente a tela. Na 10, o salvamento inclui a visão atualizada. A sincronização repetida sem mudanças é medida dentro da janela de cache de 750 ms da 10; fora dela, há um poll pequeno no banco.
- Os tempos medem HTTP e processamento da API. Não incluem inicialização de uma instância adormecida, tempo de pintura do navegador ou downloads posteriores das imagens visíveis. Na 9, a resposta JSON inclui as imagens; na 10, os downloads privados ocorrem separadamente.
- O tamanho enviado ao banco mede o corpo das RPCs, sem cabeçalhos. O arquivo JSON do relatório também registra os bytes HTTP recebidos. A 10 negocia gzip, referências de imagens e deltas; essa redução combina as três melhorias.

Os resultados variam com tamanho da campanha, imagens, histórico, CPU e rede. Uma amostra curta não mede percentis altos, concorrência sustentada, todas as telas ou disponibilidade dos provedores. O cache em memória é descartável e não substitui a persistência no Supabase.

## Reproduzir

Use Node.js 24 e `npm ci`. Para medir somente a versão atual com dados descartáveis:

```sh
npm run benchmark
```

Para comparar com uma cópia extraída do código 9.3.1:

```sh
npm run benchmark -- --baseline /CAMINHO/ABSOLUTO/DO/CODIGO-9.3.1 --out /CAMINHO/ABSOLUTO/resultado.json
```

As dependências do código anterior devem estar instaladas nessa cópia ou acessíveis na pasta pai. O comando não utiliza credenciais nem acessa seu banco real. Não use sua campanha como fixture. Os resultados completos desta entrega estão em `docs/DESEMPENHO-10.json`.

## Por que o banco continua seguro

O novo formato separa registros e índices internos. Cada alteração usa revisão esperada e transação: uma ficha não ganha XP antes de o banco confirmar. O servidor invalida o cache quando a confirmação falha e não repete pagamentos cegamente. Conflitos conhecidos reavaliam a operação; revisões antigas da ficha continuam recusadas.

As imagens permanecem em bucket privado. A API verifica a sessão e a visibilidade antes de servir bytes ou 304; o cache privado do navegador pode reutilizar uma imagem que o próprio usuário já recebeu. Revogar acesso impede novas leituras autorizadas, mas não apaga cópias já baixadas.

Os backups oferecidos pelo portal conservam seu formato portátil existente. Não se deve editar os documentos internos à mão nem publicar código 9 sobre armazenamento 10 sem usar a conversão de retorno do tutorial.

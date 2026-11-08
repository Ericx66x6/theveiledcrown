# Correção de carregamento · 9.3.1

A regra `#portal-loading` limitava a largura a 520 px, enquanto o diálogo continuava fixo em `left: 0` com margem zero. O indicador era centralizado dentro dessa faixa à esquerda.

O diálogo agora ocupa a largura e a altura completas da janela, sem limite máximo de tamanho. O conteúdo continua centralizado pelo flex existente, com fundo escuro, borda zero, aviso de demora e cancelamento preservados.

Verificação em navegador com os estilos completos do projeto e o módulo real `client/loading.js`:

| Tela | Dimensão do diálogo | Desvio horizontal do indicador | Borda |
| --- | --- | --- | --- |
| Desktop | 1363 × 936 px | 0 px | 0 px |
| Mobile | 360 × 844 px | 0 px | 0 px |
| Mobile | 390 × 844 px | 0 px | 0 px |

Conferidos o aviso após dez segundos e o retorno ao conteúdo ao interromper a espera. `npm run build` e `npm run check` passaram. Esta correção visual não adiciona novas regras ou dados; os 228 testes da versão-base estão documentados em `VALIDACAO-V93.md`.

A alteração de comportamento está em `client/gamefeel.css`. Os demais arquivos de aplicação alterados identificam a versão 9.3.1. Atualize o projeto e publique o frontend; não é necessário reimportar game-data, restaurar backups, mudar variáveis ou executar SQL.

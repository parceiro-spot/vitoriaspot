# Parceiro Spot — HTML/CSS/JavaScript

Arquivos separados do `meuSITESPOT.txt`.

## Recursos adicionados
- Aba **PNR — Bloco de Notas** no menu, com título, descrição, cores, minimizar, excluir e salvar no navegador.
- **Tutorial Profarma** com edição manual, adição de título, negrito, cor e salvar. O texto original permanece como padrão até o usuário editar.
- **Sinistro > Mensagens** com edição manual, adição de título, negrito, cor e salvar. As mensagens originais não foram alteradas.

Abra `index.html` diretamente ou publique os três arquivos juntos. O armazenamento usa `localStorage` do navegador.

- Navegação corrigida para todas as opções do menu, incluindo PNR e Reuniões.
- Reuniões permitem adicionar novas informações, escolher cor, usar negrito, editar e salvar após F5.

## Sinistro > DEMONSTRATIVO
- Arraste várias notas fiscais (DANFE em PDF) de uma vez. O **nome do arquivo é o ID** (ex.: `48054508351_17.pdf`).
- O demonstrativo é montado automaticamente no mesmo formato da planilha modelo (SHP_SHIPMENT_ID, TMS_DATA_FISCAL_NFE, NF, ITEM, QUANTIDADE ITEM, VALOR, STATUS). O valor é sempre o **VALOR TOTAL DA NOTA**.
- O nome do arquivo é sempre respeitado como está, inclusive `(PARTE 2)` (ex.: `48569637323 (PARTE 2)`). Só muda se outro arquivo tiver o mesmo nome: o primeiro mantém e os demais viram `-1`, `-2`... (ex.: `48054508351_17-1`, `48569637323 (PARTE 2)-1`). O aviso aparece só no painel de observações, não no demonstrativo.
- Nota fora do padrão, ilegível ou com a mesma chave de acesso repetida: fica de fora e o ID aparece no painel de observações.
- Exporta em **XLSX** e **PDF**. Tudo é lido no próprio navegador (nenhum arquivo é enviado para servidor).
- Precisa de internet para carregar as bibliotecas (pdf.js, ExcelJS, jsPDF) do cdnjs.
- Botão **BAIXAR AS N NOTAS**: baixa um ZIP só com as notas que entraram no demonstrativo, nomeadas com o ID final (`-1`, `-2`...). Notas não reconhecidas ou repetidas ficam de fora.

- Nome repetido **com as mesmas informações** (mesma NF, descrição, quantidade e valor): aparece um aviso vermelho "REPETIDA E IGUAL" no painel de observações, além do aviso de ID repetido. Se for a mesma chave de acesso, a repetição fica de fora.
- PDF exportado igual ao modelo: A4 paisagem, Arial 5,6 pt em todas as linhas. A fonte **não diminui** em descrição grande; ela quebra em 2 linhas no mesmo tamanho.
- Removeu uma nota no ✕ (ou clicou em Limpar tudo) sem querer? Aperte **Ctrl+Z** (ou o botão "Desfazer" que aparece embaixo) e ela volta no mesmo lugar. Dá para desfazer várias vezes.
- A ordem do demonstrativo é a mesma ordem em que os arquivos foram enviados (a ordem da pasta do PC). O sistema não reordena por nome.
- Nota com vários itens: o demonstrativo copia sempre só a descrição do **1º item** (ex.: `7908790700090 - Renovador Olhos de Gueixa - F2`), com quantidade 1 e o VALOR TOTAL DA NOTA. Um aviso informa que a nota tinha mais itens.

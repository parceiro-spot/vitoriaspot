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
- ID repetido: o primeiro mantém o ID e os demais viram `-1`, `-2`... (ex.: `48054508351_17-1`). O aviso aparece só no painel de observações, não no demonstrativo.
- Nota fora do padrão, ilegível ou com a mesma chave de acesso repetida: fica de fora e o ID aparece no painel de observações.
- Exporta em **XLSX** e **PDF**. Tudo é lido no próprio navegador (nenhum arquivo é enviado para servidor).
- Precisa de internet para carregar as bibliotecas (pdf.js, ExcelJS, jsPDF) do cdnjs.

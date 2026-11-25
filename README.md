# Parceiro Spot — HTML/CSS/JavaScript

Arquivos separados do `meuSITESPOT.txt`.

## Recursos adicionados
- Aba **PNR — Bloco de Notas** no menu, com título, descrição, cores, minimizar, excluir e salvar no navegador.
- **Tutorial Profarma** com edição manual, adição de título, negrito, cor e salvar. O texto original permanece como padrão até o usuário editar.
- **Sinistro > Mensagens** com edição manual, adição de título, negrito, cor e salvar. As mensagens originais não foram alteradas.

Abra `index.html` diretamente ou publique os três arquivos juntos. O armazenamento usa `localStorage` do navegador.

- Navegação corrigida para todas as opções do menu, incluindo PNR e Reuniões.
- Reuniões permitem adicionar novas informações, escolher cor, usar negrito, editar e salvar após F5.

## Sinistro > Mensagens — Criar Aviso de Sinistro
- Cole a ficha/relatório bruto no gerador e clique em **Preencher dados**.
- O sistema identifica data, horário, motorista, placa, CPF, veículo, quantidade sinistrada, local, valor e causa quando disponíveis.
- Cidade/UF, CEP, causa e qualquer outro campo podem ser corrigidos manualmente nos campos editáveis antes de clicar em **Gerar aviso**.
- O texto final também é editável e pode ser copiado pelo botão **Copiar aviso**.

## Sinistro > DEMONSTRATIVO
- Arraste várias notas fiscais (DANFE em PDF) de uma vez. O **nome do arquivo é o ID** (ex.: `48054508351_17.pdf`).
- O demonstrativo é montado automaticamente no mesmo formato da planilha modelo (SHP_SHIPMENT_ID, TMS_DATA_FISCAL_NFE, NF, ITEM, QUANTIDADE ITEM, VALOR, STATUS). O valor é sempre o **VALOR TOTAL DA NOTA**.
- O nome do arquivo é sempre respeitado como está, inclusive `(PARTE 2)` (ex.: `48569637323 (PARTE 2)`). Só muda se outro arquivo tiver o mesmo nome: o primeiro mantém e os demais viram `-1`, `-2`... (ex.: `48054508351_17-1`, `48569637323 (PARTE 2)-1`). O aviso aparece só no painel de observações, não no demonstrativo.
- Nota fora do padrão, ilegível ou com a mesma chave de acesso repetida: fica de fora e o ID aparece no painel de observações.
- Exporta em **XLSX** e **PDF**. Tudo é lido no próprio navegador (nenhum arquivo é enviado para servidor).
- Precisa de internet para carregar as bibliotecas (pdf.js, ExcelJS, jsPDF) do cdnjs.
- Botão **BAIXAR TODAS AS N NOTAS**: baixa um ZIP com todas as notas reconhecidas, inclusive duplicatas idênticas. As cópias idênticas recebem `(1)`, `(2)` etc. somente no nome dentro do ZIP.
- Botão **BAIXAR SEM DUPLICADAS IGUAIS**: baixa somente as notas que entram no demonstrativo, removendo as duplicatas quando descrição, NF, chave de acesso, quantidade e valor são todos iguais.
- Botão **AGRUPAR TODAS AS NOTAS**: junta em um único PDF as notas atuais do demonstrativo, sem duplicatas idênticas, na ordem de envio. O arquivo é nomeado `NOTAS FISCAIS AGRUPADAS - TODAS AS <quantidade> NOTAS.pdf`.
- O botão normal **BAIXAR NOTAS** baixa todas as notas atuais sem duplicatas iguais. O botão vermelho de download aparece quando há duplicatas iguais ou qualquer ID duplicado renomeado; ele fica como **BAIXAR COM DUPLICADAS** no primeiro caso e **BAIXAR COM ID DUPLICADO** no segundo, servindo também como lembrete visual. O botão vermelho **AGRUPAR COM DUPLICADAS** só aparece quando existem duplicatas com descrição, NF, chave, quantidade e valor exatamente iguais e gera `NOTAS FISCAIS AGRUPADAS - COM NOTAS DUPLICADAS.pdf`. A aba **AGRUPAR PDF** não recebe essa opção.

- Nome repetido **com as mesmas informações** (mesma NF, descrição, quantidade e valor): aparece um aviso vermelho "REPETIDA E IGUAL" no painel de observações, além do aviso de ID repetido. Se for a mesma chave de acesso, a repetição fica de fora.
- Quando houver uma duplicata com o mesmo ID e essas mesmas informações, o cartão vermelho **IDs repetidos com mesmas informações** também mostra a quantidade no topo do demonstrativo. IDs duplicados com informações diferentes continuam somente no cartão de renomeados (`-1`, `-2`...).
- PDF exportado igual ao modelo: A4 paisagem, Arial 5,6 pt em todas as linhas. A fonte **não diminui** em descrição grande; ela quebra em 2 linhas no mesmo tamanho.
- Removeu uma nota no ✕ (ou clicou em Limpar tudo) sem querer? Aperte **Ctrl+Z** (ou o botão "Desfazer" que aparece embaixo) e ela volta no mesmo lugar. Dá para desfazer várias vezes.
- A ordem do demonstrativo é a mesma ordem em que os arquivos foram enviados (a ordem da pasta do PC). O sistema não reordena por nome.
- Nota com vários itens: o demonstrativo copia sempre só a descrição do **1º item** (ex.: `7908790700090 - Renovador Olhos de Gueixa - F2`), com quantidade 1 e o VALOR TOTAL DA NOTA. Um aviso informa que a nota tinha mais itens.
- Colunas SHP_SHIPMENT_ID, TMS_DATA_FISCAL_NFE, NF e VALOR esticam sozinhas (como o clique duplo na borda da coluna do Excel) quando o conteúdo é maior, no XLSX e no PDF. No PDF todas as linhas ficam com a mesma altura (linha única); a descrição usa o espaço que sobrar e, se precisar, as margens da página diminuem em vez de a fonte encolher.

## Sinistro > AGRUPAR PDF
- Arraste vários PDFs e baixe **um único PDF** com todas as páginas, na mesma ordem em que foram enviados (ordem da pasta do PC). O nome sai como `Notas Fiscais - <motorista>.pdf`.
- ▲ ▼ mudam a ordem, ✕ remove e **Ctrl+Z** desfaz. PDF corrompido ou com senha é avisado e fica de fora.

## Sinistro > FOTO x PDF
- Arraste fotos (JPG, PNG, WEBP...) e gere **1 PDF com todas as fotos** (1 por página) ou **1 PDF para cada foto** (ZIP).
- Página **A4** (foto ajustada, retrato ou paisagem conforme a foto) ou **do tamanho da foto**. A orientação da foto do celular é respeitada.
- Mesma ordem em que as fotos foram enviadas; ▲ ▼ ✕ e Ctrl+Z funcionam igual. HEIC/HEIF não é aceito pelo navegador (avisa para enviar em JPG/PNG).
- Usa a biblioteca pdf-lib (cdnjs), então precisa de internet.

## Registro de Sinistro — nova ficha
- Aba **REGISTRO DE SINISTRO** dentro de SINISTRO, com casos organizados automaticamente por mês e busca por motorista, causa ou nome interno/Drive (ex.: ROUBO SSP45).
- Ficha editável com data/hora, dia da semana automático, quantidades essenciais (saída da base, entregue, sinistrada e recuperada), local, prejuízo, motorista, CPF, CNH, placa e tipo de veículo.
- Foto de referência real do tipo de veículo e campo para substituir pela foto real do caso.
- Controle de seguro aberto, resultado e motivo de recusa/não acionamento; ajudante opcional com ficha própria.
- Checklist de documentos com nomes editáveis, exclusão/adição e direcionamento de vários arquivos pelo nome.
- **Baixar portfólio** gera um ZIP com `ficha.html` navegável e pasta `documentos/`, para abrir e consultar os anexos sem depender de PDF. A opção de visualização/impressão continua disponível.
- Registros ficam salvos no navegador via `localStorage`; os anexos escolhidos ficam disponíveis para o portfólio durante a sessão atual.

### Correção de documentos no Registro de Sinistro
- Arquivos com `NOTAS FISCAIS`, `NOTA FISCAL` ou `DANFE` no nome são direcionados automaticamente para a categoria editável `DANFE / Notas fiscais`.
- Cada linha do checklist agora tem o botão **Adicionar**, permitindo anexar manualmente um ou vários arquivos diretamente naquela categoria.

### Organização por regional
- A ficha possui o campo editável **Regional** com Espírito Santo (SES/EBA), Minas Gerais (SMG/EMG), Bahia (SBA), Rio de Janeiro (ERJ/SRJ) e São Paulo (SSP).
- A lista é exibida em três níveis: **mês → regional → sinistros**.
- Cada bloco mensal mostra a quantidade total de sinistros; cada regional mostra seu próprio contador.
- O portfólio inclui o nome da regional e os anexos aparecem como links **Abrir / baixar**, funcionando para GR, CNH, CRLV, B.O., DANFE e demais arquivos anexados.

### Foto do motorista no portfólio
- O portfólio não usa mais a foto do caminhão como imagem principal.
- Ele procura a primeira imagem JPG, PNG ou WEBP anexada na categoria **CNH do motorista** e usa essa imagem no cabeçalho como foto do motorista.
- A CNH continua disponível também como documento clicável. Para que o rosto apareça no cabeçalho, anexe a CNH como imagem ou anexe um recorte/foto da área da foto dentro da categoria CNH; PDFs continuam disponíveis para abrir, mas não são recortados automaticamente pelo navegador.

### Checklist automático
- Ao anexar um arquivo em qualquer documento, a categoria é marcada automaticamente com **✓**.
- Se o arquivo não for anexado ou o item for desmarcado manualmente, aparece **✕** no checklist e no portfólio.

### Imagem profissional do veículo
- A imagem do veículo não usa mais foto de caminhão da internet.
- A ficha e o portfólio exibem uma ilustração vetorial limpa, com fundo branco, conforme o tipo selecionado: VUC, VAN, 3/4, TOCO, TRUCK, CARRETA ou MOTO.
- O portfólio mantém a foto do motorista pela CNH separada da ilustração profissional do veículo.

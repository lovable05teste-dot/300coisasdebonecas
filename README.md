# Mundo de Papel

Página de vendas e checkout Pix com uma função Node.js em `api/pix.js`.

## Configuração

Importe o repositório na Vercel como projeto **Other** e configure
`INVICTUSPAY_API_KEY` nas variáveis de ambiente do projeto. A chave é usada
somente pela função. Sem ela, o checkout funciona como prévia.

O servidor calcula os valores do catálogo, cria a cobrança em
`POST /api/v1/transactions` e consulta o status em
`GET /api/v1/transactions/{txId}`. O checkout mostra o QR Code e o Pix
Copia e Cola e confirma o pagamento quando a consulta retorna `paid`.

Antes de liberar vendas, valide a resposta de criação de Pix em uma conta
de teste. A documentação fornecida não inclui o JSON de retorno dessa
operação. A confirmação no checkout não realiza a entrega automática do PDF.

## Rastreamento

Cadastre `UTMIFY_API_TOKEN` e `META_CAPI_ACCESS_TOKEN` como segredos de
servidor no projeto de produção da Vercel. Gere uma credencial de API na
UTMify e um token da API de Conversões associado ao pixel Meta configurado
no site. Faça um redeploy após adicionar as variáveis.

Compras novas incluem uma URL de postback assinada quando pelo menos um
token está configurado. A função confirma o Pix na InvictusPay antes de
enviar a venda. O identificador da transação vincula a venda na UTMify e
é usado como identificador de evento no navegador e na API da Meta.
Na ausência de uma taxa inteira em centavos no retorno da InvictusPay,
a UTMify recebe a venda bruta com taxa zero.

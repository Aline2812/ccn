# Acesso ao sistema

No Render, em **Environment → Edit**, configure:

- `LOGIN_USER`: o usuário que terá acesso.
- `LOGIN_PASSWORD`: uma senha forte com **12 a 256 caracteres**.

Não coloque essas credenciais no GitHub. Salve as variáveis antes de publicar a versão com login.
Sem as duas variáveis válidas, o acesso aos dados permanece bloqueado. Não há senha padrão.

O login vale somente para a página aberta. Recarregar, fechar ou abrir outra aba exige uma nova
autenticação. O botão **Sair** revoga a sessão; ela também expira após quatro horas. Nenhuma
credencial ou sessão é gravada em cookies, `localStorage` ou `sessionStorage` pelo sistema.
O preenchimento de senhas pelo navegador depende das preferências do próprio navegador.

Para executar localmente no PowerShell, configure `LOGIN_USER` e `LOGIN_PASSWORD` nas variáveis
de ambiente da sessão do terminal e execute `npm.cmd start`. Use a mesma configuração de
banco desejada para o ambiente local. Não compartilhe senhas em mensagens ou imagens.

A API `/api/health` continua pública para verificar a conexão do banco. Leitura, alteração,
exclusão dos dados e os demais recursos da API exigem autenticação. Os arquivos do banco,
credenciais e fontes internos não são publicados pelo servidor HTTP.

Ao salvar, o sistema aguarda a confirmação do servidor e avisa se não conseguir gravar.
Não há mais gravação silenciosa dos cadastros no navegador. Faça backups periódicos usando
**Exportar backup**; a restauração inclui clientes, produtos, ordens, caixa e empresa.

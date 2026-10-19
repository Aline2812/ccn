# Desenvolvimento, testes e produção

## Branches

- `develop`: novas alterações e validação antes da publicação.
- `main`: versão aprovada e publicada em https://ccn-ryp0.onrender.com.

Faça as próximas alterações na `develop`. Só envie uma mudança para `main` depois da aprovação
dos testes e da pessoa responsável pelo sistema.

## Preparar o site de testes no Render

Crie um segundo **Web Service** conectado ao mesmo repositório `Aline2812/ccn`:

| Campo | Valor |
| --- | --- |
| Nome sugerido | `ccn-develop` |
| Branch | `develop` |
| Build command | `npm ci` |
| Start command | `npm start` |
| Health check path | `/api/health` |
| Auto-deploy | Ativado para a branch `develop` |

Configure no novo serviço:

- `LOGIN_USER`: usuário do ambiente de testes.
- `LOGIN_PASSWORD`: senha de teste forte, com 12 a 256 caracteres.
- `URL_POSTGRES`: URL de um **banco de testes separado**, nunca a conexão de produção.

No Neon, crie um projeto ou uma branch de banco separada para testes. Prefira um banco vazio
ou uma branch somente com a estrutura, usando cadastros fictícios para validar as mudanças.
Copie a conexão dessa branch específica em **Connect**. Confirme `/api/health` com
`"storage":"postgresql"` e confira no painel do Neon que a conexão pertence ao banco de testes.

O site atual continua ligado à `main`. Cada serviço do Render acompanha sua própria branch.
O `render.yaml` existente descreve o serviço original; ele não cria automaticamente o segundo
site. Este passo é feito separadamente no painel do Render.

## Atualizar e validar

```powershell
git switch develop
git pull --ff-only origin develop
# Implementar a alteração.
npm.cmd test
git add CAMINHOS_DOS_ARQUIVOS_ALTERADOS
git commit -m "Descrição da alteração"
git push origin develop
```

Depois que o segundo serviço estiver configurado, o push na `develop` aciona o deploy do site
de testes. Valide login, cadastros, OS e caixa nesse endereço com dados fictícios.

## Publicar uma versão aprovada

No GitHub, abra um pull request com **base `main`** e **compare `develop`**. Confira as alterações
e os testes e faça o merge depois da aprovação. A atualização da `main` aciona o deploy atual
de produção no Render.

Após a publicação, confira o login e `/api/health` em produção. Sincronize novamente:

```powershell
git fetch origin
git switch develop
git merge origin/main
git push origin develop
```

O merge publica o **código**. Os dados fictícios do banco de testes não são importados para
produção. Caso uma alteração futura exija migração de banco, ela precisa ser preparada e
validada separadamente antes da publicação.

## Referências

- [Deploys por branch no Render](https://render.com/docs/deploys)
- [Branches de banco no Neon](https://neon.com/docs/manage/branches)

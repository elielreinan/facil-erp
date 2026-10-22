# Banco do FacilERP

O projeto Supabase deste aplicativo e independente do GFacilERP. A configuracao
local da CLI esta em `config.toml`; as migrations versionadas registram o
baseline, a atualizacao do banco existente e a auditoria automatica.

## Estado remoto em 17/10/2026

- Projeto: `gjhnowasfdkifxriizje` (PostgreSQL 17.11).
- Backup de roles, schema e dados da aplicacao criado fora do repositorio em
  `Documents/Supabase-Backups/facil-erp-20261017-201116`. O dump SQL nao inclui
  objetos binarios do Storage nem substitui um teste de restauracao.
- As 12 migrations locais estao aplicadas no projeto remoto, incluindo
  integracao M2M, regras por setor, Storage privado e rotacao obrigatoria de
  senha temporaria. A migration `20261017215600_grant_service_role_profile_management.sql`
  concede a Edge Function acesso de leitura/insercao/atualizacao de perfis; a
  exclusao continua indisponivel diretamente pelo Data API.
- A migration local `20261016230500_sync_budget_totals.sql` recalcula
  `orcamentos.valor_previsto_total` ao inserir, alterar, mover ou excluir
  itens previstos. Foi aplicada e exercitada no PostgreSQL local e remoto.
- A migration local `20261016233000_sector_scoped_reads.sql` restringe
  consultas por setor e preserva a leitura ampla da Diretoria/NV3. Foi
  aplicada e verificada localmente e remotamente.
- A migration `20261016234800_complete_operational_crud.sql` habilita escrita
  de centros de custo para Suprimentos e fornece selecao restrita de perfis
  ativos para atribuicoes de TI/Suprimentos. Foi validada localmente e
  aplicada ao projeto remoto.
- `gfac-account-management` esta ativa com validacao M2M assinada propria
  (`verify_jwt=false`); `update-temporary-password` esta ativa com
  `verify_jwt=true`.
- O `service_role` pode consultar, inserir e atualizar `perfis` para o
  provisionamento administrativo; nao recebe permissao de exclusao direta.

## Matriz de leitura RLS

- Centros de custo: leitura por qualquer perfil ativo, como dado de referencia.
- Insumos: leitura por Suprimentos, Orcamentos, Diretoria, NV3 e admin.
- Compras, fornecedores e notas fiscais: Suprimentos, Diretoria, NV3 e admin.
- Orcamentos, itens previstos/realizados e metadados de documentos:
  Orcamentos, Diretoria, NV3 e admin.
- Patrimonio: TI, Diretoria, NV3 e admin.
- Auditoria: cada usuario le os proprios eventos; Diretoria, NV3 e admin leem
  os eventos operacionais de todos.
- Relatorios salvos permanecem privados ao criador, inclusive para Diretoria.
- Perfil inativo nao le tabelas operacionais. As escritas continuam seguindo
  as policies existentes por setor; Diretoria recebe leitura ampla, nao
  permissao de escrita nos setores.

## Sessao e acesso operacional no cliente

O cliente verifica primeiro `auth.getSession()`; sem sessao local, nao tenta
validar um usuario nem chama as RPCs de acesso. Com sessao, valida o token com
`auth.getUser(access_token)`, consulta `needs_password_rotation()` e depois
`is_profile_active()`. A senha temporaria leva a tela de troca; conta sem perfil
ativo recebe orientacao para procurar o administrador, em vez de alternar entre
login e um modulo operacional. As policies RLS continuam sendo a autoridade
final para leitura e escrita: as verificacoes do cliente nao as substituem.

Depois de alterar o codigo-fonte, reinicie o servidor local. Um instalador
Windows existente nao e atualizado automaticamente. O FacilERP 0.1.11 inclui
suporte a CSV UTF-8/UTF-16 separado por virgula, ponto e virgula ou tabulacao,
e evita abrir uma janela de console no executavel de producao. Instale a nova
versao para receber as correcoes; o pacote ainda precisa ser validado em
Windows limpo. TypeScript, lint, testes e build desktop passaram.

## Revisao opcional por agente na conferencia

O codigo local inclui um proxy Supabase Edge Function (`quote-agent`) para
OpenAI/ChatGPT ou Anthropic/Claude. O browser so o chama depois de uma acao e
consentimento expresso; chaves de provedor nunca entram no frontend. O backend
valida JWT, consulta orcamento/itens com o token do usuario para preservar RLS,
limita payload/tempo/resposta e usa quota de ate cinco chamadas por usuario/dia.
O modelo recebe nomes, unidades, quantidades, precos e comparacao; nao recebe o
arquivo original, nome do projeto, identidade do usuario ou historico de compra.
O modelo nao pode executar operacoes no banco.

Este conector ainda nao foi publicado/configurado e nao funciona nos instaladores
0.1.11/0.1.6. Para habilita-lo, o responsavel precisa aprovar o envio de dados a
terceiros e custos potenciais, aplicar
`20261021230000_add_quote_agent_quota.sql` em staging, configurar somente os
secrets do provedor aprovado (`OPENAI_API_KEY`/`OPENAI_QUOTE_MODEL` ou
`ANTHROPIC_API_KEY`/`ANTHROPIC_QUOTE_MODEL`) no painel seguro, estabelecer limite
global de gasto no provedor, publicar a funcao com JWT habilitado e testar antes
de qualquer deploy de producao. Nao configure secrets via frontend, arquivo
versionado, terminal ou chat. A quota diaria nao substitui o teto de gastos do
provedor. Gere novo instalador somente depois de aprovados deploy, consentimento
e testes.

`supabase/tests/sector_rls.sql` valida a matriz com usuarios ficticios em
transacao revertida, incluindo Suprimentos, Orcamentos, TI, Diretoria, NV3 e
perfil inativo. Tambem exercita CUD operacional por setor, arquivamento,
cascata de itens de orcamento e bloqueio da RPC de atribuicoes para setores
sem necessidade funcional. Storage privado e anexos de orcamentos, notas e
patrimonio usam metadados vinculados, paths por ativo/registro/usuario,
validacao de conteudo no cliente, limite de 10 MiB e policies por setor. A
matriz verifica as policies de objetos e as operacoes de metadados, mas nao
transfere bytes pela API nem demonstra restauracao de backup; esses dois
checks continuam obrigatorios em staging. Tambem testa o digito verificador
fiscal e o arredondamento atomico do total previsto por item. Rode com a stack
local iniciada:

```powershell
Get-Content -Raw -Path 'C:\caminho\FacilERP\supabase\tests\sector_rls.sql' |
  docker exec -i supabase_db_facil-erp psql -v ON_ERROR_STOP=1 -U postgres -d postgres
```

## Backup e restauracao dos anexos

O `storage:backup` exporta os objetos privados para um diretório absoluto fora
do repositório e grava um manifesto com caminho, tamanho, MIME e SHA-256.
`storage:restore` valida o manifesto, o caminho, os bytes e o hash antes de
recriar objetos; nunca sobrescreve objetos existentes e tenta remover os
objetos da tentativa se houver falha parcial.

Configure `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` somente no ambiente
local do operador. A chave privilegiada não deve ser colocada em argumentos,
logs, arquivos versionados ou no frontend. Use uma pasta de backup com ACL
restrita, fora do repositório, e teste a restauração em um projeto isolado:

```powershell
npm run storage:backup -- 'D:\Backups\FacilERP\storage-20261017'
npm run storage:restore -- 'D:\Backups\FacilERP\storage-20261017'
```

A restauração é aditiva: colisão de caminho causa falha sem sobrescrita.
Se a recuperação for para outro projeto, passe `--allow-cross-project`
explicitamente após o caminho; o script recusa por padrão restaurar o backup
em um projeto Supabase diferente.
Preserve uma cópia imutável do backup e registre o resultado em um local seguro.
A execução local do roteiro verifica bytes reais; o ciclo periódico de backup,
retenção, acesso do operador e restauração do bucket de staging ainda precisa
ser exercitado antes de considerar o plano de continuidade operacional aprovado.

Antes de qualquer nova migration remota, revisar o impacto e criar backup
atualizado fora do repositorio.

Nao use `db reset` em projetos remotos. Nao coloque senha do banco ou chaves
secret/service_role em variaveis `NEXT_PUBLIC_*`, no frontend ou no Git.

Se o CLI nao conseguir conectar ao PostgreSQL, verifique localmente
`SUPABASE_DB_PASSWORD`; nunca inclua a senha em arquivos versionados ou no chat.

## Ambiente local

`supabase/config.toml` desativa seeds para nao inserir dados demonstrativos.
Antes de iniciar o Postgres local, alinhe `db.major_version` com a versao
remota. A CLI e executada via `npx supabase`; login e sincronizacao remota
exigem autorizacao do operador.

## Integracao server-to-server com o GFacilERP

O modelo escolhido usa assinatura RSA de curta duracao. O GFacilERP valida o
administrador e assina o corpo da chamada com uma chave privada mantida somente
como segredo da Edge Function do GFacilERP. Esta funcao valida assinatura,
audiencia, emissor, escopo, validade, hash do corpo e nonce antes de operar no
Auth/perfil deste projeto. A service_role do FacilERP permanece apenas no
ambiente Edge do proprio FacilERP.

Estado remoto:

- `supabase/functions/gfac-account-management` recebe somente tokens M2M
  assinados; `verify_jwt = false` e intencional e a funcao aplica validacao
  criptografica propria.
- `20261016222500_add_gfac_m2m_account_management.sql` adiciona bloqueio
  imediato por perfil ativo, links de identidade e protecao contra replay.
- O fluxo de troca de senha temporaria esta publicado e protegido por JWT.
- A chave publica de verificacao deve ser configurada como
  `GFA_CROSS_PROJECT_PUBLIC_KEY_B64` somente no FacilERP. A chave privada
  correspondente deve ficar somente no segredo
  `GFA_CROSS_PROJECT_PRIVATE_KEY_B64` do GFacilERP. Nunca envie essas chaves
  pelo chat ou inclua-as no Git.

As funcoes M2M estao publicadas. A verificacao remota confirmou a origem
`http://tauri.localhost` e rejeitou chamadas sem autenticacao ao endpoint de
troca de senha. A chave publica do FacilERP e a chave privada do GFacilERP
permanecem somente no secret store dos respectivos projetos.

## Provisionamento com senha temporaria

Foi publicado um fluxo administrativo sem e-mail para criar contas
operacionais quando o SMTP nao esta disponivel. Ele cria a identidade Auth,
perfil NV1 ativo e vinculo M2M; `must_change_password` bloqueia as policies
operacionais ate a troca. A funcao `update-temporary-password` valida a sessao,
confirma a senha temporaria atual, exige uma senha forte diferente e so entao
libera o perfil. A senha nao e gravada em tabelas, auditoria, logs ou respostas.

A migration `20261017193000_require_temporary_password_rotation.sql` e as
Edge Functions estao aplicadas/publicadas. Nenhuma conta de teste foi criada
remotamente nesta etapa. O fluxo marca o e-mail como confirmado sem verificacao
por mensagem, portanto use-o somente para enderecos autorizados e previamente
conferidos pelo operador. Compartilhe senhas temporarias por canal seguro.
Convites e redefinicoes por email continuam indisponiveis sem SMTP configurado
e testado.

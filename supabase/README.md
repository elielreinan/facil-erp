# Banco do FacilERP

O projeto Supabase deste aplicativo e independente do GFacilERP. A configuracao
local da CLI esta em `config.toml`; as migrations versionadas registram o
baseline, a atualizacao do banco existente e a auditoria automatica.

## Estado remoto em 16/10/2026

- Projeto: `gjhnowasfdkifxriizje` (PostgreSQL 17.11).
- Backup manual de roles, schema e dados confirmado fora do repositorio em
  `Documents/Supabase-Backups/facil-erp-20261016-211336`.
- Baseline reconciliado com o schema existente; aplicadas as migrations
  `20261016221412_upgrade_existing_schema` e
  `20261016221500_add_automatic_audit`.
- Validado no banco: `orcamento_documentos`, `orcamentos.valor_previsto_total`,
  policy de perfil proprio e 11 triggers de auditoria.
- Historico `supabase_migrations.schema_migrations` consultado e alinhado com
  as tres migrations locais.
- Foi preparada localmente uma migration incremental e uma Edge Function
  receptora para a integracao assinada com o GFacilERP. Essa migration e a
  funcao ainda nao foram aplicadas/publicadas no projeto remoto.
- A migration local `20261016230500_sync_budget_totals.sql` recalcula
  `orcamentos.valor_previsto_total` ao inserir, alterar, mover ou excluir
  itens previstos. Foi aplicada e exercitada no PostgreSQL local; ainda nao
  foi aplicada no projeto remoto.
- A migration local `20261016233000_sector_scoped_reads.sql` restringe
  consultas por setor e preserva a leitura ampla da Diretoria/NV3. Foi
  aplicada e verificada localmente; ainda nao foi aplicada no projeto remoto.
- A migration `20261016234800_complete_operational_crud.sql` habilita escrita
  de centros de custo para Suprimentos e fornece selecao restrita de perfis
  ativos para atribuicoes de TI/Suprimentos. Foi validada localmente; nao foi
  aplicada ao projeto remoto.

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

Nao aplicar a migration remota sem revisao do impacto, backup atualizado e
autorizacao explicita.

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

Preparacao local:

- `supabase/functions/gfac-account-management` recebe somente tokens M2M
  assinados; `verify_jwt = false` e intencional e a funcao aplica validacao
  criptografica propria.
- `20261016222500_add_gfac_m2m_account_management.sql` adiciona bloqueio
  imediato por perfil ativo, links de identidade e protecao contra replay.
- O fluxo de convite/redefinicao redireciona para `/redefinir-senha`; a URL
  deve estar autorizada nas configuracoes de Auth do FacilERP.
- A chave publica de verificacao deve ser configurada como
  `GFA_CROSS_PROJECT_PUBLIC_KEY_B64` somente no FacilERP. A chave privada
  correspondente deve ficar somente no segredo
  `GFA_CROSS_PROJECT_PRIVATE_KEY_B64` do GFacilERP. Nunca envie essas chaves
  pelo chat ou inclua-as no Git.

Validacao local: migrations aplicadas em Postgres descartavel; foram
confirmadas 13 policies restritivas de perfil ativo e testado que perfil
inativo nao le dados operacionais. A Edge Function compilou no runtime local;
assinatura M2M valida, corpo adulterado rejeitado e replay do mesmo token
rejeitado. Convites, SMTP, redefinicao e mutacoes reais ainda dependem de
staging e configuracao das secrets.

Nao execute `db push` nem publique funcoes remotas ate revisar a migration,
configurar o par de chaves em ambiente seguro e autorizar explicitamente o
deploy.

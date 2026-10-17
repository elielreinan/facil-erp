import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

export const PRIVATE_DOCUMENT_BUCKET = 'erp-private-documents';
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MIME_TYPES = new Set(['application/pdf', 'application/xml', 'text/xml']);
const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIRECTORY = path.dirname(SCRIPT_DIRECTORY);

export function isValidBackupObjectPath(objectPath) {
  return /^(orcamentos|notas-fiscais|patrimonio)\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|xml)$/i.test(objectPath);
}

export function hasValidDocumentBytes(bytes, contentType) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > MAX_DOCUMENT_BYTES) return false;
  if (contentType === 'application/pdf') return bytes.subarray(0, 5).toString('ascii') === '%PDF-';
  if (!['application/xml', 'text/xml'].includes(contentType)) return false;
  return bytes.subarray(0, 1024).toString('utf8').replace(/^\uFEFF/, '').trimStart().startsWith('<');
}

async function assertRegularPath(root, segments, finalType) {
  const rootInfo = await lstat(root);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) {
    throw new Error('O diretório de backup deve ser uma pasta real, não um link simbólico.');
  }

  let current = root;
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment);
    const info = await lstat(current);
    const finalSegment = index === segments.length - 1;
    if (
      info.isSymbolicLink()
      || (finalSegment ? (finalType === 'file' ? !info.isFile() : !info.isDirectory()) : !info.isDirectory())
    ) {
      throw new Error('O backup contém links simbólicos ou tipos de arquivo inesperados.');
    }
  }
}

function resolveBackupDirectory(input) {
  if (!input || !path.isAbsolute(input)) {
    throw new Error('Informe um caminho absoluto para o diretório de backup.');
  }
  const directory = path.resolve(input);
  const relative = path.relative(PROJECT_DIRECTORY, directory);
  if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
    throw new Error('Backups não podem ser gravados dentro do repositório.');
  }
  return directory;
}

function getStorageClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente local do operador.');
  }

  const parsedUrl = new URL(url);
  const local = ['localhost', '127.0.0.1'].includes(parsedUrl.hostname);
  const hostedSupabase = /^[a-z0-9-]+\.supabase\.co$/i.test(parsedUrl.hostname);
  if (
    (!local && (parsedUrl.protocol !== 'https:' || !hostedSupabase))
    || parsedUrl.username
    || parsedUrl.password
  ) {
    throw new Error('Use a URL HTTPS oficial do Supabase ou o endpoint local, sem credenciais na URL.');
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return {
    bucket: supabase.storage.from(PRIVATE_DOCUMENT_BUCKET),
    getBucket: () => supabase.storage.getBucket(PRIVATE_DOCUMENT_BUCKET),
    projectRef: local ? 'local' : parsedUrl.hostname.split('.')[0],
  };
}

async function listAllObjectPaths(storage) {
  const paths = [];
  const visited = new Set();

  async function visit(prefix) {
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await storage.list(prefix, {
        limit: 100,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) throw new Error(`Falha ao listar objetos de Storage: ${error.message}`);
      const entries = data ?? [];
      for (const entry of entries) {
        if (!entry.name || entry.name === '.' || entry.name === '..' || entry.name.includes('/')) {
          throw new Error('O bucket contém uma entrada com nome inválido.');
        }
        const objectPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id === null) {
          if (visited.has(objectPath)) throw new Error('O bucket contém uma pasta repetida.');
          visited.add(objectPath);
          await visit(objectPath);
        } else {
          if (!isValidBackupObjectPath(objectPath)) {
            throw new Error(`O bucket contém um caminho fora do padrão de documentos privados: ${objectPath}`);
          }
          paths.push(objectPath);
        }
      }
      if (entries.length < 100) break;
    }
  }

  await visit('');
  return paths;
}

async function backup(directory) {
  const { bucket: storage, getBucket, projectRef } = getStorageClient();
  const { data: bucket, error: bucketError } = await getBucket();
  if (bucketError) throw new Error(`Não foi possível validar o bucket: ${bucketError.message}`);
  if (!bucket || bucket.public) throw new Error('O bucket de documentos precisa existir e ser privado.');

  await mkdir(directory, { recursive: false });
  const manifest = {
    version: 1,
    bucket: PRIVATE_DOCUMENT_BUCKET,
    projectRef,
    createdAt: new Date().toISOString(),
    files: [],
  };

  for (const objectPath of await listAllObjectPaths(storage)) {
    const { data, error } = await storage.download(objectPath);
    if (error) throw new Error(`Falha ao baixar ${objectPath}: ${error.message}`);
    if (!data) throw new Error(`Storage não retornou bytes para ${objectPath}.`);
    const bytes = Buffer.from(await data.arrayBuffer());
    const extension = path.extname(objectPath).toLowerCase();
    const contentType = data.type || (extension === '.pdf' ? 'application/pdf' : 'application/xml');
    if (
      !MIME_TYPES.has(contentType)
      || (extension === '.pdf') !== (contentType === 'application/pdf')
      || !hasValidDocumentBytes(bytes, contentType)
    ) {
      throw new Error(`O conteúdo de ${objectPath} excede o limite ou não corresponde ao tipo declarado.`);
    }

    const destination = path.resolve(directory, ...objectPath.split('/'));
    const relative = path.relative(directory, destination);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('O caminho do objeto sairia do diretório de backup.');
    }
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, bytes, { flag: 'wx' });
    manifest.files.push({
      path: objectPath,
      contentType,
      size: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }

  await writeFile(path.join(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  console.log(`Backup concluído: ${manifest.files.length} objeto(s). Mantenha a pasta fora do repositório e com ACL restrita.`);
}

async function restore(directory, allowCrossProject) {
  const { bucket: storage, getBucket, projectRef } = getStorageClient();
  const { data: bucket, error: bucketError } = await getBucket();
  if (bucketError) throw new Error(`Não foi possível validar o bucket: ${bucketError.message}`);
  if (!bucket || bucket.public) throw new Error('O bucket de documentos precisa existir e ser privado.');

  const manifestPath = path.join(directory, 'manifest.json');
  let manifest;
  try {
    await assertRegularPath(directory, ['manifest.json'], 'file');
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (caughtError) {
    throw new Error(`Manifesto indisponível ou inválido: ${caughtError instanceof Error ? caughtError.message : 'erro desconhecido'}`);
  }
  if (
    manifest?.version !== 1
    || manifest.bucket !== PRIVATE_DOCUMENT_BUCKET
    || typeof manifest.projectRef !== 'string'
    || !Array.isArray(manifest.files)
    || manifest.files.length > 100000
  ) {
    throw new Error('O manifesto não pertence a um backup compatível do bucket privado.');
  }
  if (manifest.projectRef !== projectRef && !allowCrossProject) {
    throw new Error('O projeto de destino difere do backup. Confirme com --allow-cross-project.');
  }

  const restoredPaths = [];
  try {
    const seen = new Set();
    for (const file of manifest.files) {
      if (
        !file
        || typeof file.path !== 'string'
        || !isValidBackupObjectPath(file.path)
        || seen.has(file.path)
        || !MIME_TYPES.has(file.contentType)
        || (file.path.endsWith('.pdf') !== (file.contentType === 'application/pdf'))
        || !Number.isInteger(file.size)
        || file.size < 1
        || file.size > MAX_DOCUMENT_BYTES
        || !/^[0-9a-f]{64}$/.test(file.sha256)
      ) {
        throw new Error('O manifesto contém uma entrada inválida ou duplicada.');
      }
      seen.add(file.path);

      const sourcePath = path.resolve(directory, ...file.path.split('/'));
      const relative = path.relative(directory, sourcePath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`Caminho de arquivo fora do backup: ${file.path}`);
      }
      await assertRegularPath(directory, file.path.split('/'), 'file');
      const bytes = await readFile(sourcePath);
      const digest = createHash('sha256').update(bytes).digest('hex');
      if (
        bytes.length !== file.size
        || digest !== file.sha256
        || !hasValidDocumentBytes(bytes, file.contentType)
      ) {
        throw new Error(`Integridade ou conteúdo inválido no arquivo ${file.path}.`);
      }

      const { error } = await storage.upload(file.path, bytes, {
        contentType: file.contentType,
        upsert: false,
      });
      if (error) throw new Error(`Falha ao restaurar ${file.path}: ${error.message}`);
      restoredPaths.push(file.path);
    }
  } catch (caughtError) {
    const rollbackErrors = [];
    if (restoredPaths.length) {
      const { error } = await storage.remove(restoredPaths);
      if (error) rollbackErrors.push(error.message);
    }
    const cause = caughtError instanceof Error ? caughtError.message : 'erro desconhecido';
    if (rollbackErrors.length) {
      throw new Error(`${cause} A reversão da restauração também falhou: ${rollbackErrors.join('; ')}`);
    }
    throw new Error(`${cause} Os objetos carregados nesta tentativa foram revertidos.`);
  }

  console.log(`Restauração concluída: ${restoredPaths.length} objeto(s).`);
}

async function main() {
  const [, , action, inputDirectory] = process.argv;
  const directory = resolveBackupDirectory(inputDirectory);
  if (action === 'backup') return backup(directory);
  if (action === 'restore') return restore(directory, process.argv.includes('--allow-cross-project'));
  throw new Error('Uso: node scripts/private-storage-backup.mjs <backup|restore> <caminho-absoluto> [--allow-cross-project]');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`Operação de Storage falhou: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
    process.exitCode = 1;
  });
}

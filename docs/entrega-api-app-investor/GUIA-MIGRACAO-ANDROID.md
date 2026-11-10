# Guia de migração do app Investor (Flutter/Dio) para o GAI

Este guia descreve o que mudar no app para trocar a base Laravel pela API mobile do GAI. O contrato de cada rota está em [RELATORIO-API-INVESTOR.md](RELATORIO-API-INVESTOR.md); a correspondência rota a rota, em [MATRIZ-MIGRACAO.md](MATRIZ-MIGRACAO.md); o contrato formal, em [openapi.yaml](openapi.yaml).

Os trechos de código são ilustrativos (Dart 3, `dio` 5, `flutter_secure_storage`). Adapte nomes e camadas à arquitetura atual do app (`lib/shareds/helpers/connection.dart`, `lib/shareds/sync/sync_impl.dart`, `lib/modules/auth/`, `lib/modules/reconciliacao/`).

> **Revisão 2, 10/11/2026.** URL base oficial (AWS/CloudFront, ainda sem domínio próprio): `https://d1kanjou9wgm7q.cloudfront.net/api/v1`. A API está implementada e testada localmente, mas as rotas `/mobile/*` **ainda não respondem nesse endereço**: devolvem 200 `text/html` até o deploy do módulo mobile. Rode o checklist da [seção 10](#10-checklist-de-homologação-do-app) quando o deploy for feito e antes de publicar o app.

## 1. Resumo das mudanças obrigatórias

| Área | Hoje (1.4.6) | Com o GAI |
|---|---|---|
| Base | `…/si/api` | `https://d1kanjou9wgm7q.cloudfront.net/api/v1` (configurável por flavor/ambiente) |
| Token | JWT de 1 h, só em login/refresh e reconciliação | Token opaco de 15 min em **todas** as rotas + refresh token rotativo |
| Formato | multipart / form-urlencoded / JSON | Só JSON (exceto o `PUT` binário ao storage) |
| Projetos | `GET /gai/projects` + filtro local | `GET /mobile/me` |
| Envio de item | `POST /gai/sync_items` (multipart com fotos) | `PUT …/items/{id}` (JSON) + fotos em 3 passos |
| Sucesso | só HTTP 200 | 200, 201 e 204 |
| Edição | sobrescreve | `base_version` + tratamento de 409 |
| Exclusão | só online, sem fila | fila, também offline |
| Atualização da base | `update_items` | sincronização por cursor |
| Pendências | `POST pendencias` com `itens: []` | `GET plates/report` |
| Despesas | multipart com texto livre | JSON validado + comprovante em 3 passos + permissão |
| Reconciliação | presign em lote, `path`, backup multipart | um arquivo por chamada, confirmação, `file_id`, backup em 3 passos |

## 2. Configuração do Dio

```dart
final api = Dio(BaseOptions(
  baseUrl: Env.gaiBaseUrl, // produção: https://d1kanjou9wgm7q.cloudfront.net/api/v1
  connectTimeout: const Duration(seconds: 15),
  sendTimeout: const Duration(seconds: 60),
  receiveTimeout: const Duration(seconds: 60),
  headers: {'Accept': 'application/json'},
  contentType: Headers.jsonContentType,
  // Deixe o app decidir pelo status; não lance exceção para 4xx esperados.
  validateStatus: (s) => s != null && s < 500,
));

// Cliente separado para o storage (S3): SEM interceptors de autenticação.
final storage = Dio(BaseOptions(
  connectTimeout: const Duration(seconds: 30),
  sendTimeout: const Duration(minutes: 5),
  receiveTimeout: const Duration(seconds: 60),
));
```

- Use **dois clientes**: o do GAI (com autenticação) e o do storage (sem nada). Um `Authorization` enviado ao storage invalida a URL pré-assinada.
- Não registre corpo de requisição/resposta de autenticação nem URLs pré-assinadas no log de diagnóstico.

Modelo de erro:

```dart
class ApiError {
  final int status;
  final String code;
  final String message; // junta a lista quando message vier como array
  final Map<String, dynamic>? details;
  ApiError(this.status, this.code, this.message, this.details);

  factory ApiError.from(Response r) {
    final body = r.data is Map ? r.data as Map : const {};
    final msg = body['message'];
    return ApiError(
      r.statusCode ?? 0,
      (body['code'] as String?) ?? 'UNKNOWN',
      msg is List ? msg.join('\n') : (msg?.toString() ?? ''),
      body['details'] is Map ? Map<String, dynamic>.from(body['details']) : null,
    );
  }
}
```

Decida sempre por `status` + `code`. Nunca compare a mensagem.

## 3. Sessão

### 3.1 Armazenamento seguro

```dart
class TokenStore {
  static const _s = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  Future<void> save(Map<String, dynamic> t) async {
    await _s.write(key: 'access_token', value: t['access_token']);
    await _s.write(key: 'refresh_token', value: t['refresh_token']);
    await _s.write(key: 'access_expires_at', value: t['access_token_expires_at']);
    await _s.write(key: 'session_expires_at', value: t['session_expires_at']);
  }

  Future<void> clear() => _s.deleteAll(); // não apaga a fila offline (outro storage)
}
```

Migração da versão atual: na primeira abertura da versão GAI, apague o JWT legado e peça login. A fila offline do Laravel precisa ser **esvaziada antes da atualização** (ou convertida para o formato novo — ver [5.5](#55-migração-da-fila-existente)).

### 3.2 Login, identidade e troca de senha

```dart
Future<void> login(String identifier, String password) async {
  final r = await api.post('/mobile/auth/login', data: {
    'identifier': identifier,
    'password': password,
    'device_label': await deviceLabel(), // ex.: modelo + nome do técnico
  });
  switch (r.statusCode) {
    case 200:
      await tokens.save(r.data);
      if (r.data['user']['must_change_password'] == true) {
        return nav.toChangePassword();
      }
      await loadMe();
    case 401: throw LoginError('Usuário ou senha inválidos.');
    case 403: throw LoginError('Acesso ao aplicativo não liberado para esta conta.');
    case 423: throw LoginError(ApiError.from(r).message); // bloqueio temporário
    case 429: throw LoginError('Muitas tentativas. Aguarde um minuto.');
    default:  throw LoginError('Não foi possível fazer o login.');
  }
}

Future<void> loadMe() async {
  final r = await api.get('/mobile/me');
  final me = MobileMe.fromJson(r.data);
  // Projetos já vêm filtrados pelo servidor. Não filtre localmente.
  // Permissões controlam o menu: despesas só com 'expenses:create'.
}
```

Troca de senha (`POST /auth/password/change {current_password, new_password}`): em 200, chame `tokens.clear()` e volte ao login — todas as sessões foram revogadas.

### 3.3 Refresh único (interceptor)

Requisitos: renovar antes de vencer ou ao receber 401; **um refresh por vez**; trocar os dois tokens; repetir a requisição original uma única vez.

```dart
class AuthInterceptor extends QueuedInterceptor {
  // `raw` é um Dio com as mesmas BaseOptions, SEM este interceptor: usado no refresh
  // e na repetição. Chamar o próprio `api` aqui dentro trava a fila do QueuedInterceptor.
  AuthInterceptor(this.raw, this.tokens);
  final Dio raw;
  final TokenStore tokens;
  Future<bool>? _refreshing; // compartilhado entre requisições concorrentes

  static const _public = ['/mobile/auth/login', '/mobile/auth/refresh', '/mobile/auth/logout'];

  @override
  Future<void> onRequest(RequestOptions o, RequestInterceptorHandler h) async {
    if (_public.contains(o.path)) return h.next(o);
    if (await tokens.accessExpiresWithin(const Duration(seconds: 60))) {
      await _refreshOnce();
    }
    o.headers['Authorization'] = 'Bearer ${await tokens.access()}';
    h.next(o);
  }

  @override
  Future<void> onResponse(Response r, ResponseInterceptorHandler h) async {
    final o = r.requestOptions;
    if (r.statusCode == 401 && !_public.contains(o.path) && o.extra['retried'] != true) {
      if (await _refreshOnce()) {
        o.extra['retried'] = true;
        o.headers['Authorization'] = 'Bearer ${await tokens.access()}';
        return h.resolve(await raw.fetch(o));
      }
      session.expired(); // vai ao login, mantém a fila
    }
    h.next(r);
  }

  Future<bool> _refreshOnce() => _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);

  Future<bool> _doRefresh() async {
    final refresh = await tokens.refresh();
    if (refresh == null) return false;
    final r = await raw.post('/mobile/auth/refresh', data: {'refresh_token': refresh});
    if (r.statusCode == 200) {
      await tokens.save(r.data); // grava ANTES de liberar as requisições em espera
      return true;
    }
    final e = ApiError.from(r);
    if (r.statusCode == 409 && e.code == 'REFRESH_TOKEN_ALREADY_ROTATED') {
      // Outro processo do app (ex.: WorkManager) renovou. Recarregue do storage.
      return await tokens.refresh() != refresh;
    }
    if (r.statusCode == 403) session.accessSuspended();
    if (r.statusCode == 401 || r.statusCode == 400) await tokens.clear();
    return false;
  }
}
```

- Se o app tem sincronização em segundo plano (WorkManager/isolate), use um **lock entre processos** (por exemplo, arquivo de lock ou serializar todo acesso à API num único isolate). Dois processos renovando com o mesmo token geram 409 e, após 30 s, 401 `REFRESH_TOKEN_REUSED` (sessão revogada).
- Antes de qualquer chamada, se `session_expires_at` já passou, vá direto ao login.

### 3.4 Tratamento de 401 e 403

| Resposta | Ação |
|---|---|
| 401 em rota de negócio | Refresh único + repetir uma vez. Se o refresh falhar: login, mantendo a fila. |
| 401 no refresh | Apagar tokens, login. |
| 403 `PASSWORD_CHANGE_REQUIRED` | Tela de troca de senha. |
| 403 `MOBILE_ACCESS_DENIED` | Tela “acesso suspenso”; pausar fila e sincronização. |
| 403 `FORBIDDEN` em `/mobile/projects/{id}/...` | Vínculo encerrado ou sem permissão: recarregar `/mobile/me`, retirar o projeto e pausar a fila daquele projeto. |

### 3.5 Logout

`POST /mobile/auth/logout {refresh_token}` → 204. Depois, `tokens.clear()`. Se a fila não estiver vazia, avise o técnico antes de sair.

## 4. Itens

### 4.1 Conversão do modelo local

```dart
String? _txt(String? v) => (v == null || v.trim().isEmpty) ? null : v.trim();

int? _year(String? ano) {
  final n = int.tryParse((ano ?? '').trim());
  return (n != null && n >= 1900 && n <= 2100) ? n : null;
}

String? _money(String? v) {
  final s = (v ?? '').trim().replaceAll('R\$', '').replaceAll(' ', '');
  if (s.isEmpty) return null;
  // "1.234,56" → "1234.56"; "150" → "150.00"
  final normalized = s.contains(',') ? s.replaceAll('.', '').replaceAll(',', '.') : s;
  final d = double.tryParse(normalized);
  return d == null ? null : d.toStringAsFixed(2);
}

Map<String, dynamic> toGaiBody(LocalItem i, {int? baseVersion}) => {
  if (baseVersion != null) 'base_version': baseVersion,
  'new_plate': _txt(i.placaNova),
  'old_plate': _txt(i.placaAntiga),
  'old_plate_2': _txt(i.placaAntiga2),
  'unit_text': _txt(i.unidade),
  'address_text': _txt(i.endereco),
  'location_text': _txt(i.localizacao),
  'description': _txt(i.descricao),
  'brand': _txt(i.marca),
  'model': _txt(i.modelo),
  'serial_number': _txt(i.numSerie),
  'capacity': _txt(i.capacidade),
  'year': _year(i.ano),
  'notes': _txt(i.obs),
  'extra_fields': i.extraFields.isEmpty ? null : i.extraFields, // Map<String, String>
};
```

- **Não** envie `id`, `gai_user`, `project_id`, `fonte` nem nomes em português: geram 400.
- Enviar o item inteiro é seguro: campos iguais aos do servidor não contam como mudança. Mas lembre que `null` **limpa**; se o app não conhece um campo (por exemplo, valores editados só pela web), **omita a chave** em vez de mandar `null`.
- Um `ano` não numérico vira `null`; se quiser preservar o texto, grave-o em `notes` ou em `extra_fields` (decisão de produto).
- O servidor normaliza as placas (`"ab-12"` → `"AB12"`). Atualize o item local com o `item` devolvido para comparar placas do mesmo jeito.
- Guarde `version` em cada item local (coluna nova) e a data da última sincronização.

### 4.2 Envio (criação e edição)

```dart
Future<SendResult> sendItem(int projectId, LocalItem i) async {
  final r = await api.put(
    '/mobile/projects/$projectId/items/${Uri.encodeComponent(i.externalId)}',
    data: toGaiBody(i, baseVersion: i.serverVersion), // null na criação
  );
  if (r.statusCode == 200 || r.statusCode == 201) {
    await db.applyServerItem(r.data['item']); // grava version, placas normalizadas
    return SendResult.done;
  }
  return classify(r); // ver 5.2
}
```

- `externalId` é o mesmo `microsecondsSinceEpoch` de hoje, **como texto**.
- Criação: `serverVersion == null` → 201. Reenvio do mesmo corpo após timeout → 200 `unchanged`.
- Edição: `base_version` = `serverVersion`. 409 → [4.4](#44-conflitos).

### 4.3 Exclusão

```dart
Future<SendResult> deleteItem(int projectId, LocalItem i) async {
  final q = i.serverVersion == null ? '' : '?base_version=${i.serverVersion}';
  final r = await api.delete('/mobile/projects/$projectId/items/${Uri.encodeComponent(i.externalId)}$q');
  if (r.statusCode == 200 || (r.statusCode == 404 && ApiError.from(r).code == 'ITEM_NOT_FOUND')) {
    await db.markDeleted(i.externalId);
    return SendResult.done;
  }
  return classify(r);
}
```

Ao excluir offline um item que ainda tem `PUT` pendente e nunca foi enviado, remova as operações da fila sem chamar o servidor.

### 4.4 Conflitos

```dart
Future<void> onConflict(int projectId, LocalItem local, ApiError e) async {
  final server = e.details?['item'] as Map<String, dynamic>?;
  if (e.code == 'ITEM_DELETED') {
    await db.markDeleted(local.externalId, reason: 'excluído no servidor');
    return queue.drop(local.externalId);
  }
  if (e.code == 'VERSION_CONFLICT' && server != null) {
    final changed = local.fieldsChangedSince(local.serverSnapshot); // o que o técnico mexeu
    final serverChanged = diff(local.serverSnapshot, server);       // o que mudou lá
    if (changed.keys.toSet().intersection(serverChanged.keys.toSet()).isEmpty) {
      // Sem colisão: reaplica só os campos do técnico sobre a versão nova.
      await queue.replacePut(local.externalId,
          body: {'base_version': server['version'], ...changed});
    } else {
      await conflicts.add(local, server); // tela para o técnico escolher
    }
  }
}
```

Guarde, por item, o último estado recebido do servidor (`serverSnapshot`) para calcular o que o técnico alterou. Nunca reenvie sem `base_version` atualizado.

## 5. Fila de envio

### 5.1 Modelo

| Coluna | Uso |
|---|---|
| `op` | `put_item`, `delete_item`, `upload_image`, `create_expense`, `upload_receipt` |
| `project_id`, `external_id` | Chave do item (ou `client_expense_id`) |
| `payload` | Corpo JSON já convertido |
| `attempts`, `next_attempt_at` | Backoff |
| `state` | `pending`, `conflict`, `failed` (definitivo), `blocked` (403/sessão) |
| `last_error` | `status` + `code` para a tela de pendências |

Ordem: por item, na ordem em que as operações foram criadas (`put_item` → `upload_image`… → `put_item` → `delete_item`). Itens diferentes podem ir em paralelo (mantenha 2, como hoje). Gatilhos atuais continuam válidos: abrir o app, salvar, editar, rede voltar e a cada 1 min.

### 5.2 Classificação das respostas

```dart
SendResult classify(Response r) {
  final e = ApiError.from(r);
  switch (r.statusCode) {
    case 401: return SendResult.retryAfterRefresh; // o interceptor já tentou; pausa até login
    case 403: return SendResult.blocked;           // não repetir; ver 3.4
    case 409: return SendResult.conflict;          // tela de conflitos
    case 410: return SendResult.restartUpload;     // só uploads
    case 429: return SendResult.retryLater;
  }
  if ((r.statusCode ?? 0) >= 500) return SendResult.retryLater;
  return SendResult.failed; // 400/404 etc.: definitivo, visível ao técnico
}
```

Erros de rede e timeouts (`DioExceptionType.connectionTimeout`, `receiveTimeout`, `connectionError`) → `retryLater`.

### 5.3 Backoff

```dart
Duration backoff(int attempt) {
  final base = Duration(seconds: 5 * (1 << attempt.clamp(0, 6))); // 5 s, 10 s, 20 s … 320 s
  final capped = base > const Duration(minutes: 5) ? const Duration(minutes: 5) : base;
  return capped + Duration(milliseconds: Random().nextInt(1000)); // jitter
}
```

Diferente de hoje, **não repita para sempre** erros 4xx: eles não se resolvem sozinhos.

### 5.4 Idempotência

Repetir após timeout é seguro para `PUT` de item (`unchanged`), `DELETE` (`already_deleted`), confirmações (`already_confirmed`), despesa com o mesmo `client_expense_id` (`existing`) e lote de reconciliação com a mesma `idempotency_key`. Gere essas chaves **uma vez**, ao criar a operação, e guarde-as na fila.

### 5.5 Migração da fila existente

Ao atualizar o app, itens pendentes do formato `sync_items` podem ser convertidos para `put_item` (criação sem `base_version`) + `upload_image` por foto ainda existente no aparelho. Como o `PUT` é idempotente, um item que já tinha chegado ao servidor pelo legado (mesmo id, mesmo projeto, se os dados foram migrados para o GAI) responderá 200 `unchanged` ou 409 (se divergiu). Exclusões locais nunca enviadas viram `delete_item`.

## 6. Sincronização por cursor

```dart
Future<void> syncProject(int projectId) async {
  var cursor = await db.cursor(projectId); // null na primeira vez
  while (true) {
    final r = await api.get('/mobile/projects/$projectId/items/sync',
        queryParameters: {'limit': 200, if (cursor != null) 'cursor': cursor});
    if (r.statusCode == 400 && ApiError.from(r).code == 'INVALID_CURSOR') {
      cursor = null; await db.saveCursor(projectId, null); continue;
    }
    if (r.statusCode != 200) throw ApiError.from(r);
    await db.transaction(() async {
      for (final it in r.data['items']) {
        await db.mergeServerItem(projectId, it); // ver regras abaixo
      }
      await db.saveCursor(projectId, r.data['next_cursor']); // só depois de aplicar a página
    });
    cursor = r.data['next_cursor'];
    if (r.data['has_more'] != true) break;
  }
}
```

Regras de `mergeServerItem`:

- Chave local: `external_item_id`. Se for `null`, use o `id` do servidor e marque **somente leitura**.
- `deleted == true` → remova ou marque excluído localmente (e descarte operações pendentes desse item, exceto se quiser alertar o técnico).
- Se houver operação pendente na fila para o item, **não sobrescreva** os campos locais: atualize só `serverSnapshot` (a fila resolverá com 200 ou 409).
- Aplique apenas se `version` recebida for maior que a local.
- `images` traz metadados das fotos do servidor; para exibir, peça `GET …/images` (URL de 300 s).

Quando rodar: ao abrir um projeto, após esvaziar a fila, periodicamente (por exemplo, a cada 5 min com o app aberto) e por ação do técnico. Substitui `update_items` e `GET /external/.../items/sync`.

## 7. Fotos

### 7.1 Envio de uma foto

```dart
Future<SendResult> uploadImage(int projectId, String externalId, File f) async {
  final bytes = await f.readAsBytes();
  final base = '/mobile/projects/$projectId/items/${Uri.encodeComponent(externalId)}/images';

  final r1 = await api.post('$base/upload-url', data: {
    'original_name': p.basename(f.path),
    'mime_type': 'image/jpeg',
    'size_bytes': bytes.length,
  });
  if (r1.statusCode != 201) return classify(r1); // 404 = item ainda não existe; 409 CONFLICT = 3 fotos
  final imageId = r1.data['image']['id'];
  final headers = Map<String, dynamic>.from(r1.data['upload_headers']);

  final r2 = await storage.put(r1.data['upload_url'],
      data: Stream.fromIterable([bytes]),
      options: Options(headers: headers, validateStatus: (_) => true));
  if (r2.statusCode != 200) return SendResult.restartUpload;

  final r3 = await api.post('$base/$imageId/confirm-upload', data: {});
  if (r3.statusCode == 200) {
    await db.setServerVersion(externalId, r3.data['item_version']);
    await db.markImageUploaded(f.path, imageId);
    return SendResult.done;
  }
  if (r3.statusCode == 410) return SendResult.restartUpload;
  return classify(r3);
}
```

- Envie os headers de `upload_headers` **exatamente**; não acrescente `Authorization`.
- Os três passos precisam caber em `expires_in_seconds` (300 s). Em rede lenta, prefira pedir a URL imediatamente antes do envio.
- Até 3 fotos por item, 10 MiB cada. A compressão atual (1600 px, qualidade 80) atende.
- Se a confirmação falhar com `STORAGE_*_MISMATCH`, o arquivo mudou entre o pedido e o envio: recomece.
- Uma foto pedida e abandonada fica `pending_upload` e ocupa vaga; remova-a com `DELETE …/images/{imageId}` antes de tentar outra, se receber 409 `CONFLICT`.

### 7.2 Liberar espaço no aparelho

Depois de `markImageUploaded`, o app pode apagar a foto local de itens sincronizados e exibir a do servidor via `GET …/images` (pedido 2 do legado). Não guarde `download_url`; ela expira em 300 s.

## 8. Placas e pendências

```dart
// Aviso de duplicidade no cadastro (com rede)
final r = await api.get('/mobile/projects/$pid/plates/check', queryParameters: {
  'plate': placa, 'kind': 'new', // 'old' cobre placa antiga e placa antiga 2
  if (editingId != null) 'exclude_external_id': editingId,
});
final exists = r.data['exists'] == true; // booleano JSON
```

```dart
// Tela Pendências
final r = await api.get('/mobile/projects/$pid/plates/report');
final faltantes = List<String>.from(r.data['missing_new_plates']['ranges']); // ["4","6-8"]
final dupNovas = r.data['duplicated_new_plates'];   // [{plate, items:[{external_item_id, technician:{name}, unit_text, location_text, description}]}]
final dupAntigas = r.data['duplicated_old_plates'];
```

- Esvazie a fila antes de abrir o relatório, para incluir os itens do próprio aparelho.
- Não envie itens nessa rota (o legado enviava `itens: []`).
- Sem rede, mantenha o cálculo local atual e avise que o resultado é parcial.

## 9. Despesas e reconciliação

### 9.1 Despesas

- Mostre o menu só se `me.permissions` contiver `expenses:create`. O histórico (`GET …/expenses`) exige `expenses:read`, que **não** aparece em `/mobile/me`: chame e esconda a lista se vier 403.
- Valide no formulário: data → `YYYY-MM-DD`; valor → `"0.00"`.
- Gere `client_expense_id` ao salvar (ex.: `exp-<microsecondsSinceEpoch>`), enfileire `create_expense` e, depois do 201/200, enfileire `upload_receipt` com o `expense.id` devolvido.
- Comprovante: mesmos 3 passos das fotos, em `…/expenses/{id}/attachments/upload-url` e `…/attachments/{attachmentId}/confirm-upload`; até **20 MiB**; JPEG, PNG, WEBP ou PDF.

```dart
final r = await api.post('/mobile/projects/$pid/expenses', data: {
  'client_expense_id': op.clientExpenseId,
  'description': form.descricao,
  'reason': form.motivo.isEmpty ? null : form.motivo,
  'expense_date': DateFormat('yyyy-MM-dd').format(form.data),
  'amount': _money(form.valor),
});
// 201 created | 200 existing → r.data['expense']['id']
```

### 9.2 Reconciliação

| Passo | Mudança |
|---|---|
| Abrir sessão | `POST /mobile/projects/{pid}/import-sessions {unidade, expected_payloads}`; ler `session_uuid` direto da resposta (sem `data`). Não enviar `project_id` nem `source`. |
| Fotos | Uma chamada `files/upload-url {type: "image", original_name, mime_type, size_bytes}` por foto; `PUT`; `files/{file_id}/confirm-upload`. Até 3 envios em paralelo ao storage. Guardar `file_id`. |
| Backup | `files/upload-url {type: "raw_backup", mime_type: "application/zip", ...}` (até 100 MiB, janela de 1800 s); `PUT`; `confirm-upload`. |
| Lotes | `{payload_number, idempotency_key, items}`; cada item com `operation: "upsert"` (ou `"delete"`), `external_item_id`, campos com os nomes do `PUT`, `sequence` como **texto** e `images: [{file_id}]`. Sem `gai_user`, `item_id`, `fonte`, `disk`, `path`, `sort_order`. |
| Campos nulos | Continue **omitindo** campos sem valor (como hoje): ausente mantém; `null` limpa. |
| Resultado do lote | `status` `processed` / `partially_processed` / `failed` + contagens. |
| Encerrar | `POST …/finish`; status final `finished`, `finished_with_errors` ou `failed`; 409 → ver relatório 8.4. |
| Status | Mapear `ready` → `receiving`, `completed` → `finished`, `completed_with_errors` → `finished_with_errors`; novos `cancelled` e `expired`. |
| Erros | `GET …/errors?page=1&page_size=100` → `items[]` (paginado). |
| Baixar itens | Usar a sincronização da [seção 6](#6-sincronização-por-cursor) e filtrar `unit_text` localmente. |
| Retomada | Persistir `session_uuid`, `file_id` e a chave de cada lote; reenviar com a mesma chave após falha. |

## 10. Checklist de homologação do app

- [ ] `GET https://d1kanjou9wgm7q.cloudfront.net/api/v1/health` responde `200 {"status":"ok"}` e `GET /mobile/me` sem token responde **401 JSON**, não HTML. Isso confirma que o módulo mobile foi publicado.

- [ ] Login com e-mail e com login; senha errada; conta bloqueada (423); conta sem inventariante (403).
- [ ] Troca obrigatória de senha e novo login.
- [ ] Token expirando durante o uso: refresh transparente; duas requisições simultâneas com token vencido geram **um** refresh.
- [ ] Refresh com app em segundo plano e em primeiro plano ao mesmo tempo (sem 401 `REFRESH_TOKEN_REUSED`).
- [ ] Logout; sessão de 30 dias expirada leva ao login sem perder a fila.
- [ ] Inventariante bloqueado durante o uso: 403 e tela de acesso suspenso.
- [ ] Projeto desvinculado durante o uso: some da lista; fila do projeto pausada.
- [ ] Cadastro offline de 50 itens com 3 fotos cada; sincronização ao voltar a rede, sem duplicatas.
- [ ] Reenvio após timeout (`unchanged`, `already_confirmed`).
- [ ] Mesmo item editado em dois aparelhos: um 200, outro 409 e recuperação.
- [ ] Item editado na web enquanto o técnico edita offline.
- [ ] Exclusão offline e reenvio de edição antiga (`ITEM_DELETED`).
- [ ] Sincronização com cursor interrompida no meio e retomada; item da web aparece somente leitura.
- [ ] Foto com janela expirada (410) e foto trocada (409 `STORAGE_*_MISMATCH`).
- [ ] Pendências comparadas com o resultado do Laravel para o mesmo projeto (incluindo `placa_antiga_2`).
- [ ] Despesa com comprovante, reenviada duas vezes (mesmo `id`); comprovante de 21 MiB recusado.
- [ ] Reconciliação com backup de ~100 MiB em rede móvel, lote com erro parcial, retomada após fechar o app.
- [ ] 429 com vários aparelhos na mesma rede Wi-Fi: backoff sem perder dados.

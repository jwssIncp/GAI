-- Demo data for the local "Projeto TEste".
-- Safe to rerun: only rows tagged with demo_seed=project-test-v1 are replaced.

SET NAMES utf8mb4;
SET @demo_seed = 'project-test-v1';
SET @project_id = (
  SELECT id
  FROM projects
  WHERE LOWER(name) = LOWER('Projeto TEste')
  ORDER BY id
  LIMIT 1
);
SET @organization_id = (
  SELECT organization_id FROM projects WHERE id = @project_id
);
SET @company_id = (
  SELECT company_id FROM projects WHERE id = @project_id
);
SET @actor_id = (
  SELECT id
  FROM users
  WHERE organization_id = @organization_id
    AND status = 'ACTIVE'
  ORDER BY id
  LIMIT 1
);

START TRANSACTION;

-- Remove only data previously created by this demo seed.
DELETE audit
FROM inventory_item_audit_logs audit
INNER JOIN inventory_items item ON item.id = audit.inventory_item_id
WHERE JSON_UNQUOTE(JSON_EXTRACT(item.metadata, '$.demo_seed')) = @demo_seed;

DELETE FROM inventory_pending_issues
WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.demo_seed')) = @demo_seed;

DELETE FROM field_agent_payments
WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.demo_seed')) = @demo_seed;

DELETE FROM expenses
WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.demo_seed')) = @demo_seed;

DELETE FROM import_sessions
WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.demo_seed')) = @demo_seed;

DELETE FROM export_jobs
WHERE project_id = @project_id
  AND file_name LIKE 'demo-project-test-%';

DELETE FROM inventory_accounting_items
WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.demo_seed')) = @demo_seed;

DELETE FROM accounting_import_batches
WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.demo_seed')) = @demo_seed;

DELETE FROM inventory_items
WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.demo_seed')) = @demo_seed;

DELETE assignment
FROM project_field_agents assignment
INNER JOIN field_agents agent ON agent.id = assignment.field_agent_id
WHERE JSON_UNQUOTE(JSON_EXTRACT(agent.metadata, '$.demo_seed')) = @demo_seed;

DELETE FROM field_agents
WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.demo_seed')) = @demo_seed;

DELETE project_unit
FROM project_units project_unit
INNER JOIN company_units unit ON unit.id = project_unit.company_unit_id
WHERE JSON_UNQUOTE(JSON_EXTRACT(unit.metadata, '$.demo_seed')) = @demo_seed;

DELETE FROM company_units
WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.demo_seed')) = @demo_seed;

-- Units used by dashboard geography and unit filters.
INSERT INTO company_units (
  organization_id, company_id, name, code, zipcode, address, number,
  district, city, state, country, status, metadata
) VALUES
  (@organization_id, @company_id, 'Matriz São Paulo', 'SP-MATRIZ', '01310-100',
   'Avenida Paulista', '1000', 'Bela Vista', 'São Paulo', 'SP', 'BR', 'active',
   JSON_OBJECT('demo_seed', @demo_seed)),
  (@organization_id, @company_id, 'Centro Logístico Campinas', 'SP-CPS', '13083-970',
   'Rodovia Dom Pedro I', '500', 'Parque das Universidades', 'Campinas', 'SP', 'BR', 'active',
   JSON_OBJECT('demo_seed', @demo_seed)),
  (@organization_id, @company_id, 'Filial Rio de Janeiro', 'RJ-FILIAL', '20040-020',
   'Avenida Rio Branco', '156', 'Centro', 'Rio de Janeiro', 'RJ', 'BR', 'active',
   JSON_OBJECT('demo_seed', @demo_seed)),
  (@organization_id, @company_id, 'Unidade Belo Horizonte', 'MG-UNIDADE', '30130-110',
   'Avenida Afonso Pena', '1500', 'Centro', 'Belo Horizonte', 'MG', 'BR', 'active',
   JSON_OBJECT('demo_seed', @demo_seed));

INSERT INTO project_units (organization_id, project_id, company_unit_id)
SELECT @organization_id, @project_id, id
FROM company_units
WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.demo_seed')) = @demo_seed;

-- Field agents and assignments.
INSERT INTO field_agents (
  organization_id, name, email, phone, document, status, metadata
) VALUES
  (@organization_id, 'Ana Souza', 'ana.souza.demo@gai.local', '11990001001',
   'DEMO-AGENT-001', 'active', JSON_OBJECT('demo_seed', @demo_seed)),
  (@organization_id, 'Bruno Lima', 'bruno.lima.demo@gai.local', '11990001002',
   'DEMO-AGENT-002', 'active', JSON_OBJECT('demo_seed', @demo_seed)),
  (@organization_id, 'Carla Mendes', 'carla.mendes.demo@gai.local', '21990001003',
   'DEMO-AGENT-003', 'active', JSON_OBJECT('demo_seed', @demo_seed)),
  (@organization_id, 'Diego Alves', 'diego.alves.demo@gai.local', '31990001004',
   'DEMO-AGENT-004', 'inactive', JSON_OBJECT('demo_seed', @demo_seed));

INSERT INTO project_field_agents (
  organization_id, project_id, field_agent_id, role, status,
  start_date, end_date, notes
)
SELECT
  @organization_id,
  @project_id,
  id,
  CASE
    WHEN name = 'Ana Souza' THEN 'Coordenadora de inventário'
    ELSE 'Inventariante'
  END,
  CASE
    WHEN name = 'Carla Mendes' THEN 'finished'
    WHEN name = 'Diego Alves' THEN 'inactive'
    ELSE 'active'
  END,
  CURRENT_DATE - INTERVAL 30 DAY,
  CASE
    WHEN name = 'Carla Mendes' THEN CURRENT_DATE - INTERVAL 3 DAY
    ELSE NULL
  END,
  'Vínculo criado pela carga de demonstração'
FROM field_agents
WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.demo_seed')) = @demo_seed;

-- Reusable sequence for bulk demo rows.
DROP TEMPORARY TABLE IF EXISTS demo_numbers;
CREATE TEMPORARY TABLE demo_numbers (n INT UNSIGNED NOT NULL PRIMARY KEY);
INSERT INTO demo_numbers
WITH RECURSIVE sequence_numbers(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM sequence_numbers WHERE n < 60
)
SELECT n FROM sequence_numbers;

-- Sixty assets spread across dates, statuses, units and data-quality cases.
INSERT INTO inventory_items (
  organization_id, project_id, external_item_id, sequence, old_plate, new_plate,
  unit_text, address_text, location_text, description, brand, model,
  serial_number, capacity, year, notes, source, used_value, new_value,
  status, metadata, created_by_id, updated_by_id, created_at, updated_at
)
SELECT
  @organization_id,
  @project_id,
  CONCAT('DEMO-ITEM-', LPAD(n, 3, '0')),
  LPAD(n, 4, '0'),
  CONCAT('PAT-', LPAD(1000 + n, 5, '0')),
  CASE WHEN MOD(n, 4) = 0 THEN CONCAT('GAI-', LPAD(2000 + n, 5, '0')) ELSE NULL END,
  CASE
    WHEN MOD(n, 10) = 0 THEN NULL
    WHEN MOD(n, 4) = 1 THEN 'Matriz São Paulo'
    WHEN MOD(n, 4) = 2 THEN 'Centro Logístico Campinas'
    WHEN MOD(n, 4) = 3 THEN 'Filial Rio de Janeiro'
    ELSE 'Unidade Belo Horizonte'
  END,
  CASE
    WHEN MOD(n, 4) = 1 THEN 'Avenida Paulista, 1000'
    WHEN MOD(n, 4) = 2 THEN 'Rodovia Dom Pedro I, 500'
    WHEN MOD(n, 4) = 3 THEN 'Avenida Rio Branco, 156'
    ELSE 'Avenida Afonso Pena, 1500'
  END,
  CASE
    WHEN MOD(n, 11) = 0 THEN NULL
    WHEN MOD(n, 5) = 0 THEN 'Almoxarifado'
    WHEN MOD(n, 5) = 1 THEN 'Administrativo'
    WHEN MOD(n, 5) = 2 THEN 'Operações'
    WHEN MOD(n, 5) = 3 THEN 'Tecnologia'
    ELSE 'Manutenção'
  END,
  CASE
    WHEN MOD(n, 13) = 0 THEN NULL
    WHEN MOD(n, 6) = 0 THEN 'Notebook corporativo'
    WHEN MOD(n, 6) = 1 THEN 'Monitor LED 24 polegadas'
    WHEN MOD(n, 6) = 2 THEN 'Cadeira ergonômica'
    WHEN MOD(n, 6) = 3 THEN 'Impressora multifuncional'
    WHEN MOD(n, 6) = 4 THEN 'Ar-condicionado split'
    ELSE 'Servidor de aplicação'
  END,
  CASE MOD(n, 4)
    WHEN 0 THEN 'Dell'
    WHEN 1 THEN 'Samsung'
    WHEN 2 THEN 'Flexform'
    ELSE 'HP'
  END,
  CONCAT('Modelo ', CHAR(65 + MOD(n, 6))),
  CONCAT('SN-DEMO-', LPAD(n, 5, '0')),
  CASE WHEN MOD(n, 6) = 4 THEN '12000 BTU' ELSE NULL END,
  2019 + MOD(n, 7),
  CASE WHEN MOD(n, 9) = 0 THEN 'Necessita revisão cadastral' ELSE 'Item de demonstração' END,
  'demo_seed',
  ROUND(500 + (n * 137.45), 2),
  ROUND(800 + (n * 189.90), 2),
  CASE
    WHEN n <= 34 THEN 'evaluated'
    WHEN n <= 44 THEN 'pending'
    WHEN n <= 50 THEN 'divergent'
    WHEN n <= 55 THEN 'not_found'
    ELSE 'duplicated'
  END,
  JSON_OBJECT('demo_seed', @demo_seed, 'sample_number', n),
  @actor_id,
  @actor_id,
  NOW(3) - INTERVAL (30 + MOD(n, 15)) DAY,
  NOW(3) - INTERVAL MOD(n - 1, 25) DAY
FROM demo_numbers;

INSERT INTO inventory_item_audit_logs (
  inventory_item_id, organization_id, project_id, operation,
  performed_by, changes, created_at
)
SELECT
  id,
  organization_id,
  project_id,
  CASE WHEN status = 'evaluated' THEN 'evaluate' ELSE 'update' END,
  @actor_id,
  JSON_OBJECT(
    'status',
    JSON_OBJECT('before', 'pending', 'after', status),
    'demo_seed',
    JSON_OBJECT('before', NULL, 'after', @demo_seed)
  ),
  updated_at
FROM inventory_items
WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.demo_seed')) = @demo_seed;

-- Accounting import and reconciliation sample.
INSERT INTO accounting_import_batches (
  organization_id, project_id, original_file_name, storage_provider,
  status, total_rows, processed_rows, success_rows, failed_rows,
  imported_by_id, started_at, finished_at, metadata
) VALUES (
  @organization_id, @project_id, 'base-contabil-demonstracao.xlsx', 'local',
  'finished', 24, 24, 22, 2, @actor_id,
  NOW(3) - INTERVAL 12 DAY, NOW(3) - INTERVAL 12 DAY,
  JSON_OBJECT('demo_seed', @demo_seed)
);
SET @accounting_batch_id = LAST_INSERT_ID();

INSERT INTO inventory_accounting_items (
  organization_id, project_id, plate, description,
  accounting_account_description, location, acquisition_date,
  acquisition_value, base_code, status, investor_code,
  new_inventory_plate, inventory_description, inventory_location,
  metadata, imported_by_id, import_batch_id, created_at, updated_at
)
SELECT
  @organization_id,
  @project_id,
  CONCAT('PAT-', LPAD(1000 + n, 5, '0')),
  CONCAT('Bem contábil de demonstração ', n),
  CASE WHEN MOD(n, 2) = 0 THEN 'Máquinas e equipamentos' ELSE 'Móveis e utensílios' END,
  CASE MOD(n, 4)
    WHEN 0 THEN 'Unidade Belo Horizonte'
    WHEN 1 THEN 'Matriz São Paulo'
    WHEN 2 THEN 'Centro Logístico Campinas'
    ELSE 'Filial Rio de Janeiro'
  END,
  CURRENT_DATE - INTERVAL (365 + n * 20) DAY,
  ROUND(1000 + n * 275.35, 2),
  CONCAT('CTB-DEMO-', LPAD(n, 3, '0')),
  CASE
    WHEN n <= 15 THEN 'matched'
    WHEN n <= 19 THEN 'divergent'
    WHEN n <= 22 THEN 'not_found'
    ELSE 'ignored'
  END,
  CONCAT('INV-', LPAD(n, 3, '0')),
  CASE WHEN n <= 15 THEN CONCAT('GAI-', LPAD(2000 + n, 5, '0')) ELSE NULL END,
  CONCAT('Descrição conciliada ', n),
  'Localização validada',
  JSON_OBJECT('demo_seed', @demo_seed, 'sample_number', n),
  @actor_id,
  @accounting_batch_id,
  NOW(3) - INTERVAL 12 DAY,
  NOW(3) - INTERVAL (MOD(n, 8) + 1) DAY
FROM demo_numbers
WHERE n <= 24;

-- Pending issues with mixed workflow states and severities.
INSERT INTO inventory_pending_issues (
  organization_id, project_id, inventory_item_id, accounting_item_id,
  type, status, severity, title, description, resolution_notes,
  resolved_by_id, resolved_at, ignored_by_id, ignored_at,
  created_by_id, updated_by_id, metadata, created_at, updated_at
)
SELECT
  @organization_id,
  @project_id,
  item.id,
  accounting.id,
  CASE MOD(numbers.n, 4)
    WHEN 0 THEN 'location_mismatch'
    WHEN 1 THEN 'value_mismatch'
    WHEN 2 THEN 'missing_plate'
    ELSE 'description_mismatch'
  END,
  CASE
    WHEN numbers.n <= 4 THEN 'open'
    WHEN numbers.n <= 6 THEN 'in_review'
    WHEN numbers.n <= 8 THEN 'resolved'
    WHEN numbers.n = 9 THEN 'ignored'
    ELSE 'cancelled'
  END,
  CASE MOD(numbers.n, 4)
    WHEN 0 THEN 'critical'
    WHEN 1 THEN 'high'
    WHEN 2 THEN 'medium'
    ELSE 'low'
  END,
  CONCAT('Pendência de demonstração ', numbers.n),
  'Divergência criada para validar filtros, indicadores e fluxo de resolução.',
  CASE WHEN numbers.n BETWEEN 7 AND 8 THEN 'Conferido e corrigido pela equipe.' ELSE NULL END,
  CASE WHEN numbers.n BETWEEN 7 AND 8 THEN @actor_id ELSE NULL END,
  CASE WHEN numbers.n BETWEEN 7 AND 8 THEN NOW(3) - INTERVAL 2 DAY ELSE NULL END,
  CASE WHEN numbers.n = 9 THEN @actor_id ELSE NULL END,
  CASE WHEN numbers.n = 9 THEN NOW(3) - INTERVAL 1 DAY ELSE NULL END,
  @actor_id,
  @actor_id,
  JSON_OBJECT('demo_seed', @demo_seed, 'sample_number', numbers.n),
  NOW(3) - INTERVAL (11 - numbers.n) DAY,
  NOW(3) - INTERVAL MOD(numbers.n, 3) DAY
FROM demo_numbers numbers
INNER JOIN inventory_items item
  ON item.external_item_id = CONCAT('DEMO-ITEM-', LPAD(numbers.n + 34, 3, '0'))
LEFT JOIN inventory_accounting_items accounting
  ON accounting.base_code = CONCAT('CTB-DEMO-', LPAD(numbers.n + 14, 3, '0'))
WHERE numbers.n <= 10;

-- Payments and expenses.
INSERT INTO field_agent_payments (
  organization_id, project_id, field_agent_id, state, start_date, end_date,
  payment_date, days, daily_rate, additional_amount, daily_total,
  discount_amount, final_amount, status, notes,
  approved_by_id, approved_at, paid_by_id, paid_at,
  created_by_id, updated_by_id, metadata, created_at, updated_at
)
SELECT
  @organization_id,
  @project_id,
  agent.id,
  CASE MOD(numbers.n, 3) WHEN 0 THEN 'MG' WHEN 1 THEN 'SP' ELSE 'RJ' END,
  CURRENT_DATE - INTERVAL (numbers.n * 7) DAY,
  CURRENT_DATE - INTERVAL (numbers.n * 7 - 4) DAY,
  CASE WHEN numbers.n <= 2 THEN CURRENT_DATE - INTERVAL numbers.n DAY ELSE NULL END,
  5,
  320.00 + numbers.n * 20,
  CASE WHEN MOD(numbers.n, 2) = 0 THEN 150.00 ELSE 0.00 END,
  5 * (320.00 + numbers.n * 20),
  CASE WHEN numbers.n = 3 THEN 50.00 ELSE 0.00 END,
  5 * (320.00 + numbers.n * 20)
    + CASE WHEN MOD(numbers.n, 2) = 0 THEN 150.00 ELSE 0.00 END
    - CASE WHEN numbers.n = 3 THEN 50.00 ELSE 0.00 END,
  CASE
    WHEN numbers.n <= 2 THEN 'paid'
    WHEN numbers.n = 3 THEN 'approved'
    WHEN numbers.n <= 5 THEN 'pending'
    ELSE 'cancelled'
  END,
  'Pagamento de demonstração',
  CASE WHEN numbers.n <= 3 THEN @actor_id ELSE NULL END,
  CASE WHEN numbers.n <= 3 THEN NOW(3) - INTERVAL 2 DAY ELSE NULL END,
  CASE WHEN numbers.n <= 2 THEN @actor_id ELSE NULL END,
  CASE WHEN numbers.n <= 2 THEN NOW(3) - INTERVAL 1 DAY ELSE NULL END,
  @actor_id,
  @actor_id,
  JSON_OBJECT('demo_seed', @demo_seed, 'sample_number', numbers.n),
  NOW(3) - INTERVAL (numbers.n * 3) DAY,
  NOW(3) - INTERVAL numbers.n DAY
FROM demo_numbers numbers
INNER JOIN field_agents agent
  ON JSON_UNQUOTE(JSON_EXTRACT(agent.metadata, '$.demo_seed')) = @demo_seed
 AND agent.name = CASE MOD(numbers.n, 4)
   WHEN 0 THEN 'Diego Alves'
   WHEN 1 THEN 'Ana Souza'
   WHEN 2 THEN 'Bruno Lima'
   ELSE 'Carla Mendes'
 END
WHERE numbers.n <= 6;

INSERT INTO expenses (
  organization_id, project_id, field_agent_id, description, reason,
  expense_date, amount, status, approved_by_id, approved_at,
  rejected_by_id, rejected_at, paid_by_id, paid_at,
  created_by_id, updated_by_id, metadata, created_at, updated_at
)
SELECT
  @organization_id,
  @project_id,
  agent.id,
  CASE MOD(numbers.n, 4)
    WHEN 0 THEN 'Hospedagem'
    WHEN 1 THEN 'Combustível'
    WHEN 2 THEN 'Alimentação'
    ELSE 'Pedágio e estacionamento'
  END,
  'Despesa operacional da equipe de inventário',
  CURRENT_DATE - INTERVAL numbers.n DAY,
  ROUND(75 + numbers.n * 48.90, 2),
  CASE
    WHEN numbers.n <= 2 THEN 'paid'
    WHEN numbers.n <= 4 THEN 'approved'
    WHEN numbers.n <= 6 THEN 'pending'
    WHEN numbers.n = 7 THEN 'rejected'
    ELSE 'cancelled'
  END,
  CASE WHEN numbers.n <= 4 THEN @actor_id ELSE NULL END,
  CASE WHEN numbers.n <= 4 THEN NOW(3) - INTERVAL 2 DAY ELSE NULL END,
  CASE WHEN numbers.n = 7 THEN @actor_id ELSE NULL END,
  CASE WHEN numbers.n = 7 THEN NOW(3) - INTERVAL 1 DAY ELSE NULL END,
  CASE WHEN numbers.n <= 2 THEN @actor_id ELSE NULL END,
  CASE WHEN numbers.n <= 2 THEN NOW(3) - INTERVAL 1 DAY ELSE NULL END,
  @actor_id,
  @actor_id,
  JSON_OBJECT('demo_seed', @demo_seed, 'sample_number', numbers.n),
  NOW(3) - INTERVAL (numbers.n + 5) DAY,
  NOW(3) - INTERVAL MOD(numbers.n, 3) DAY
FROM demo_numbers numbers
INNER JOIN field_agents agent
  ON JSON_UNQUOTE(JSON_EXTRACT(agent.metadata, '$.demo_seed')) = @demo_seed
 AND agent.name = CASE MOD(numbers.n, 4)
   WHEN 0 THEN 'Diego Alves'
   WHEN 1 THEN 'Ana Souza'
   WHEN 2 THEN 'Bruno Lima'
   ELSE 'Carla Mendes'
 END
WHERE numbers.n <= 8;

-- Import/export history for project summary screens.
INSERT INTO import_sessions (
  organization_id, project_id, type, source, status, session_uuid,
  expected_payloads, received_payloads, processed_payloads, failed_payloads,
  total_items, total_images, total_created, total_updated, total_deleted,
  total_failed, created_by_id, started_at, finished_at, expires_at,
  error_message, metadata, created_at, updated_at
) VALUES
  (@organization_id, @project_id, 'inventory', 'mobile', 'finished',
   'demo-project-test-import-001', 10, 10, 10, 0, 18, 12, 18, 0, 0, 0,
   @actor_id, NOW(3) - INTERVAL 20 DAY, NOW(3) - INTERVAL 20 DAY,
   NOW(3) + INTERVAL 10 DAY, NULL, JSON_OBJECT('demo_seed', @demo_seed),
   NOW(3) - INTERVAL 20 DAY, NOW(3) - INTERVAL 20 DAY),
  (@organization_id, @project_id, 'inventory', 'mobile', 'finished',
   'demo-project-test-import-002', 8, 8, 8, 1, 16, 9, 13, 3, 0, 1,
   @actor_id, NOW(3) - INTERVAL 10 DAY, NOW(3) - INTERVAL 10 DAY,
   NOW(3) + INTERVAL 20 DAY, NULL, JSON_OBJECT('demo_seed', @demo_seed),
   NOW(3) - INTERVAL 10 DAY, NOW(3) - INTERVAL 10 DAY),
  (@organization_id, @project_id, 'inventory', 'api', 'processing',
   'demo-project-test-import-003', 6, 6, 4, 0, 11, 3, 8, 2, 0, 0,
   @actor_id, NOW(3) - INTERVAL 1 DAY, NULL,
   NOW(3) + INTERVAL 29 DAY, NULL, JSON_OBJECT('demo_seed', @demo_seed),
   NOW(3) - INTERVAL 1 DAY, NOW(3)),
  (@organization_id, @project_id, 'inventory', 'file', 'failed',
   'demo-project-test-import-004', 4, 4, 2, 2, 7, 0, 2, 0, 0, 5,
   @actor_id, NOW(3) - INTERVAL 5 DAY, NOW(3) - INTERVAL 5 DAY,
   NOW(3) + INTERVAL 25 DAY, 'Arquivo com registros inválidos',
   JSON_OBJECT('demo_seed', @demo_seed),
   NOW(3) - INTERVAL 5 DAY, NOW(3) - INTERVAL 5 DAY),
  (@organization_id, @project_id, 'inventory', 'file', 'open',
   'demo-project-test-import-005', 5, 0, 0, 0, 0, 0, 0, 0, 0, 0,
   @actor_id, NULL, NULL, NOW(3) + INTERVAL 30 DAY, NULL,
   JSON_OBJECT('demo_seed', @demo_seed), NOW(3), NOW(3));

INSERT INTO export_jobs (
  organization_id, project_id, type, status, file_name, mime_type,
  size_bytes, checksum, requested_by_id, attempt_count, requested_at,
  started_at, finished_at, expires_at, error_code, error_message,
  created_at, updated_at
) VALUES
  (@organization_id, @project_id, 'inventory', 'finished',
   'demo-project-test-inventario.xlsx',
   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
   18240, REPEAT('a', 64), @actor_id, 1,
   NOW(3) - INTERVAL 8 DAY, NOW(3) - INTERVAL 8 DAY,
   NOW(3) - INTERVAL 8 DAY, NOW(3) + INTERVAL 22 DAY,
   NULL, NULL, NOW(3) - INTERVAL 8 DAY, NOW(3) - INTERVAL 8 DAY),
  (@organization_id, @project_id, 'accounting', 'finished',
   'demo-project-test-contabil.xlsx',
   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
   12680, REPEAT('b', 64), @actor_id, 1,
   NOW(3) - INTERVAL 4 DAY, NOW(3) - INTERVAL 4 DAY,
   NOW(3) - INTERVAL 4 DAY, NOW(3) + INTERVAL 26 DAY,
   NULL, NULL, NOW(3) - INTERVAL 4 DAY, NOW(3) - INTERVAL 4 DAY),
  (@organization_id, @project_id, 'pending_issues', 'processing',
   'demo-project-test-pendencias.xlsx', NULL, NULL, NULL, @actor_id, 1,
   NOW(3) - INTERVAL 1 HOUR, NOW(3) - INTERVAL 1 HOUR,
   NULL, NULL, NULL, NULL, NOW(3) - INTERVAL 1 HOUR, NOW(3)),
  (@organization_id, @project_id, 'inventory', 'failed',
   'demo-project-test-falha.xlsx', NULL, NULL, NULL, @actor_id, 1,
   NOW(3) - INTERVAL 2 DAY, NOW(3) - INTERVAL 2 DAY,
   NOW(3) - INTERVAL 2 DAY, NULL, 'DEMO_EXPORT_ERROR',
   'Falha simulada para validar o fluxo de nova tentativa.',
   NOW(3) - INTERVAL 2 DAY, NOW(3) - INTERVAL 2 DAY);

-- Make the populated project ready for normal workflow exploration.
UPDATE projects
SET status = 'active',
    updated_at = NOW(3)
WHERE id = @project_id
  AND status = 'draft';

DROP TEMPORARY TABLE demo_numbers;
COMMIT;

SELECT
  @project_id AS project_id,
  (SELECT COUNT(*) FROM company_units
   WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.demo_seed')) = @demo_seed) AS units,
  (SELECT COUNT(*) FROM field_agents
   WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.demo_seed')) = @demo_seed) AS field_agents,
  (SELECT COUNT(*) FROM inventory_items
   WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.demo_seed')) = @demo_seed) AS inventory_items,
  (SELECT COUNT(*) FROM inventory_accounting_items
   WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.demo_seed')) = @demo_seed) AS accounting_items,
  (SELECT COUNT(*) FROM inventory_pending_issues
   WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.demo_seed')) = @demo_seed) AS pending_issues,
  (SELECT COUNT(*) FROM field_agent_payments
   WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.demo_seed')) = @demo_seed) AS payments,
  (SELECT COUNT(*) FROM expenses
   WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.demo_seed')) = @demo_seed) AS expenses,
  (SELECT COUNT(*) FROM import_sessions
   WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.demo_seed')) = @demo_seed) AS imports,
  (SELECT COUNT(*) FROM export_jobs
   WHERE project_id = @project_id
     AND file_name LIKE 'demo-project-test-%') AS exports;

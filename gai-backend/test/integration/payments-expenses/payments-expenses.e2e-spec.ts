import { STORAGE_SIGNER } from '../../../src/common/storage/storage-signer.port';
import { FakeStorage, TEST_OBJECT_CHECKSUM } from '../storage.fake';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  loginAsOrgUser,
  seedTestData,
} from '../test-app.helper';

interface IdBody {
  id: number;
}
interface PaymentBody {
  id: number;
  status: string;
  daily_total: string;
  final_amount: string;
}
interface PaymentListBody {
  items: PaymentBody[];
  total_items: number;
}
interface ExpenseBody {
  id: number;
  status: string;
  amount: string;
}
interface ExpenseListBody {
  items: ExpenseBody[];
  total_items: number;
}
interface UploadBody {
  attachment: { id: number; status: string };
  upload_url: string;
}

describe('Payments & Expenses (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeEach(async () => {
    app = await createTestApp();
    await seedTestData(app);
    token = await loginAsOrgUser(app);
  });

  afterEach(async () => {
    await app.close();
  });

  async function createProjectAndAgent() {
    const project = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        organization_id: 1,
        company_id: 1,
        name: 'Financeiro inventario',
      })
      .expect(201);
    const projectBody = project.body as IdBody;

    const agent = await request(app.getHttpServer())
      .post('/api/v1/field-agents')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Pagador Teste' })
      .expect(201);
    const agentBody = agent.body as IdBody;

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectBody.id}/field-agents`)
      .set('Authorization', `Bearer ${token}`)
      .send({ field_agent_id: agentBody.id, role: 'collector' })
      .expect(201);

    return { projectId: projectBody.id, fieldAgentId: agentBody.id };
  }

  it('creates payment, marks paid, creates expense and handles attachment URLs', async () => {
    const { projectId, fieldAgentId } = await createProjectAndAgent();

    const paymentResponse = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        field_agent_id: fieldAgentId,
        state: 'SP',
        start_date: '2026-07-01',
        end_date: '2026-07-03',
        expected_payment_date: '2026-07-10',
        daily_rate: '100.00',
        additional_amount: '50.00',
        discount_amount: '20.00',
      })
      .expect(201);
    const payment = paymentResponse.body as PaymentBody;
    expect(payment.daily_total).toBe('300.00');
    // Etapa 2 da paridade: total = dias × diária + adicional; final = total − descontos.
    expect((payment as unknown as { total_amount: string }).total_amount).toBe(
      '350.00',
    );
    expect(payment.final_amount).toBe('330.00');

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/payments/${payment.id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/payments/${payment.id}/mark-as-paid`)
      .set('Authorization', `Bearer ${token}`)
      .send({ payment_date: '2026-07-04' })
      .expect(200)
      .expect((response) => {
        const body = response.body as PaymentBody;
        expect(body.status).toBe('paid');
      });

    const expenseResponse = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/expenses`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        field_agent_id: fieldAgentId,
        description: 'Taxi',
        reason: 'Deslocamento',
        expense_date: '2026-07-02',
        amount: '25.50',
      })
      .expect(201);
    const expense = expenseResponse.body as ExpenseBody;
    expect(expense.amount).toBe('25.50');

    const uploadResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${projectId}/expenses/${expense.id}/attachments/upload-url`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({
        original_name: 'nota.pdf',
        mime_type: 'application/pdf',
        size_bytes: 123,
      })
      .expect(201);
    const upload = uploadResponse.body as UploadBody;
    app.get<FakeStorage>(STORAGE_SIGNER).put(upload.upload_url);
    expect(upload.upload_url).toContain('X-Amz-Signature');

    await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${projectId}/expenses/${expense.id}/attachments/${upload.attachment.id}/confirm-upload`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ checksum: TEST_OBJECT_CHECKSUM, size_bytes: 123 })
      .expect(200)
      .expect((response) => {
        const body = response.body as { status: string };
        expect(body.status).toBe('uploaded');
      });

    await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${projectId}/expenses/${expense.id}/attachments/${upload.attachment.id}/download-url`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const allPayments = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect((allPayments.body as PaymentListBody).total_items).toBe(1);

    const filteredPaymentsByPeriod = await request(app.getHttpServer())
      .get(
        `/api/v1/projects/${projectId}/payments?start_date=2026-07-01&end_date=2026-07-03`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect((filteredPaymentsByPeriod.body as PaymentListBody).total_items).toBe(
      1,
    );

    const filteredPayments = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/payments?payment_date=2026-07-04`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const paymentList = filteredPayments.body as PaymentListBody;
    expect(paymentList.total_items).toBe(1);
    expect(paymentList.items[0].id).toBe(payment.id);

    const filteredExpenses = await request(app.getHttpServer())
      .get(
        `/api/v1/projects/${projectId}/expenses?start_date=2026-07-02&end_date=2026-07-02`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const expenseList = filteredExpenses.body as ExpenseListBody;
    expect(expenseList.total_items).toBe(1);
    expect(expenseList.items[0].id).toBe(expense.id);
  });

  it('conta só dias de segunda a sexta e recusa períodos sobrepostos do mesmo inventariante', async () => {
    const { projectId, fieldAgentId } = await createProjectAndAgent();
    const post = (start: string, end: string) =>
      request(app.getHttpServer())
        .post(`/api/v1/projects/${projectId}/payments`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          field_agent_id: fieldAgentId,
          start_date: start,
          end_date: end,
          expected_payment_date: '2026-07-20',
          daily_rate: '100.00',
        });
    // 01/07/2026 (quarta) a 14/07/2026 (terça): 14 dias corridos, 10 úteis.
    const first = await post('2026-07-01', '2026-07-14').expect(201);
    expect((first.body as { days: number }).days).toBe(10);
    expect((first.body as PaymentBody).final_amount).toBe('1000.00');

    // cruza 10–14/07: recusado
    const overlap = await post('2026-07-10', '2026-07-20').expect(409);
    expect((overlap.body as { message: string }).message).toContain(
      '01/07/2026 a 14/07/2026',
    );
    // logo depois: aceito
    const second = await post('2026-07-15', '2026-07-31').expect(201);

    // editar o segundo para cruzar o primeiro: recusado
    await request(app.getHttpServer())
      .patch(
        `/api/v1/projects/${projectId}/payments/${(second.body as IdBody).id}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({
        field_agent_id: fieldAgentId,
        start_date: '2026-07-14',
        end_date: '2026-07-31',
        expected_payment_date: '2026-07-20',
        daily_rate: '100.00',
      })
      .expect(409);

    // cancelado não bloqueia: cancela o primeiro e lança de novo no mesmo período
    await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${projectId}/payments/${(first.body as IdBody).id}/cancel`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await post('2026-07-01', '2026-07-14').expect(201);

    // período só de fim de semana: 0 dias
    const weekend = await post('2026-06-27', '2026-06-28').expect(201);
    expect((weekend.body as { days: number }).days).toBe(0);
  });

  it('resumo do dia: planilha dos pagamentos em aberto previstos para a data', async () => {
    const { projectId, fieldAgentId } = await createProjectAndAgent();
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        field_agent_id: fieldAgentId,
        start_date: '2026-07-01',
        end_date: '2026-07-03',
        expected_payment_date: '2026-07-10',
        daily_rate: '100.00',
      })
      .expect(201);
    const response = await request(app.getHttpServer())
      .get('/api/v1/field-agent-payments/day-summary?date=2026-07-10')
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(response.headers['content-disposition']).toContain(
      'pagamentos-previstos-2026-07-10.xlsx',
    );
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx') as typeof import('xlsx');
    const book = XLSX.read(response.body as Buffer, { type: 'buffer' });
    expect(book.SheetNames).toEqual(['Por inventariante', 'Lançamentos']);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(
      book.Sheets['Por inventariante'],
      { header: 1 },
    );
    expect(rows[0]).toEqual(['Pagamentos previstos para 10/07/2026']);
    expect(rows[3]).toEqual([
      'Pagador Teste',
      '',
      'Financeiro inventario',
      1,
      300,
    ]);

    await request(app.getHttpServer())
      .get('/api/v1/field-agent-payments/day-summary?date=10-07-2026')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });
});

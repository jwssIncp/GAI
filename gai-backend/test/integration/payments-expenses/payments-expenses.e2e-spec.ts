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
      .send({ organization_id: 1, name: 'Pagador Teste' })
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
        daily_rate: '100.00',
        additional_amount: '50.00',
        discount_amount: '20.00',
      })
      .expect(201);
    const payment = paymentResponse.body as PaymentBody;
    expect(payment.daily_total).toBe('300.00');
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
    expect(upload.upload_url).toContain('X-GAI-Signature');

    await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${projectId}/expenses/${expense.id}/attachments/${upload.attachment.id}/confirm-upload`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ checksum: 'abc', size_bytes: 123 })
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
});

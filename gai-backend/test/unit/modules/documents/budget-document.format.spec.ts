import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { calculateBudget } from '../../../../src/modules/budgets/budget.policy';
import type {
  BudgetSnapshot,
  BudgetVersionEntity,
} from '../../../../src/modules/budgets/budget.entity';
import { budgetDocument } from '../../../../src/modules/documents/document.builder';
import { documentMoney } from '../../../../src/modules/documents/document.format';
import { renderDocument } from '../../../../src/modules/documents/document.render';
import { DEFAULT_VISUAL } from '../../../../src/modules/documents/document.contract';
import { testBudget, testPricing } from '../budgets/budget.fixtures';

/**
 * Gera a proposta com memória de cálculo (PDF e DOCX, pelos mesmos builder e
 * renderizador do worker) e confere os formatos pt-BR nos arquivos gerados.
 */
describe('Proposta comercial gerada: formatos pt-BR no PDF e no DOCX', () => {
  const input = testBudget({ estimated_assets: 1000 });
  const pricing = testPricing({
    daily_rate: '1234.56',
    tax_pct: '10.00',
    commission_pct: '5.00',
    margin_pct: '15.00',
    address_factor: '1.0000',
  });
  const calculation = calculateBudget(input, pricing, input.addresses.length);
  const snapshot: BudgetSnapshot = {
    visual_template: { ...DEFAULT_VISUAL },
    input,
    pricing: {
      id: 1,
      name: pricing.name,
      version: 1,
      valid_from: pricing.valid_from,
      valid_to: pricing.valid_to,
      values: pricing,
    },
    context: {
      company: { id: 1, name: 'SINTETICO Empresa', address: null },
      project: null,
      units: [],
      responsible: { id: 2, login: 'sintetico' },
    },
    calculation,
  };
  const version = {
    id: 7,
    version: 3,
    hash: 'b'.repeat(64),
    recordedAt: new Date('2026-10-28T12:00:00Z'),
    snapshot,
  } as unknown as BudgetVersionEntity;
  const model = budgetDocument(version, false, true, true);
  const money = (v: string) => documentMoney(v, 'BRL');

  // Valores que precisam aparecer formatados nos dois arquivos.
  const expected = [
    'R$ 1.234,56', // valor unitário com milhar (diária técnica)
    money(calculation.final_price), // preço total exato
    money(calculation.cost_total),
    '10,00%',
    '5,00%',
    '15,00%',
    '1,0000', // fator com as casas do dado
    '1.000 bens', // inteiro com milhar
    '27/10/2026', // data civil
  ];
  // Formatos antigos que não podem sobrar.
  const forbidden = [/\d\.\d{2}%/, /\b1\.0000\b/, /BRL /, /\d+\.\d{2}(?!\d)/];

  it('o preço total e a memória de cálculo saem com os valores esperados', () => {
    expect(money(calculation.final_price)).toMatch(
      /^R\$ \d{1,3}(\.\d{3})*,\d{2}$/,
    );
    expect(calculation.lines.find((l) => l.key === 'tags')?.quantity).toBe(
      1000,
    );
    const text = JSON.stringify(model);
    for (const value of expected) expect(text).toContain(value);
    expect(text).toContain('"1.000"'); // quantidade da linha de plaquetas
  });

  it('DOCX: o XML do documento traz moeda, percentual, fator, milhar e datas pt-BR', async () => {
    const zip = unzipSync(await renderDocument(model, 'docx'));
    const xml = strFromU8(zip['word/document.xml']);
    // Só o texto visível (sem atributos do OOXML, que têm números próprios).
    const text = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)]
      .map((m) => m[1])
      .join('\n');
    for (const value of expected) expect(text).toContain(value);
    expect(text).toContain('Preço total: ' + money(calculation.final_price));
    expect(text).toMatch(/^1\.000$/m); // célula de quantidade
    for (const pattern of forbidden) expect(text).not.toMatch(pattern);
  });

  it('PDF: o texto extraído do arquivo traz os mesmos formatos', async () => {
    const pdf = await renderDocument(model, 'pdf');
    const dir = mkdtempSync(join(tmpdir(), 'gai-pdf-'));
    try {
      const file = join(dir, 'proposta.pdf');
      writeFileSync(file, pdf);
      const raw = execFileSync(
        process.execPath,
        [resolve(__dirname, '../../../fixtures/pdf-text.mjs'), file],
        { encoding: 'utf8' },
      );
      // Espaços repetidos (ou não separáveis) entre trechos do pdf.js viram um.
      const text = raw.replace(/[^\S\n]+/g, ' ');
      for (const value of expected) expect(text).toContain(value);
      expect(text).toContain('Preço total: ' + money(calculation.final_price));
      for (const pattern of forbidden) expect(text).not.toMatch(pattern);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

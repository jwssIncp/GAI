import { describe, expect, it } from "vitest";
import { weekdaysInclusive, type RemunerationItem } from "./remunerationApi";
import { groupByAgent, nextWeekday } from "./remunerationGroups";

let id = 1;
const item = (over: Partial<RemunerationItem>): RemunerationItem => ({
  id: id++,
  field_agent_id: 1,
  field_agent_name: "Ana",
  state: "SP",
  start_date: "2026-07-01",
  end_date: "2026-07-14",
  expected_payment_date: "2026-07-15",
  payment_date: null,
  days: 10,
  daily_rate: "185.00",
  additional_amount: "0.00",
  daily_total: "1850.00",
  total_amount: "1850.00",
  total_manual: false,
  discount_amount: "0.00",
  final_amount: "1850.00",
  status: "pending",
  notes: null,
  reopened_at: null,
  updated_at: "2026-07-01T00:00:00Z",
  ...over,
});

describe("Remuneração: dias úteis", () => {
  it("conta só de segunda a sexta, com os dois extremos", () => {
    expect(weekdaysInclusive("2026-11-03", "2026-11-07")).toBe(4); // ter–sáb
    expect(weekdaysInclusive("2026-11-07", "2026-11-08")).toBe(0); // sáb–dom
    expect(weekdaysInclusive("2026-05-25", "2026-06-05")).toBe(10);
    expect(weekdaysInclusive("2026-11-07", "2026-11-03")).toBe(0);
    expect(weekdaysInclusive("", "2026-11-03")).toBe(0);
  });

  it("próximo dia útil pula o fim de semana", () => {
    expect(nextWeekday("2026-07-14")).toBe("2026-07-15"); // ter → qua
    expect(nextWeekday("2026-07-17")).toBe("2026-07-20"); // sex → seg
    expect(nextWeekday("2026-07-18")).toBe("2026-07-20"); // sáb → seg
  });
});

describe("Remuneração: agrupamento por inventariante", () => {
  it("histórico, início do trabalho, último pagamento e saldos (cancelados fora)", () => {
    const groups = groupByAgent([
      item({ start_date: "2026-07-15", end_date: "2026-07-31", final_amount: "2405.00", daily_rate: "200.00" }),
      item({ status: "paid", payment_date: "2026-07-16", final_amount: "1850.00" }),
      item({ start_date: "2026-08-03", end_date: "2026-08-07", status: "cancelled", final_amount: "925.00" }),
      item({ field_agent_id: 2, field_agent_name: "Bruno", state: "RJ", status: "approved", final_amount: "100.00" }),
    ]);
    expect(groups.map((g) => g.name)).toEqual(["Ana", "Bruno"]);
    const ana = groups[0];
    expect(ana.items.map((i) => i.start_date)).toEqual(["2026-07-01", "2026-07-15", "2026-08-03"]);
    expect(ana).toMatchObject({
      active: 2,
      first_start: "2026-07-01",
      last_end: "2026-07-31",
      last_payment: "2026-07-16",
      last_daily_rate: "200.00",
      next_start: "2026-08-03",
      final_amount: "4255.00",
      paid_amount: "1850.00",
      open_amount: "2405.00",
    });
    expect(groups[1]).toMatchObject({ open_amount: "100.00", paid_amount: "0.00", last_payment: null });
  });
});

import {
  AxiosError,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from "axios";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "./http";
import { readStoredSession, writeStoredSession } from "./session-storage";
import type { CurrentUser } from "@/types/api";

const original = api.defaults.adapter;
const user = {
  id: 10,
  login: "fixture",
  email: "fixture@example.test",
  status: "ACTIVE",
  organization_id: 1,
  role_assignments: [],
} as CurrentUser;
const store = (token: string) =>
  writeStoredSession({
    accessToken: token,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    user,
  });
const unauthorized = (config: InternalAxiosRequestConfig) =>
  new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, undefined, {
    status: 401,
    statusText: "Unauthorized",
    headers: {},
    config,
    data: { code: "UNAUTHORIZED" },
  });
afterEach(() => {
  api.defaults.adapter = original;
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});
it("does not clear a new session when an old authorized request returns 401", async () => {
  store("old-fixture-token");
  let reject!: (error: AxiosError) => void;
  let requestConfig!: InternalAxiosRequestConfig;
  api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
    requestConfig = config;
    return new Promise((_resolve, fail) => {
      reject = fail;
    });
  }) as AxiosAdapter;
  const pending = api.get("/auth/me");
  await vi.waitFor(() => expect(requestConfig).toBeDefined());
  store("new-fixture-token");
  const event = vi.spyOn(window, "dispatchEvent");
  reject(unauthorized(requestConfig));
  await expect(pending).rejects.toMatchObject({ status: 401 });
  expect(readStoredSession()?.accessToken).toBe("new-fixture-token");
  expect(event).not.toHaveBeenCalled();
});
it("still clears and signals an expired current session", async () => {
  store("current-fixture-token");
  api.defaults.adapter = ((config) =>
    Promise.reject(unauthorized(config))) as AxiosAdapter;
  const event = vi.spyOn(window, "dispatchEvent");
  await expect(api.get("/auth/me")).rejects.toMatchObject({ status: 401 });
  expect(readStoredSession()).toBeNull();
  expect(event).toHaveBeenCalledWith(
    expect.objectContaining({ type: "gai:session-expired" }),
  );
});

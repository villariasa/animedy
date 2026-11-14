import { describe, expect, test } from "vitest";
import { seasonal } from "./seasonal.svelte";

describe("seasonal holiday store", () => {
  test("enabled by default for all visitors", () => {
    seasonal.setAdminEnabled(true);
    expect(seasonal.enabled).toBe(true);
    expect(seasonal.isActive).toBe(true);
  });

  test("admin can disable and re-enable site-wide holiday theme", () => {
    seasonal.setAdminEnabled(false);
    expect(seasonal.enabled).toBe(false);
    expect(seasonal.isActive).toBe(false);

    seasonal.setAdminEnabled(true);
    expect(seasonal.enabled).toBe(true);
    expect(seasonal.isActive).toBe(true);
  });
});

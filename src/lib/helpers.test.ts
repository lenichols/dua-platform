import { beforeAll, describe, expect, it } from "vitest";
import {
  generateAdminPassword,
  hashAdminPassword,
  verifyAdminPassword,
} from "./admin-password";
import { canManageTeam, canWrite } from "./admin-roles";
import { shuffleForUser } from "./shuffle";
import { editToken, editUrl, verifyEditToken } from "./submission-edit";
import { unsubscribeToken, unsubscribeUrl, verifyUnsubscribeToken } from "./unsubscribe";
import { safeHref } from "./url";

beforeAll(() => {
  process.env.SUBMISSION_EDIT_SECRET = "test-secret-not-used-anywhere-real";
});

describe("admin roles", () => {
  it("lets owners and admins write, and viewers only read", () => {
    expect(canWrite("owner")).toBe(true);
    expect(canWrite("admin")).toBe(true);
    expect(canWrite("viewer")).toBe(false);
  });

  it("lets only owners manage the team", () => {
    expect(canManageTeam("owner")).toBe(true);
    expect(canManageTeam("admin")).toBe(false);
    expect(canManageTeam("viewer")).toBe(false);
  });
});

describe("admin passwords", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const hash = await hashAdminPassword("correct horse battery");
    expect(await verifyAdminPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyAdminPassword("correct horse batterx", hash)).toBe(false);
  });

  it("salts: the same password hashes differently each time", async () => {
    expect(await hashAdminPassword("same")).not.toBe(await hashAdminPassword("same"));
  });

  it("rejects missing or malformed stored hashes", async () => {
    expect(await verifyAdminPassword("x", null)).toBe(false);
    expect(await verifyAdminPassword("x", "")).toBe(false);
    expect(await verifyAdminPassword("x", "plaintext")).toBe(false);
    expect(await verifyAdminPassword("x", "scrypt$00$00")).toBe(false);
  });

  it("generates readable passwords without look-alike characters", () => {
    const p = generateAdminPassword();
    expect(p).toMatch(/^[a-zA-Z2-9]{4}(-[a-zA-Z2-9]{4}){3}$/);
    expect(p).not.toMatch(/[Il1O0]/);
    expect(generateAdminPassword()).not.toBe(p);
  });
});

describe("signed links", () => {
  it("accepts its own edit token and rejects others", () => {
    const t = editToken("sub-1");
    expect(verifyEditToken("sub-1", t)).toBe(true);
    expect(verifyEditToken("sub-2", t)).toBe(false);
    expect(verifyEditToken("sub-1", "")).toBe(false);
    expect(verifyEditToken("sub-1", "not-hex")).toBe(false);
  });

  it("accepts its own unsubscribe token and rejects others", () => {
    const t = unsubscribeToken("reg-1");
    expect(verifyUnsubscribeToken("reg-1", t)).toBe(true);
    expect(verifyUnsubscribeToken("reg-2", t)).toBe(false);
    expect(verifyUnsubscribeToken("reg-1", "abcd")).toBe(false);
  });

  it("can't reuse an edit token as an unsubscribe token for the same id", () => {
    expect(verifyUnsubscribeToken("same-id", editToken("same-id"))).toBe(false);
  });

  it("builds links that carry the id and token", () => {
    const e = new URL(editUrl("https://example.org", "sub-1"));
    expect(e.pathname).toBe("/submit/edit");
    expect(verifyEditToken(e.searchParams.get("id")!, e.searchParams.get("t")!)).toBe(true);

    const u = new URL(unsubscribeUrl("https://example.org", "reg-1"));
    expect(u.pathname).toBe("/unsubscribe");
    expect(verifyUnsubscribeToken(u.searchParams.get("id")!, u.searchParams.get("t")!)).toBe(true);
  });
});

describe("safeHref", () => {
  it("keeps http, https and mailto links", () => {
    expect(safeHref("https://example.org/a")).toBe("https://example.org/a");
    expect(safeHref("http://example.org")).toBe("http://example.org");
    expect(safeHref("mailto:a@example.org")).toBe("mailto:a@example.org");
  });

  it("adds https to a bare domain", () => {
    expect(safeHref("example.org/demo")).toBe("https://example.org/demo");
    expect(safeHref("  example.org  ")).toBe("https://example.org");
  });

  it("refuses script and file links", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("JAVASCRIPT:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,x")).toBeNull();
    expect(safeHref("file:///etc/passwd")).toBeNull();
  });

  it("treats blanks and placeholders as no link", () => {
    for (const v of [null, undefined, "", "   ", "-", "#", "n/a", "None"]) {
      expect(safeHref(v)).toBeNull();
    }
  });
});

describe("shuffleForUser", () => {
  const items = Array.from({ length: 20 }, (_, i) => `item-${i}`);
  const key = (s: string) => s;

  it("gives one judge the same order every time", () => {
    expect(shuffleForUser(items, "judge-a", key)).toEqual(shuffleForUser(items, "judge-a", key));
  });

  it("gives different judges different orders", () => {
    expect(shuffleForUser(items, "judge-a", key)).not.toEqual(
      shuffleForUser(items, "judge-b", key),
    );
  });

  it("keeps every item exactly once and leaves the input alone", () => {
    const copy = [...items];
    expect([...shuffleForUser(items, "judge-a", key)].sort()).toEqual([...items].sort());
    expect(items).toEqual(copy);
  });
});

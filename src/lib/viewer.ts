import { getAdminSession } from "@/app/admin/auth";
import { getJudgeSession } from "@/app/judge/auth";
import { PUBLIC, type Viewer } from "@/server/policy";

/**
 * Who is making this request, for the permission rules in
 * src/server/policy.ts. A judge session wins over an admin one, so an
 * organizer who is also on the roster judges as a judge.
 */
export async function getViewer(): Promise<Viewer> {
  const judge = await getJudgeSession();
  if (judge) return { kind: "judge", judgeId: judge.id, role: judge.role };
  const admin = await getAdminSession();
  if (admin) return { kind: "admin", role: admin.role };
  return PUBLIC;
}

import { getUpload } from "@/server/uploads";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Serves a public upload, such as an image used in a campaign email. The id
// may carry a file extension so mail clients treat the link as an image.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = (await ctx.params).id.replace(/\.[a-z]+$/i, "");
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });
  const file = await getUpload(id);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.contentType,
      // The id is unique per upload, so the file never changes underneath a
      // message that already went out.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

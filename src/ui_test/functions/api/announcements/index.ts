import type { PagesFunction } from "../_lib/types";

export interface AnnouncementRow {
  id: number;
  admin_id: number;
  title: string;
  body: string;
  created_at: string;
}

/**
 * Public feed of recent system announcements for in-app notification bell.
 */
export const onRequestGet: PagesFunction = async (context) => {
  const rows = await context.env.DB.prepare(
    `SELECT id, admin_id, title, body, created_at
     FROM announcements
     ORDER BY id DESC
     LIMIT 50`
  ).all<AnnouncementRow>();

  return Response.json(
    {
      success: true,
      http_code: 200,
      message: "Recent announcements",
      data: { announcements: rows.results },
    },
    {
      status: 200,
      headers: { "Cache-Control": "public, max-age=10, s-maxage=10" },
    }
  );
};

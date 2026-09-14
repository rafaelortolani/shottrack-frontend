import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("shottrack_access");
  response.cookies.delete("shottrack_refresh");
  return response;
}

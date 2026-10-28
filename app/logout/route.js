import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req) {
  cookies().delete("tca_session");
  return NextResponse.redirect(new URL("/login", process.env.APP_URL || req.nextUrl.origin), 303);
}

import { NextResponse } from "next/server";
import { handleSignalsStatusGet } from "@/app/api/signals/route";

function withCors(response: NextResponse): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, X-Protocol-Version");
  return response;
}

export async function GET() {
  const result = handleSignalsStatusGet();
  return withCors(NextResponse.json(result.body, { status: result.status }));
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

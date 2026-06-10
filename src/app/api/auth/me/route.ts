import { NextResponse } from "next/server";
import { getCurrentOperator } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const operator = await getCurrentOperator();
  if (!operator) {
    return NextResponse.json({ operator: null }, { status: 401 });
  }
  return NextResponse.json({ operator });
}

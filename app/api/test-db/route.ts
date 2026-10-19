
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET() {
  const started = Date.now();

  try {
    const { data, error } = await supabaseServer
      .from("products")
      .select("id, name")
      .limit(1);

    if (error) {
      console.error("Supabase test query failed:", error.message);

      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      productCount: data.length,
      elapsedMs: Date.now() - started,
    });
  } catch (err) {
    console.error("Supabase test connection failed:", err);

    return NextResponse.json(
      { ok: false, error: "Connection failed. Check server terminal." },
      { status: 500 }
    );
  }
}

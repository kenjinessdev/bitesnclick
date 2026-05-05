"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

async function getVerifiedAdminId() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    return payload.adminId as string;
  } catch {
    return null;
  }
}

export async function getAdminProfile() {
  const adminId = await getVerifiedAdminId();
  if (!adminId) throw new Error("Unauthorized");

  const supabase = createAdminClient(supabaseUrl, supabaseServiceRoleKey);

  const { data, error } = await supabase
    .from("admin")
    .select("name, username, password")
    .eq("adminid", adminId)
    .single();

  if (error || !data) throw new Error("Admin not found");

  return data;
}

export async function updateAdminProfile(
  name: string,
  username: string,
  hashedPassword?: string
) {
  const adminId = await getVerifiedAdminId();
  if (!adminId) throw new Error("Unauthorized");

  const supabase = createAdminClient(supabaseUrl, supabaseServiceRoleKey);

  const updatePayload: Record<string, string> = { name, username };
  if (hashedPassword) {
    updatePayload.password = hashedPassword;
  }

  const { error } = await supabase
    .from("admin")
    .update(updatePayload)
    .eq("adminid", adminId);

  if (error) throw new Error(error.message);

  return { success: true };
}

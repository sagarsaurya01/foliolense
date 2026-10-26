import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side client for server components, route handlers and server actions.
// Still the anon key: requests run as the signed-in user, so RLS applies.
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // called from a server component: middleware refreshes the session instead
          }
        },
      },
    },
  );
}

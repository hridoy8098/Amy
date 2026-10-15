import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default function Home() {
  // Deep-link entry: authenticated users go straight to the dashboard.
  const token = cookies().get("amy_token")?.value;
  redirect(token ? "/dashboard" : "/login");
}

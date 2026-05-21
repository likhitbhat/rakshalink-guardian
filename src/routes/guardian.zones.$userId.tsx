import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ZonesManager } from "@/components/ZonesManager";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/guardian/zones/$userId")({
  component: GuardianZonesPage,
});

function GuardianZonesPage() {
  const { userId } = Route.useParams();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => setName((data as any)?.full_name ?? null));
  }, [userId]);

  return (
    <div>
      <div className="px-5 pt-6">
        <Link to="/guardian" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-accent">
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </Link>
      </div>
      <ZonesManager
        targetUserId={userId}
        title={name ? `${name}'s safe zones` : "Safe zones"}
        subtitle="Manage low-power zones for this person."
      />
    </div>
  );
}

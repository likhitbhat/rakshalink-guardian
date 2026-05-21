import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { ZonesManager } from "@/components/ZonesManager";

export const Route = createFileRoute("/app/zones")({
  component: ZonesPage,
});

function ZonesPage() {
  const { user } = useAuth();
  return <ZonesManager targetUserId={user?.id} />;
}

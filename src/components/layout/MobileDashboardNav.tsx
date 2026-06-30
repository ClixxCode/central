'use client';

import { MobileNav } from './MobileNav';

interface Client {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string | null;
  defaultBoardId: string | null;
  boards: { id: string; name: string }[];
}

interface MobileDashboardNavProps {
  clients: Client[];
  isAdmin: boolean;
  isContractor?: boolean;
}

export function MobileDashboardNav({
  clients,
  isAdmin,
  isContractor = false,
}: MobileDashboardNavProps) {
  return <MobileNav clients={clients} isAdmin={isAdmin} isContractor={isContractor} />;
}

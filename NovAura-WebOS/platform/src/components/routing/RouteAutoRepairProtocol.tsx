import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getRouteRepair, reportRouteRepairEvent } from '@/services/routeRepairService';

export default function RouteAutoRepairProtocol() {
  const location = useLocation();
  const navigate = useNavigate();
  const lastRepairRef = useRef<string | null>(null);

  useEffect(() => {
    const repair = getRouteRepair(location.pathname);

    if (!repair.wasRepaired || repair.repairedPath === repair.normalizedPath) {
      lastRepairRef.current = null;
      return;
    }

    const repairKey = `${repair.normalizedPath}->${repair.repairedPath}`;
    if (lastRepairRef.current === repairKey) {
      return;
    }

    lastRepairRef.current = repairKey;

    void reportRouteRepairEvent({
      source: 'router-guard',
      fromPath: repair.normalizedPath,
      toPath: repair.repairedPath,
      reason: repair.rule?.reason,
      confidence: repair.rule?.confidence,
      search: location.search,
      hash: location.hash,
      timestamp: new Date().toISOString(),
    });

    navigate(`${repair.repairedPath}${location.search}${location.hash}`, {
      replace: true,
      state: {
        autoRepairedFrom: repair.normalizedPath,
      },
    });
  }, [location.hash, location.pathname, location.search, navigate]);

  return null;
}

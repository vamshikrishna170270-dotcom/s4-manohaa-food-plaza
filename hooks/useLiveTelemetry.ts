import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function useLiveTelemetry(startDate: string, endDate: string, bucket: 'hour' | 'day') {
  const [timeline, setTimeline] = useState<any[]>([]);
  const [kpis, setKpis] = useState({ revenue: 0, profit: 0, orders: 0 });
  const [isSyncing, setIsSyncing] = useState(true);

  const fetchTelemetry = async () => {
    setIsSyncing(true);
    // Ping the fast Postgres RPC instead of downloading the whole table
    const { data, error } = await supabase.rpc('get_analytical_timeseries', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_bucket: bucket
    });

    if (!error && data) {
      setTimeline(data);
      setKpis({
        revenue: data.reduce((acc: number, row: any) => acc + Number(row.gross_revenue), 0),
        profit: data.reduce((acc: number, row: any) => acc + Number(row.net_profit), 0),
        orders: data.reduce((acc: number, row: any) => acc + Number(row.total_volume), 0),
      });
    }
    setIsSyncing(false);
  };

  useEffect(() => {
    fetchTelemetry();

    // Subscribe to Live POS Changes on ledger_entries
    const channel = supabase.channel('live-ledger-entries')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ledger_entries' }, (payload) => {
        // Trigger a silent background refresh when the native app drops a new order
        fetchTelemetry();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [startDate, endDate, bucket]);

  return { timeline, kpis, isSyncing };
}
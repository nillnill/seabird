import { useEffect } from 'react';
import { supabase } from '../utils/supabaseClient.js';
import useStore from '../store/useStore.js';

export function useAgentReports() {
  const { addReport, setChokepointSeverity } = useStore.getState();

  useEffect(() => {
    // 초기 로드: 최근 24시간 보고 가져오기
    supabase
      .from('agent_reports')
      .select('*')
      .gte('created_at', new Date(Date.now() - 86400000).toISOString())
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) {
          data.reverse().forEach(addReport);
          // 초크포인트 severity 초기화
          data.forEach((r) => {
            if (r.agent_id === 'CHOKEPOINT_WATCHER' && r.location?.chokepoint_id) {
              setChokepointSeverity(r.location.chokepoint_id, r.severity);
            }
          });
        }
      });

    // Realtime 구독
    const channel = supabase
      .channel('agent-reports')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_reports' },
        (payload) => {
          addReport(payload.new);
          if (
            payload.new.agent_id === 'CHOKEPOINT_WATCHER' &&
            payload.new.location?.chokepoint_id
          ) {
            setChokepointSeverity(payload.new.location.chokepoint_id, payload.new.severity);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);
}

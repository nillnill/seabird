import { useEffect } from 'react';
import { supabase } from '../utils/supabaseClient.js';
import useStore from '../store/useStore.js';

export function useAgentReports() {
  const { addReport, setChokepointSeverity, setWeatherMarkers } = useStore.getState();

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
          // 최신 날씨 보고의 지점들로 지도 마커 초기화 (data는 reverse 후 오래된→최신)
          const latestWeather = [...data].reverse().find(
            (r) => r.agent_id === 'WEATHER_AGENT' && Array.isArray(r.raw_data?.points)
          );
          if (latestWeather) setWeatherMarkers(latestWeather.raw_data.points);
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
          if (
            payload.new.agent_id === 'WEATHER_AGENT' &&
            Array.isArray(payload.new.raw_data?.points)
          ) {
            setWeatherMarkers(payload.new.raw_data.points);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);
}

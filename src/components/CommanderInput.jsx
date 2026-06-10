import { useRef } from 'react';
import useStore from '../store/useStore.js';
import { routeCommand } from '../agents/orchestrator.js';

export default function CommanderInput() {
  const { commanderInput, isCommanderLoading, setCommanderInput, setCommanderLoading } = useStore();
  const inputRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    const text = commanderInput.trim();
    if (!text || isCommanderLoading) return;

    setCommanderLoading(true);
    try {
      await routeCommand(text);
      setCommanderInput('');
    } catch (err) {
      console.error('Commander error:', err);
    } finally {
      setCommanderLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-sea-border bg-sea-panel p-3"
    >
      <div className="flex items-center gap-2 bg-sea-bg border border-sea-border rounded-lg px-3 py-2 focus-within:border-blue-500/60 transition-colors">
        <span className="text-blue-400 text-xs font-mono shrink-0">⌘</span>
        <input
          ref={inputRef}
          type="text"
          value={commanderInput}
          onChange={(e) => setCommanderInput(e.target.value)}
          placeholder='예: "부산항 현재 상황", "MMSI 123456 위험 분석"'
          disabled={isCommanderLoading}
          className="flex-1 bg-transparent text-xs text-white placeholder-sea-muted outline-none font-mono disabled:opacity-50"
        />
        {isCommanderLoading ? (
          <span className="text-[10px] text-blue-400 font-mono animate-pulse shrink-0">분석 중...</span>
        ) : (
          <button
            type="submit"
            className="text-[10px] text-sea-muted hover:text-white transition-colors font-mono shrink-0"
          >
            ENTER ↵
          </button>
        )}
      </div>
    </form>
  );
}

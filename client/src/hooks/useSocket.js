import { useEffect, useRef, useState, useCallback } from 'react';

// One WebSocket connection to the server, shared by the whole app.
export default function useSocket() {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [frame, setFrame] = useState(null);
  const [benchResults, setBenchResults] = useState([]);
  const [benchRunning, setBenchRunning] = useState(false);

  useEffect(() => {
    let ws;
    let retry;
    let closed = false;

    const connect = () => {
      ws = new WebSocket(`ws://${location.host}/ws`);
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 1500);
      };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'frame') setFrame(msg);
        else if (msg.type === 'bench-result') setBenchResults((r) => [...r, msg.result]);
        else if (msg.type === 'bench-done') setBenchRunning(false);
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      ws?.close();
    };
  }, []);

  const send = useCallback((obj) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(obj));
  }, []);

  const startBench = (opts) => {
    setBenchResults([]);
    setBenchRunning(true);
    send({ type: 'bench', ...opts });
  };

  return { connected, frame, setFrame, send, benchResults, benchRunning, startBench };
}

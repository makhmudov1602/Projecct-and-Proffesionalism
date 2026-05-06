// hooks/useTargetStream.ts
import { useState, useEffect, useCallback } from 'react';

interface TargetDetection {
  x: number;
  y: number;
  conf: number;
  ring: number;
  score: number;
  dist: number;
}

interface ScoringResult {
  score: number;
  image: string;
  points: TargetDetection[];
}

export const useTargetStream = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [cameras, setCameras] = useState<string[]>([]);
  const [activeCameras, setActiveCameras] = useState<string[]>([]);
  const [results, setResults] = useState<Record<string, ScoringResult>>({});
  const [selectedCamera, setSelectedCamera] = useState<string>('cam1');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Connect directly to the Python backend on port 8000
    const wsUrl = 'ws://127.0.0.1:8000/ws/client';
    console.log('Connecting to WebSocket:', wsUrl);

    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log('Connected to Python backend WebSocket');
      setIsConnected(true);
      setError('');
      setWs(websocket);
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);

        if (data.action === 'snapshot') {
          setCameras(data.cameras || []);
          setActiveCameras(data.active || []);
          setResults(data.last_results || {});
        } else if (data.action === 'result') {
          setResults(prev => ({
            ...prev,
            [data.cam_id]: {
              score: data.score,
              image: data.image,
              points: data.points
            }
          }));
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    websocket.onclose = (event) => {
      console.log('WebSocket connection closed:', event.code, event.reason);
      setIsConnected(false);
      setWs(null);

      // Attempt reconnect after 2 seconds
      setTimeout(() => {
        if (!isConnected) {
          console.log('Attempting to reconnect WebSocket...');
          const newWs = new WebSocket(wsUrl);
          setWs(newWs);
        }
      }, 2000);
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('Failed to connect to scoring system');
      setIsConnected(false);
    };

    return () => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.close();
      }
    };
  }, []);

  const startCamera = useCallback(async (camId: string) => {
    try {
      console.log('Starting camera:', camId);
      const response = await fetch(`/api/start/${camId}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Start camera response:', result);
      return result;
    } catch (error) {
      console.error('Error starting camera:', error);
      setError(`Failed to start camera:`);
      return { status: 'error', detail: 'Failed to start camera' };
    }
  }, []);

  const stopCamera = useCallback(async (camId: string) => {
    try {
      console.log('Stopping camera:', camId);
      const response = await fetch(`/api/stop/${camId}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Stop camera response:', result);
      return result;
    } catch (error) {
      console.error('Error stopping camera:', error);
      setError(`Failed to stop camera`);
      return { status: 'error', detail: 'Failed to stop camera' };
    }
  }, []);

  const currentResult = results[selectedCamera];

  return {
    isConnected,
    cameras,
    activeCameras,
    results,
    selectedCamera,
    setSelectedCamera,
    currentResult,
    error,
    startCamera,
    stopCamera
  };
};
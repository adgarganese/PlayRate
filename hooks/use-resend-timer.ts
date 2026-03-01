import { useState, useEffect, useRef } from 'react';

type UseResendTimerOptions = {
  initialSeconds?: number;
  onComplete?: () => void;
};

export function useResendTimer({
  initialSeconds = 30,
  onComplete,
}: UseResendTimerOptions = {}) {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = () => {
    setSeconds(initialSeconds);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          if (onComplete) {
            onComplete();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const reset = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setSeconds(0);
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    seconds,
    isActive: seconds > 0,
    start,
    reset,
  };
}

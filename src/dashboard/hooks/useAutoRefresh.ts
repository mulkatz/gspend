import { useCallback, useEffect, useRef, useState } from 'react';
import { clearCache } from '../../store/cache.js';

export interface AutoRefresh {
	countdown: number;
	refresh: () => void;
	lastRefresh: Date;
}

export function useAutoRefresh(intervalSec: number, onRefresh: () => void): AutoRefresh {
	const [countdown, setCountdown] = useState(intervalSec);
	const [lastRefresh, setLastRefresh] = useState(new Date());
	const onRefreshRef = useRef(onRefresh);
	onRefreshRef.current = onRefresh;

	const refresh = useCallback(() => {
		clearCache('status:');
		clearCache('breakdown:');
		clearCache('history:');
		setLastRefresh(new Date());
		setCountdown(intervalSec);
		onRefreshRef.current();
	}, [intervalSec]);

	// Tick countdown every second; trigger refresh when it hits zero
	const countdownRef = useRef(intervalSec);
	countdownRef.current = countdown;

	useEffect(() => {
		const timer = setInterval(() => {
			if (countdownRef.current <= 1) {
				refresh();
			} else {
				setCountdown((prev) => prev - 1);
			}
		}, 1000);

		return () => clearInterval(timer);
	}, [refresh]);

	return { countdown, refresh, lastRefresh };
}

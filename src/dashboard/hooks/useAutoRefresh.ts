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

	useEffect(() => {
		const timer = setInterval(() => {
			setCountdown((prev) => {
				if (prev <= 1) {
					refresh();
					return intervalSec;
				}
				return prev - 1;
			});
		}, 1000);

		return () => clearInterval(timer);
	}, [intervalSec, refresh]);

	return { countdown, refresh, lastRefresh };
}

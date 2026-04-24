import { useState, useCallback, useEffect, useRef } from 'react';

interface PaginationOptions {
  pageSize?: number;
  filterKey: string;
}

export function usePagination({ pageSize = 50, filterKey }: PaginationOptions) {
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<(string | undefined)[]>([]);
  const [pageIndex, setPageIndex] = useState(0);

  // Reset pagination when filters change
  const prevFilterKey = useRef(filterKey);
  useEffect(() => {
    if (prevFilterKey.current !== filterKey) {
      setCursor(undefined);
      setCursorHistory([]);
      setPageIndex(0);
      prevFilterKey.current = filterKey;
    }
  }, [filterKey]);

  const goNextPage = useCallback((endCursor: string | undefined) => {
    if (endCursor) {
      setCursorHistory(prev => {
        const next = [...prev, cursor];
        // Bound history to prevent unbounded growth
        return next.length > 200 ? next.slice(-200) : next;
      });
      setCursor(endCursor);
      setPageIndex(prev => prev + 1);
    }
  }, [cursor]);

  const goPrevPage = useCallback(() => {
    if (pageIndex > 0) {
      const prevCursor = cursorHistory[cursorHistory.length - 1];
      setCursorHistory(prev => prev.slice(0, -1));
      setCursor(prevCursor);
      setPageIndex(prev => prev - 1);
    }
  }, [pageIndex, cursorHistory]);

  return {
    cursor,
    pageIndex,
    pageSize,
    goNextPage,
    goPrevPage,
  };
}

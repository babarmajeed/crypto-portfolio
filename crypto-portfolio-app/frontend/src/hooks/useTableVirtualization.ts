import { useState, useMemo, useCallback } from 'react';

export const useTableVirtualization = <T extends { id: string }>(
  data: T[],
  defaultItemsPerPage: number = 50
) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(defaultItemsPerPage);

  // Calculate pagination values
  const totalPages = useMemo(() => {
    return Math.ceil(data.length / itemsPerPage) || 1;
  }, [data.length, itemsPerPage]);

  // Get visible items for current page
  const visibleTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  }, [data, currentPage, itemsPerPage]);

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]);

  // Handle items per page change
  const handleItemsPerPageChange = useCallback((newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    // Reset to first page when changing items per page
    setCurrentPage(1);
  }, []);

  // Reset to first page when data changes significantly
  const dataLength = data.length;
  useMemo(() => {
    if (currentPage > 1 && currentPage > Math.ceil(dataLength / itemsPerPage)) {
      setCurrentPage(1);
    }
  }, [dataLength, itemsPerPage, currentPage]);

  return {
    visibleTransactions,
    currentPage,
    totalPages,
    itemsPerPage,
    setCurrentPage: handlePageChange,
    setItemsPerPage: handleItemsPerPageChange
  };
};
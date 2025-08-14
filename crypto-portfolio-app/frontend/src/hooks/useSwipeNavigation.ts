import { useState, useRef, useCallback } from 'react';

interface SwipeState {
  isDragging: boolean;
  startX: number;
  currentX: number;
  transform: number;
}

interface SwipeNavigationProps {
  sections: string[];
  onSectionChange: (index: number) => void;
  threshold?: number;
  enableSwipe?: boolean;
}

export const useSwipeNavigation = ({
  sections,
  onSectionChange,
  threshold = 50,
  enableSwipe = true
}: SwipeNavigationProps) => {
  const [currentSection, setCurrentSection] = useState(0);
  const [swipeState, setSwipeState] = useState<SwipeState>({
    isDragging: false,
    startX: 0,
    currentX: 0,
    transform: 0
  });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enableSwipe) return;
    
    const touch = e.touches[0];
    startTimeRef.current = Date.now();
    setSwipeState(prev => ({
      ...prev,
      isDragging: true,
      startX: touch.clientX,
      currentX: touch.clientX
    }));
  }, [enableSwipe]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enableSwipe || !swipeState.isDragging) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - swipeState.startX;
    
    setSwipeState(prev => ({
      ...prev,
      currentX: touch.clientX,
      transform: deltaX
    }));
  }, [enableSwipe, swipeState.isDragging, swipeState.startX]);

  const handleTouchEnd = useCallback(() => {
    if (!enableSwipe || !swipeState.isDragging) return;
    
    const deltaX = swipeState.currentX - swipeState.startX;
    const deltaTime = Date.now() - startTimeRef.current;
    const velocity = Math.abs(deltaX) / deltaTime;
    
    // Determine if swipe was significant enough
    const isSignificantSwipe = Math.abs(deltaX) > threshold || velocity > 0.5;
    
    if (isSignificantSwipe) {
      if (deltaX > 0 && currentSection > 0) {
        // Swipe right - go to previous section
        const newSection = currentSection - 1;
        setCurrentSection(newSection);
        onSectionChange(newSection);
      } else if (deltaX < 0 && currentSection < sections.length - 1) {
        // Swipe left - go to next section
        const newSection = currentSection + 1;
        setCurrentSection(newSection);
        onSectionChange(newSection);
      }
    }
    
    setSwipeState({
      isDragging: false,
      startX: 0,
      currentX: 0,
      transform: 0
    });
  }, [
    enableSwipe,
    swipeState.isDragging,
    swipeState.currentX,
    swipeState.startX,
    threshold,
    currentSection,
    sections.length,
    onSectionChange
  ]);

  const navigateToSection = useCallback((index: number) => {
    if (index >= 0 && index < sections.length) {
      setCurrentSection(index);
      onSectionChange(index);
    }
  }, [sections.length, onSectionChange]);

  const nextSection = useCallback(() => {
    if (currentSection < sections.length - 1) {
      navigateToSection(currentSection + 1);
    }
  }, [currentSection, sections.length, navigateToSection]);

  const previousSection = useCallback(() => {
    if (currentSection > 0) {
      navigateToSection(currentSection - 1);
    }
  }, [currentSection, navigateToSection]);

  return {
    currentSection,
    swipeState,
    containerRef,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd
    },
    navigation: {
      navigateToSection,
      nextSection,
      previousSection,
      canGoNext: currentSection < sections.length - 1,
      canGoPrevious: currentSection > 0
    }
  };
};
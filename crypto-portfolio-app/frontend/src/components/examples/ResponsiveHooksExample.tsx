import React, { useState } from 'react';
import { useResponsive, useTouch, useSwipe } from '../../hooks';
import type { TapEvent, SwipeEvent, PinchEvent } from '../../types/responsive.types';

/**
 * Example component demonstrating the usage of CP-034 responsive hooks
 * This component showcases device detection, touch handling, and swipe gestures
 */
export const ResponsiveHooksExample: React.FC = () => {
  // Responsive hook for device detection and breakpoint management
  const responsive = useResponsive({
    debounceDelay: 100,
    enableOrientationChange: true,
    enableVisibilityChange: true
  });

  // State for touch and swipe feedback
  const [touchFeedback, setTouchFeedback] = useState<string>('No touch detected');
  const [swipeFeedback, setSwipeFeedback] = useState<string>('No swipe detected');
  const [tapCount, setTapCount] = useState(0);
  const [pinchScale, setPinchScale] = useState(1);

  // Touch hook for gesture recognition
  const touch = useTouch({
    onTap: (event: TapEvent) => {
      setTapCount(prev => prev + 1);
      setTouchFeedback(`Single tap at (${event.clientX}, ${event.clientY})`);
    },
    onDoubleTap: (event: TapEvent) => {
      setTouchFeedback(`Double tap at (${event.clientX}, ${event.clientY})`);
    },
    onPinchStart: (event: PinchEvent) => {
      setTouchFeedback(`Pinch started at scale ${event.scale.toFixed(2)}`);
    },
    onPinchChange: (event: PinchEvent) => {
      setPinchScale(event.scale);
      setTouchFeedback(`Pinching: scale ${event.scale.toFixed(2)}`);
    },
    onPinchEnd: (event: PinchEvent) => {
      setTouchFeedback(`Pinch ended at scale ${event.scale.toFixed(2)}`);
    },
    tapThreshold: 10,
    doubleTapDelay: 300,
    pinchThreshold: 0.05
  });

  // Swipe hook for directional gestures
  const swipe = useSwipe({
    onSwipeStart: () => {
      setSwipeFeedback('Swipe started...');
    },
    onSwipeLeft: (event: SwipeEvent) => {
      setSwipeFeedback(`Swiped left: ${event.distance.toFixed(0)}px in ${event.duration}ms`);
    },
    onSwipeRight: (event: SwipeEvent) => {
      setSwipeFeedback(`Swiped right: ${event.distance.toFixed(0)}px in ${event.duration}ms`);
    },
    onSwipeUp: (event: SwipeEvent) => {
      setSwipeFeedback(`Swiped up: ${event.distance.toFixed(0)}px in ${event.duration}ms`);
    },
    onSwipeDown: (event: SwipeEvent) => {
      setSwipeFeedback(`Swiped down: ${event.distance.toFixed(0)}px in ${event.duration}ms`);
    },
    onSwipeCancel: () => {
      setSwipeFeedback('Swipe cancelled');
    },
    minDistance: 50,
    minVelocity: 0.3,
    maxTime: 1000
  });

  // Combine touch and swipe handlers
  const combinedHandlers = {
    ...touch.bind(),
    ...swipe.bind()
  };

  return (
    <div className="responsive-hooks-example p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">
        CP-034 Responsive Hooks Demo
      </h1>

      {/* Device Information Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-3 text-gray-800">Device Info</h2>
          <div className="space-y-2 text-sm">
            <div><span className="font-medium">Type:</span> {responsive.deviceInfo.type}</div>
            <div><span className="font-medium">Orientation:</span> {responsive.deviceInfo.orientation}</div>
            <div><span className="font-medium">Touch Device:</span> {responsive.deviceInfo.isTouchDevice ? 'Yes' : 'No'}</div>
            <div><span className="font-medium">Retina Display:</span> {responsive.deviceInfo.isRetina ? 'Yes' : 'No'}</div>
            <div><span className="font-medium">Has Hover:</span> {responsive.deviceInfo.hasHover ? 'Yes' : 'No'}</div>
            <div><span className="font-medium">Platform:</span> {responsive.deviceInfo.platform}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-3 text-gray-800">Screen Size</h2>
          <div className="space-y-2 text-sm">
            <div><span className="font-medium">Width:</span> {responsive.screenSize.width}px</div>
            <div><span className="font-medium">Height:</span> {responsive.screenSize.height}px</div>
            <div><span className="font-medium">Pixel Ratio:</span> {responsive.screenSize.pixelRatio}</div>
            <div><span className="font-medium">Available Width:</span> {responsive.screenSize.availWidth}px</div>
            <div><span className="font-medium">Available Height:</span> {responsive.screenSize.availHeight}px</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-3 text-gray-800">Breakpoint</h2>
          <div className="space-y-2 text-sm">
            <div><span className="font-medium">Current:</span> {responsive.breakpoint.name}</div>
            <div><span className="font-medium">Min Width:</span> {responsive.breakpoint.min}px</div>
            <div><span className="font-medium">Max Width:</span> {responsive.breakpoint.max || 'unlimited'}px</div>
            <div className="mt-3 space-y-1">
              <div><span className="font-medium">Is Mobile:</span> {responsive.isMobile ? '✓' : '✗'}</div>
              <div><span className="font-medium">Is Tablet:</span> {responsive.isTablet ? '✓' : '✗'}</div>
              <div><span className="font-medium">Is Desktop:</span> {responsive.isDesktop ? '✓' : '✗'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Breakpoint Testing Section */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Breakpoint Testing</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {['xs', 'sm', 'md', 'lg', 'xl', 'xxl'].map(bp => (
            <div key={bp} className="text-center">
              <div className={`p-2 rounded ${responsive.isBreakpoint(bp) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                {bp.toUpperCase()}
                {responsive.isBreakpoint(bp) && ' (Active)'}
              </div>
              <div className="mt-1 text-xs">
                At least: {responsive.isAtLeast(bp) ? '✓' : '✗'}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={responsive.refresh}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          >
            Refresh
          </button>
          <span className="text-sm text-gray-600">
            Media Query (min-width: 768px): {responsive.matches('(min-width: 768px)') ? '✓' : '✗'}
          </span>
        </div>
      </div>

      {/* Touch Interaction Section */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Touch Interactions</h2>
        
        <div className="mb-4 p-4 bg-gray-50 rounded">
          <div className="text-sm text-gray-600 mb-2">Touch Support: {touch.isSupported ? '✅ Supported' : '❌ Not Supported'}</div>
          <div className="text-sm text-gray-600 mb-2">Touch Active: {touch.isActive ? '🔴 Active' : '⚫ Inactive'}</div>
          <div className="text-sm text-gray-600 mb-2">Current Touches: {touch.currentTouches.length}</div>
          <div className="text-sm text-gray-600 mb-2">Tap Count: {tapCount}</div>
          <div className="text-sm font-medium">{touchFeedback}</div>
        </div>

        <div
          {...combinedHandlers}
          className="w-full h-40 bg-gradient-to-r from-blue-400 to-purple-500 rounded-lg flex items-center justify-center text-white font-semibold cursor-pointer select-none"
          style={{ transform: `scale(${pinchScale})` }}
        >
          <div className="text-center">
            <div>Touch/Pinch Area</div>
            <div className="text-sm mt-2">
              {responsive.deviceInfo.isTouchDevice 
                ? 'Tap, double-tap, or pinch me!'
                : 'Click and drag to simulate swipe'
              }
            </div>
            {pinchScale !== 1 && (
              <div className="text-sm mt-1">
                Scale: {pinchScale.toFixed(2)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Swipe Gestures Section */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Swipe Gestures</h2>
        
        <div className="mb-4 p-4 bg-gray-50 rounded">
          <div className="text-sm text-gray-600 mb-2">Swipe Support: {swipe.isSupported ? '✅ Supported' : '❌ Not Supported'}</div>
          <div className="text-sm text-gray-600 mb-2">Swipe Active: {swipe.isActive ? '🔴 Active' : '⚫ Inactive'}</div>
          <div className="text-sm font-medium">{swipeFeedback}</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            {...swipe.bind()}
            className="h-32 bg-gradient-to-r from-green-400 to-blue-500 rounded-lg flex items-center justify-center text-white font-semibold cursor-pointer select-none"
          >
            <div className="text-center">
              <div>Swipe Area</div>
              <div className="text-sm mt-2">Swipe in any direction</div>
            </div>
          </div>

          <div className="text-sm space-y-2">
            <div className="text-gray-700 font-medium">Swipe Directions:</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-blue-100 rounded text-center">👆 Up</div>
              <div className="p-2 bg-blue-100 rounded text-center">👇 Down</div>
              <div className="p-2 bg-blue-100 rounded text-center">👈 Left</div>
              <div className="p-2 bg-blue-100 rounded text-center">👉 Right</div>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Min distance: 50px, Min velocity: 0.3px/ms, Max time: 1s
            </div>
          </div>
        </div>
      </div>

      {/* Additional Information */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">Features Demonstrated:</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Device type detection (mobile/tablet/desktop)</li>
          <li>• Responsive breakpoint management</li>
          <li>• Screen size and orientation tracking</li>
          <li>• Touch event handling with tap and double-tap recognition</li>
          <li>• Pinch-to-zoom gesture support</li>
          <li>• Swipe gesture recognition with directional callbacks</li>
          <li>• Cross-browser compatibility with fallbacks</li>
          <li>• Performance-optimized debounced handlers</li>
          <li>• Comprehensive error handling</li>
        </ul>
      </div>
    </div>
  );
};

export default ResponsiveHooksExample;
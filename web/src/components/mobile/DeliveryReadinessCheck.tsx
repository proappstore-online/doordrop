import React, { useEffect, useState } from 'react';

export type ReadinessState =
  | 'checking'
  | 'ready'
  | 'permission-denied'
  | 'inaccurate-gps'
  | 'offline'
  | 'out-of-range'
  | 'no-flyer'
  | 'no-doors'
  | 'campaign-closed'
  | 'failed-session';

interface DeliveryReadinessCheckProps {
  hasFlyer: boolean;
  doorCount: number;
  isCampaignClosed: boolean;
  onReady: () => void;
  onStateChange: (state: ReadinessState) => void;
}

const DeliveryReadinessCheck: React.FC<DeliveryReadinessCheckProps> = ({
  hasFlyer,
  doorCount,
  isCampaignClosed,
  onReady,
  onStateChange,
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const checkReadiness = async () => {
      onStateChange('checking');

      // Check campaign status
      if (isCampaignClosed) {
        onStateChange('campaign-closed');
        return;
      }

      // Check flyer
      if (!hasFlyer) {
        onStateChange('no-flyer');
        return;
      }

      // Check doors
      if (doorCount === 0) {
        onStateChange('no-doors');
        return;
      }

      // Check network
      if (!isOnline) {
        onStateChange('offline');
        return;
      }

      // Check GPS permission and accuracy
      if (!navigator.geolocation) {
        onStateChange('permission-denied');
        return;
      }

      try {
        const geoPosition = await new Promise<GeolocationCoordinates>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos.coords),
            (err) => reject(err),
            { enableHighAccuracy: true, timeout: 10000 }
          );
        });

        // Check GPS accuracy
        if (geoPosition.accuracy > 50) {
          // More than 50 meters is inaccurate
          onStateChange('inaccurate-gps');
          return;
        }

        // All checks passed
        onStateChange('ready');
        onReady();
      } catch (err: any) {
        if (err.code === err.PERMISSION_DENIED) {
          onStateChange('permission-denied');
        } else {
          onStateChange('inaccurate-gps');
        }
      }
    };

    checkReadiness();
  }, [hasFlyer, doorCount, isCampaignClosed, isOnline, onReady, onStateChange]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return null; // This component is purely for checking and calling callbacks
};

export default DeliveryReadinessCheck;

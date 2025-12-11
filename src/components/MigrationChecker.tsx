import { useEffect, useState } from 'react';
import { MigrationModal } from './MigrationModal';
import { hasDataToMigrate } from '../utils/migration';
import { useAuth } from '../contexts/AuthContext';

export function MigrationChecker() {
  const { user } = useAuth();
  const [showMigration, setShowMigration] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    // Only check if user is logged in
    if (user && !hasChecked) {
      const shouldShow = hasDataToMigrate();
      setShowMigration(shouldShow);
      setHasChecked(true);
    }
  }, [user, hasChecked]);

  if (!showMigration) {
    return null;
  }

  return (
    <MigrationModal
      open={showMigration}
      onClose={() => setShowMigration(false)}
      onComplete={() => {
        setShowMigration(false);
        setHasChecked(true);
      }}
    />
  );
}








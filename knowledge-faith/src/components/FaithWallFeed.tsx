import { WallFeed } from './wall/WallFeed.tsx';

export function FaithWallFeed({ compact = false }: { compact?: boolean }) {
  return <WallFeed compact={compact} />;
}

export default FaithWallFeed;

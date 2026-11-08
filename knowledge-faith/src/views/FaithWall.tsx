import { WallFeed } from '../components/wall/WallFeed.tsx';

export function FaithWall({ compact = false }: { compact?: boolean }) {
  return <WallFeed compact={compact} />;
}

export default FaithWall;
